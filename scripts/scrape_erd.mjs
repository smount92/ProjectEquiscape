#!/usr/bin/env node
/**
 * ============================================================
 * ERD Resin Scraper — Scrapes the Equine Resin Directory
 * (equineresindirectory.com) for artist resin data.
 *
 * Strategy:
 *  - Sequential iteration over a configurable ID range
 *  - 1-second delay between every request (polite crawl)
 *  - Cheerio parsing of the legacy ASP HTML
 *  - CSV output with columns: erd_id, resin_name, sculptor, scale
 *  - Incremental CSV saves every 50 IDs (crash-safe)
 *
 * Usage:
 *   node scripts/scrape_erd.mjs                     # defaults: 1-500
 *   node scripts/scrape_erd.mjs --start=501 --end=5000
 * ============================================================
 */

import { load } from "cheerio";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- CONFIG (CLI-overridable) ----
const BASE_URL = "http://www.equineresindirectory.com/showresin.asp?resinid=";
const cliArgs = process.argv.slice(2);
const START_ID = parseInt(cliArgs.find(a => a.startsWith("--start="))?.split("=")[1] || "1", 10);
const END_ID = parseInt(cliArgs.find(a => a.startsWith("--end="))?.split("=")[1] || "500", 10);
const DELAY_MS = 1000; // 1 second between requests — strict polite crawl
const REQUEST_TIMEOUT = 15000;
const CONSECUTIVE_MISS_LIMIT = 100; // stop early if 100 consecutive misses (end of DB)

// ---- HTTP fetch (ERD is plain HTTP, not HTTPS) ----
function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: REQUEST_TIMEOUT }, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = res.headers.location.startsWith("http")
                    ? res.headers.location
                    : new URL(res.headers.location, url).href;
                return fetchPage(redirectUrl).then(resolve).catch(reject);
            }

            if (res.statusCode === 404) {
                resolve(null); // 404 = not found, return null
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timeout"));
        });
    });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ---- Parse a single resin page ----
