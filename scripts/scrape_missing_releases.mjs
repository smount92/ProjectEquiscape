#!/usr/bin/env node
/**
 * ============================================================
 * Advanced Deep Crawler — Missing Releases
 *
 * Finds molds in the database with ZERO releases, then uses
 * fuzzy URL discovery and flexible HTML parsing to scrape
 * release data from IYB pages that the V1 scraper missed.
 *
 * Strategy:
 *  1. Query Supabase for reference_molds with 0 reference_releases.
 *  2. Fetch IYB index pages and build a link catalog.
 *  3. Fuzzy-match missing mold names to catalog URLs
 *     (ignoring spaces, punctuation, casing).
 *  4. For each matched URL, parse ALL <tr> rows flexibly —
 *     detect Model Number cells heuristically instead of
 *     relying on fixed column indexes.
 *  5. Output to reference_releases_batch2.csv.
 *
 * Usage:
 *   node scripts/scrape_missing_releases.mjs
 * ============================================================
 */

import { load } from "cheerio";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import https from "https";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- CONFIG ----
const BASE_URL = "https://www.identifyyourbreyer.com";
const DELAY_MS = 1500;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 20000;

const INDEX_PAGES = [
    { url: "/identify/traditional.htm", scale: "Traditional (1:9)" },
    { url: "/identify/Classic/classic.htm", scale: "Classic (1:12)" },
    { url: "/identify/Stablemate/sm.htm", scale: "Stablemate (1:32)" },
    { url: "/identify/PaddockPal/paddockpal.htm", scale: "Paddock Pals (1:24)" },
];

// ================================================================
// ENV + SUPABASE SETUP
// ================================================================
function loadEnv() {
    const envPath = join(__dirname, "..", ".env.local");
    const envContent = readFileSync(envPath, "utf-8");
    const vars = {};
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        vars[key] = val;
        if (!process.env[key]) process.env[key] = val;
    }
    return vars;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ================================================================
// HTTP HELPERS
// ================================================================
function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith("https") ? https : http;
        const req = proto.get(url, { timeout: REQUEST_TIMEOUT }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = res.headers.location.startsWith("http")
                    ? res.headers.location
                    : new URL(res.headers.location, url).href;
                return fetchPage(redirectUrl).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error(`Timeout for ${url}`));
        });
    });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fetchPage(url);
        } catch (err) {
            if (attempt < retries) {
                console.log(`  ⚠ Retry ${attempt + 1}/${retries} for ${url}: ${err.message}`);
                await sleep(DELAY_MS * (attempt + 1));
            } else {
                throw err;
            }
        }
    }
}

// ================================================================
// FUZZY MATCHING
// ================================================================

/**
 * Normalize a string for fuzzy comparison:
 * lowercase, strip all non-alphanumeric chars
 */
function normalize(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Compute Levenshtein distance between two strings
 * (for close-but-not-exact matches)
 */
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] =
                a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

/**
 * Find the best URL match for a mold name from the link catalog.
 * Returns { url, matchType, score } or null.
 *
 * Match priorities:
 *   1. Exact normalized match on link text
 *   2. Exact normalized match on href filename
 *   3. Link text contains the mold name (or vice versa)
 *   4. Levenshtein distance ≤ 3 on normalized text
 */