// HTML structure (from inspection):
//
//   <table bgcolor="#D3D6C0">
//     <tr><td><p align="center"><font size="5">RESIN NAME</font></p></td></tr>
//   </table>
//
//   <p align="center">Traditional American Saddlebred Stallion sculpted 1999...</p>
//   <p align="center">by SCULPTOR NAME<br>
//     <a href="...">website</a>
//   </p>
//
function parseResinPage(html, erdId) {
    // Quick check for "Cannot find" pages
    if (html.includes("Cannot find ResinID")) {
        return null;
    }

    const $ = load(html);

    // 1. Resin Name — inside <font size="5"> within the green header table
    let resinName = "";
    const nameEl = $('table[bgcolor="#D3D6C0"] font[size="5"]');
    if (nameEl.length > 0) {
        resinName = nameEl.first().text().trim();
    }

    // Fallback: try <title> tag
    if (!resinName) {
        const titleText = $("title").text().trim();
        if (titleText && !titleText.toLowerCase().includes("cannot find")) {
            resinName = titleText;
        }
    }

    if (!resinName) return null;

    // 2. Description line — the first <p align="center"> after the header table
    //    Contains: "Scale Breed Gender sculpted YEAR edition info"
    //    Example: "Traditional American Saddlebred Stallion sculpted 1999 sold out edition of 150"
    //    Example: "Large Classic Friesian Mare"
    //    Example: "Traditional Saluki Male"
    let scale = "";
    let descriptionText = "";

    // Find all center-aligned paragraphs in the main content
    const paragraphs = $('p[align="center"]');
    for (let i = 0; i < paragraphs.length; i++) {
        const text = $(paragraphs[i]).text().trim();

        // The description paragraph typically starts with the scale keyword
        const scaleMatch = text.match(
            /^(Traditional|Classic|Large Classic|Small Classic|Stablemate|Micro Mini|Paddock Pal|Little Bits|Mini|Pebble|Stone Chips|Chip|Other|LB|Action Stock|Draft Scale|Ornament|Medallion|Wall Sculpture|Standing|Trotting|Cantering|Foal Scale|Clydesdale Scale|ISH Scale|Para|1:9|1:12|1:32|1:24|1:16|1:64|1:6|1:3|1:2|1:1)\b/i
        );

        if (scaleMatch) {
            scale = scaleMatch[1];
            descriptionText = text;
            break;
        }

        // Also check if the line has "sculpted" or breed info (sometimes scale is embedded)
        if (text.includes("sculpted") || text.match(/\b(Arabian|Morgan|Quarter Horse|Thoroughbred|Friesian|Warmblood|Draft|Pony|Stallion|Mare|Gelding|Foal|Filly|Colt)\b/i)) {
            if (!descriptionText) {
                descriptionText = text;
                // Try to extract scale from the beginning
                const words = text.split(/\s+/);
                if (words.length > 0) {
                    // Check if first word(s) are a known scale
                    const firstTwo = words.slice(0, 2).join(" ");
                    const firstOne = words[0];
                    if (/^(Traditional|Classic|Stablemate|Mini|Pebble|Other|Micro|Foal|Draft|Paddock|Little)/i.test(firstTwo)) {
                        scale = firstTwo.match(/^(Traditional|Large Classic|Small Classic|Classic|Stablemate|Micro Mini|Mini|Pebble|Other|Paddock Pal|Little Bits|Draft Scale|Foal Scale)/i)?.[1] || firstOne;
                    } else if (/^(Traditional|Classic|Stablemate|Mini|Pebble|Other)/i.test(firstOne)) {
                        scale = firstOne;
                    }
                }
            }
        }
    }

    // 3. Sculptor — look for "by SCULPTOR NAME" pattern
    let sculptor = "";
    for (let i = 0; i < paragraphs.length; i++) {
        const pHtml = $(paragraphs[i]).html() || "";
        const pText = $(paragraphs[i]).text().trim();

        // Match "by Sculptor Name" — the sculptor line starts with "by "
        const byMatch = pText.match(/^by\s+(.+?)(?:\s*$|\s*http)/i);
        if (byMatch) {
            sculptor = byMatch[1].trim();
            // Clean up: remove any trailing URL text
            sculptor = sculptor.replace(/\s*http.*$/i, "").trim();
            break;
        }

        // Sometimes "by" is at the start of a <p> that also has a <br> and <a>
        const byHtmlMatch = pHtml.match(/^by\s+([^<]+)/i);
        if (byHtmlMatch) {
            sculptor = byHtmlMatch[1].trim();
            break;
        }
    }

    // Normalize scale names to match our database conventions
    const scaleNormalized = normalizeScale(scale);

    return {
        erd_id: erdId,
        resin_name: resinName,
        sculptor: sculptor || "Unknown",
        scale: scaleNormalized || "Unknown",
    };
}

// ---- Normalize scale names ----
function normalizeScale(raw) {
    if (!raw) return "";
    const lower = raw.toLowerCase().trim();

    if (lower === "traditional" || lower === "1:9") return "Traditional (1:9)";
    if (lower === "classic" || lower === "1:12") return "Classic (1:12)";
    if (lower === "large classic") return "Large Classic";
    if (lower === "small classic") return "Small Classic";
    if (lower === "stablemate" || lower === "1:32") return "Stablemate (1:32)";
    if (lower === "paddock pal" || lower === "little bits" || lower === "lb" || lower === "1:24") return "Paddock Pal (1:24)";
    if (lower === "micro mini" || lower === "1:64") return "Micro Mini (1:64)";
    if (lower === "mini") return "Mini";
    if (lower === "pebble" || lower === "stone chips" || lower === "chip") return "Pebble";
    if (lower.includes("draft")) return "Draft Scale";
    if (lower.includes("foal")) return "Foal Scale";
    if (lower.includes("medallion")) return "Medallion";
    if (lower.includes("ornament")) return "Ornament";

    // Return cleaned-up original if no match
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ---- CSV helpers ----
function escapeCsv(val) {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// ---- Write CSV to disk ----
function writeCsv(outputPath, results) {
    const csvHeader = "erd_id,resin_name,sculptor,scale";
    const csvRows = results.map(
        (r) => `${r.erd_id},${escapeCsv(r.resin_name)},${escapeCsv(r.sculptor)},${escapeCsv(r.scale)}`
    );
    writeFileSync(outputPath, csvHeader + "\n" + csvRows.join("\n") + "\n", "utf-8");
}

// ---- Progress bar ----
function progressBar(current, total, width = 30) {
    const pct = current / total;
    const filled = Math.round(width * pct);
    const bar = "█".repeat(filled) + "░".repeat(width - filled);
    return `[${bar}] ${Math.round(pct * 100)}%`;
}

// ---- MAIN ----
async function main() {
    // Determine output filename based on range
    const outputFilename = START_ID === 1 && END_ID === 500
        ? "erd_resins_batch1.csv"
        : `erd_resins_${START_ID}_${END_ID}.csv`;
    const outputPath = join(__dirname, "..", "supabase", "seed", outputFilename);

    console.log("🎨 ERD Resin Scraper — Starting...");
    console.log(`   Range: resinid=${START_ID} to resinid=${END_ID}`);
    console.log(`   Delay: ${DELAY_MS}ms between requests`);
    console.log(`   Output: ${outputFilename}`);
    console.log(`   Estimated time: ~${Math.ceil(((END_ID - START_ID + 1) * DELAY_MS) / 60000)} minutes`);
    console.log(`   Will stop early after ${CONSECUTIVE_MISS_LIMIT} consecutive misses\n`);

    const results = [];
    let found = 0;
    let skipped = 0;
    let errors = 0;
    let consecutiveMisses = 0;
    let lastSavedCount = 0;
    let actualEndId = END_ID;

    for (let id = START_ID; id <= END_ID; id++) {
        const url = BASE_URL + id;

        try {
            const html = await fetchPage(url);

            if (!html) {
                skipped++;
                consecutiveMisses++;
            } else {
                const resin = parseResinPage(html, id);
                if (resin) {
                    results.push(resin);
                    found++;
                    consecutiveMisses = 0; // reset on hit

                    if (found <= 5 || found % 50 === 0) {
                        console.log(`   ✅ #${id}: ${resin.resin_name} by ${resin.sculptor} [${resin.scale}]`);
                    }
                } else {
                    skipped++;
                    consecutiveMisses++;
                }
            }
        } catch (err) {
            errors++;
            consecutiveMisses++;
            if (errors <= 10) {
                console.log(`   ❌ #${id}: ${err.message}`);
            }
        }

        // Progress update every 50 IDs
        if (id % 50 === 0 || id === END_ID) {
            const progress = progressBar(id - START_ID + 1, END_ID - START_ID + 1);
            process.stdout.write(`\r   ${progress}  ID ${id}/${END_ID}  |  Found: ${found}  Skipped: ${skipped}  Errors: ${errors}  `);
        }

        // Incremental CSV save every 100 IDs (crash safety)
        if (results.length > lastSavedCount && (id % 100 === 0 || id === END_ID)) {
            writeCsv(outputPath, results);
            lastSavedCount = results.length;
        }

        // Stop early if we've hit too many consecutive misses
        if (consecutiveMisses >= CONSECUTIVE_MISS_LIMIT) {
            actualEndId = id;
            console.log(`\n\n   ⛔ ${CONSECUTIVE_MISS_LIMIT} consecutive misses — reached end of ERD database at ID ${id}`);
            break;
        }

        // Polite delay — EVERY request
        await sleep(DELAY_MS);
    }

    console.log("\n");

    // ---- Final CSV write ----
    writeCsv(outputPath, results);

    // ---- Summary ----
    const scanned = actualEndId - START_ID + 1;
    console.log("═".repeat(50));
    console.log("📊 SCRAPE COMPLETE");
    console.log("═".repeat(50));
    console.log(`   IDs scanned:   ${scanned}`);
    console.log(`   Resins found:  ${found}`);
    console.log(`   IDs skipped:   ${skipped} (empty/deleted)`);
    console.log(`   Errors:        ${errors}`);
    console.log(`   Output:        ${outputPath}`);
    console.log("═".repeat(50));

    // Show a sample
    if (results.length > 0) {
        console.log("\n📋 Sample entries (first 8):");
        const sample = results.slice(0, 8);
        console.log("   " + "─".repeat(80));
        console.log(`   ${"ID".padEnd(6)} ${"Resin Name".padEnd(30)} ${"Sculptor".padEnd(25)} Scale`);
        console.log("   " + "─".repeat(80));
        for (const r of sample) {
            console.log(
                `   ${String(r.erd_id).padEnd(6)} ${r.resin_name.substring(0, 28).padEnd(30)} ${r.sculptor.substring(0, 23).padEnd(25)} ${r.scale}`
            );
        }
        console.log("   " + "─".repeat(80));
    }

    console.log("\n🏁 Done!");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