function fuzzyFindUrl(moldName, linkCatalog) {
    const normMold = normalize(moldName);
    if (!normMold) return null;

    let bestMatch = null;
    let bestScore = Infinity;

    for (const entry of linkCatalog) {
        const normText = normalize(entry.text);
        const normHref = normalize(entry.hrefFilename);

        // Priority 1: exact match on text
        if (normText === normMold) {
            return { url: entry.url, matchType: "exact-text", score: 0 };
        }

        // Priority 2: exact match on href filename
        if (normHref === normMold) {
            return { url: entry.url, matchType: "exact-href", score: 0 };
        }

        // Priority 3a: link text starts with mold name
        if (normText.startsWith(normMold) && normMold.length >= 4) {
            const score = normText.length - normMold.length;
            if (score < bestScore) {
                bestScore = score;
                bestMatch = { url: entry.url, matchType: "starts-with-text", score };
            }
        }

        // Priority 3b: mold name starts with link text (mold name is more specific)
        if (normMold.startsWith(normText) && normText.length >= 4) {
            const score = normMold.length - normText.length;
            if (score < bestScore) {
                bestScore = score;
                bestMatch = { url: entry.url, matchType: "starts-with-mold", score };
            }
        }

        // Priority 3c: href filename starts with mold name
        if (normHref.startsWith(normMold) && normMold.length >= 4) {
            const score = normHref.length - normMold.length;
            if (score < bestScore) {
                bestScore = score;
                bestMatch = { url: entry.url, matchType: "href-prefix", score };
            }
        }

        // Priority 4: Levenshtein distance on text
        if (normText.length >= 3 && normMold.length >= 3) {
            const maxLen = Math.max(normText.length, normMold.length);
            // Only compute Levenshtein if lengths are within 50% of each other
            if (Math.abs(normText.length - normMold.length) <= maxLen * 0.5) {
                const dist = levenshtein(normText, normMold);
                const threshold = Math.max(3, Math.floor(normMold.length * 0.25));
                if (dist <= threshold && dist < bestScore) {
                    bestScore = dist;
                    bestMatch = { url: entry.url, matchType: `levenshtein-${dist}`, score: dist + 10 };
                }
            }
        }

        // Priority 4b: Levenshtein on href filename
        if (normHref.length >= 3 && normMold.length >= 3) {
            const maxLen = Math.max(normHref.length, normMold.length);
            if (Math.abs(normHref.length - normMold.length) <= maxLen * 0.5) {
                const dist = levenshtein(normHref, normMold);
                const threshold = Math.max(3, Math.floor(normMold.length * 0.25));
                if (dist <= threshold && dist < bestScore) {
                    bestScore = dist;
                    bestMatch = { url: entry.url, matchType: `lev-href-${dist}`, score: dist + 15 };
                }
            }
        }
    }

    return bestMatch;
}

// ================================================================
// STEP 1: Query Supabase for molds with ZERO releases
// ================================================================
async function fetchMissingMolds() {
    console.log("📦 Querying Supabase for molds with zero releases...\n");

    // Fetch all molds
    const allMolds = [];
    let page = 0;
    const PAGE_SIZE = 1000;

    while (true) {
        const { data, error } = await supabase
            .from("reference_molds")
            .select("id, mold_name, manufacturer, scale")
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error("❌ Failed to fetch molds:", error.message);
            process.exit(1);
        }
        allMolds.push(...data);
        if (data.length < PAGE_SIZE) break;
        page++;
    }

    console.log(`   Total molds in DB: ${allMolds.length}`);

    // Fetch all mold_ids that HAVE at least one release
    const moldsWithReleases = new Set();
    page = 0;
    while (true) {
        const { data, error } = await supabase
            .from("reference_releases")
            .select("mold_id")
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error("❌ Failed to fetch releases:", error.message);
            process.exit(1);
        }
        data.forEach((r) => moldsWithReleases.add(r.mold_id));
        if (data.length < PAGE_SIZE) break;
        page++;
    }

    console.log(`   Molds WITH releases: ${moldsWithReleases.size}`);

    // Filter to molds with 0 releases
    const missingMolds = allMolds.filter((m) => !moldsWithReleases.has(m.id));
    console.log(`   Molds with ZERO releases: ${missingMolds.length}\n`);

    return missingMolds;
}

// ================================================================
// STEP 2: Build comprehensive link catalog from IYB index pages
// ================================================================
async function buildLinkCatalog() {
    const catalog = []; // { text, url, hrefFilename, scale }

    for (const indexPage of INDEX_PAGES) {
        const url = BASE_URL + indexPage.url;
        console.log(`📋 Scraping index: ${indexPage.scale} → ${url}`);

        try {
            const html = await fetchWithRetry(url);
            const $ = load(html);
            const baseDir = url.substring(0, url.lastIndexOf("/") + 1);

            // Grab EVERY <a> link that points to an .htm file
            $("a").each((_i, el) => {
                const href = $(el).attr("href");
                const text = $(el).text().trim();
                if (!href || !text) return;
                if (!href.match(/\.htm$/i)) return;

                // Skip known non-mold pages
                if (/index|glossary|links|traditional\.htm|classic\.htm|sm\.htm|paddockpal\.htm/i.test(href)) return;
                if (/webspecials|specialevent|HorseBio|packaging|color/i.test(href)) return;

                // Resolve to absolute URL
                let absUrl;
                if (href.startsWith("http")) {
                    absUrl = href;
                } else if (href.startsWith("../")) {
                    absUrl = new URL(href, url).href;
                } else {
                    absUrl = baseDir + href;
                }

                // Extract filename without extension for href matching
                const hrefFilename = href
                    .split("/")
                    .pop()
                    .replace(/\.htm$/i, "");

                catalog.push({
                    text,
                    url: absUrl,
                    hrefFilename,
                    scale: indexPage.scale,
                });
            });

            console.log(`   Catalog size: ${catalog.length} links`);
            await sleep(DELAY_MS);
        } catch (err) {
            console.error(`  ❌ Failed to scrape index ${url}: ${err.message}`);
        }
    }

    // Deduplicate by URL
    const seen = new Set();
    const deduped = [];
    for (const entry of catalog) {
        if (!seen.has(entry.url)) {
            seen.add(entry.url);
            deduped.push(entry);
        }
    }

    console.log(`\n🗺️  Link catalog: ${deduped.length} unique URLs\n`);
    return deduped;
}

// ================================================================
// STEP 3: FLEXIBLE HTML PARSER — tolerates wildly inconsistent tables
// ================================================================

/**
 * Heuristic: does this cell text look like a model number?
 * Model numbers are typically 1–6 alphanumeric characters,
 * sometimes with a letter suffix (e.g. "400", "1182", "59972", "62LE")
 */
function looksLikeModelNumber(text) {
    const cleaned = text.trim();
    if (!cleaned || cleaned.length > 10) return false;
    // Must have at least one digit
    if (!/\d/.test(cleaned)) return false;
    // Should be mostly alphanumeric, possibly with a dash or hash
    if (/^#?\d{1,6}[A-Z]{0,3}$/i.test(cleaned)) return true;
    // Hyphenated model numbers: "700-1200"
    if (/^\d{1,6}-\d{1,6}$/.test(cleaned)) return true;
    // Plain short numeric
    if (/^\d{1,6}$/.test(cleaned)) return true;
    return false;
}

/**
 * Parse releases from a mold detail page using flexible row scanning.
 * Instead of relying on a specific column layout, we:
 *  1. Scan every <tr> on the page
 *  2. Find cells that look like model numbers
 *  3. Extract adjacent cells as Name, Color, Dates
 */
function parseReleasesFlexible(html, moldName) {
    const $ = load(html);
    const releases = [];
    const seenKeys = new Set();

    // Try multiple table selectors — IYB is inconsistent
    const tableSelectors = [
        'table[border="1"]',
        'table[border="2"]',
        "table.main",
        "table",
    ];

    let targetTable = null;
    for (const sel of tableSelectors) {
        const tables = $(sel);
        if (tables.length > 0) {
            // Prefer the table with the most rows (likely the release table)
            let bestTable = null;
            let bestRowCount = 0;
            tables.each((_i, tbl) => {
                const rowCount = $(tbl).find("tr").length;
                if (rowCount > bestRowCount) {
                    bestRowCount = rowCount;
                    bestTable = tbl;
                }
            });
            if (bestTable && bestRowCount >= 2) {
                targetTable = bestTable;
                break;
            }
        }
    }

    if (!targetTable) {
        // Fallback: scan ALL <tr> on the entire page
        $("tr").each((_i, row) => {
            processRow($, row, moldName, releases, seenKeys);
        });
        return releases;
    }

    // Process rows from the target table
    $(targetTable)
        .find("tr")
        .each((_i, row) => {
            processRow($, row, moldName, releases, seenKeys);
        });

    return releases;
}

function processRow($, row, moldName, releases, seenKeys) {
    try {
        const cells = $(row).find("td");
        if (cells.length < 3) return; // Need at least model# + name + something

        // Skip header rows
        const rowText = $(row).text().toLowerCase();
        if (
            rowText.includes("model number") ||
            rowText.includes("model#") ||
            rowText.includes("release date") ||
            (rowText.includes("photo") && rowText.includes("name") && rowText.includes("color"))
        ) {
            return;
        }

        // Find the first cell that looks like a model number
        let modelNumIdx = -1;
        for (let c = 0; c < cells.length; c++) {
            const cellText = $(cells[c]).text().trim();
            if (looksLikeModelNumber(cellText)) {
                modelNumIdx = c;
                break;
            }
        }

        if (modelNumIdx === -1) return; // No model number found in this row

        const modelNumber = $(cells[modelNumIdx]).text().trim();

        // Adjacent cells after the model number: Name, Color, Dates
        const nameIdx = modelNumIdx + 1;
        const colorIdx = modelNumIdx + 2;
        const datesIdx = modelNumIdx + 3;

        const releaseName = nameIdx < cells.length ? $(cells[nameIdx]).text().trim() : "";
        const colorDesc = colorIdx < cells.length ? $(cells[colorIdx]).text().trim() : "";
        const datesRaw = datesIdx < cells.length ? $(cells[datesIdx]).text().trim() : "";

        // Clean up whitespace & entities
        const cleanName = releaseName
            .replace(/\s+/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\u00a0/g, " ")
            .trim();

        const cleanColor = colorDesc
            .replace(/\s+/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\u00a0/g, " ")
            .trim();

        if (!cleanName) return;

        // Parse dates
        let yearStart = null;
        let yearEnd = null;

        // Also check the color column for dates if datesRaw is empty
        // (some pages put dates in unexpected columns)
        const dateSource = datesRaw || colorDesc;

        const dateMatch = dateSource.match(/(\d{4})\s*[-–—]\s*(\d{4}|current|present|cont)/i);
        if (dateMatch) {
            yearStart = parseInt(dateMatch[1], 10);
            const endStr = dateMatch[2].toLowerCase();
            yearEnd = /current|present|cont/.test(endStr) ? null : parseInt(endStr, 10);
        } else {
            const singleYear = dateSource.match(/\b(19\d{2}|20\d{2})\b/);
            if (singleYear) {
                yearStart = parseInt(singleYear[1], 10);
            }
        }

        // Validity checks
        if (yearStart && (yearStart < 1950 || yearStart > 2030)) yearStart = null;
        if (yearEnd && (yearEnd < 1950 || yearEnd > 2030)) yearEnd = null;

        // Dedup key
        const key = `${moldName}|${modelNumber}|${cleanName}|${cleanColor}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        releases.push({
            mold_name: moldName,
            model_number: modelNumber,
            release_name: cleanName,
            color_description: cleanColor || "",
            release_year_start: yearStart,
            release_year_end: yearEnd,
        });
    } catch {
        // Skip malformed rows silently
    }
}

// ================================================================
// CSV HELPERS
// ================================================================
function escapeCsvField(val) {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function toCsvRow(obj) {
    return [
        obj.mold_name,
        obj.model_number,
        obj.release_name,
        obj.color_description,
        obj.release_year_start,
        obj.release_year_end,
    ]
        .map(escapeCsvField)
        .join(",");
}

// ================================================================
// MAIN
// ================================================================
async function main() {
    console.log("═".repeat(60));
    console.log("🐴 Advanced Deep Crawler — Missing Releases");
    console.log("═".repeat(60));
    console.log();

    // 1. Find molds with zero releases
    const missingMolds = await fetchMissingMolds();

    if (missingMolds.length === 0) {
        console.log("🎉 All molds already have releases! Nothing to do.");
        process.exit(0);
    }

    // 2. Build the full link catalog from IYB index pages
    const linkCatalog = await buildLinkCatalog();

    // 3. Fuzzy-match missing molds to IYB URLs
    console.log("🔗 Fuzzy-matching missing molds to IYB URLs...\n");

    const matched = [];    // { mold, url, matchType }
    const unmatched = [];  // mold names we couldn't find

    for (const mold of missingMolds) {
        const result = fuzzyFindUrl(mold.mold_name, linkCatalog);
        if (result) {
            matched.push({ mold, url: result.url, matchType: result.matchType });
            console.log(`   ✅ ${mold.mold_name} → ${result.matchType} → ${result.url}`);
        } else {
            unmatched.push(mold.mold_name);
            console.log(`   ⚠ ${mold.mold_name} — no URL found`);
        }
    }

    console.log(`\n   Matched: ${matched.length} / ${missingMolds.length}`);
    console.log(`   Unmatched: ${unmatched.length}\n`);

    // 4. Scrape each matched URL
    const allReleases = [];
    let scraped = 0;
    let failed = 0;
    const processedUrls = new Set();

    for (const entry of matched) {
        // Skip duplicate URLs (same mold across scales)
        if (processedUrls.has(entry.url)) continue;
        processedUrls.add(entry.url);

        scraped++;
        console.log(`🔍 [${scraped}/${matched.length}] ${entry.mold.mold_name} → ${entry.url}`);

        try {
            const html = await fetchWithRetry(entry.url);
            const releases = parseReleasesFlexible(html, entry.mold.mold_name);

            if (releases.length > 0) {
                console.log(`   ✅ Found ${releases.length} releases`);
                allReleases.push(...releases);
            } else {
                console.log(`   ⚠ No releases parsed (unusual page structure)`);
            }

            await sleep(DELAY_MS);
        } catch (err) {
            failed++;
            console.error(`   ❌ Failed: ${err.message}`);
        }
    }

    // 5. Write CSV
    console.log(`\n${"═".repeat(60)}`);
    console.log("📊 RESULTS");
    console.log("═".repeat(60));
    console.log(`   Missing molds queried:   ${missingMolds.length}`);
    console.log(`   URLs matched (fuzzy):    ${matched.length}`);
    console.log(`   URLs unmatched:          ${unmatched.length}`);
    console.log(`   Pages scraped:           ${scraped}`);
    console.log(`   Pages failed:            ${failed}`);
    console.log(`   Releases extracted:      ${allReleases.length}`);
    console.log("═".repeat(60));

    if (allReleases.length === 0) {
        console.log("\n⚠ No new releases found. The remaining molds may have non-standard pages.");
        if (unmatched.length > 0) {
            console.log(`\n📝 Unmatched mold names (${unmatched.length}):`);
            unmatched.forEach((n) => console.log(`   • ${n}`));
        }
        process.exit(0);
    }

    const header = "mold_name,model_number,release_name,color_description,release_year_start,release_year_end";
    const csvRows = allReleases.map(toCsvRow);
    const outputPath = join(__dirname, "..", "supabase", "seed", "reference_releases_batch2.csv");
    writeFileSync(outputPath, header + "\n" + csvRows.join("\n") + "\n", "utf-8");

    console.log(`\n💾 Saved ${allReleases.length} releases to: ${outputPath}`);

    if (unmatched.length > 0) {
        console.log(`\n📝 Unmatched mold names that still need manual review (${unmatched.length}):`);
        unmatched.forEach((n) => console.log(`   • ${n}`));
    }

    console.log("\n🏁 Done!");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
