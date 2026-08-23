#!/usr/bin/env node
/**
 * ============================================================
 * IYB Release Scraper — Scrapes individual mold pages on
 * identifyyourbreyer.com for release/paint job data.
 *
 * Strategy:
 *  1. Scrape the scale index pages to build a map of
 *     mold_name → page URL.
 *  2. For each mold in our reference_molds_seed.csv,
 *     look up its URL and fetch the page.
 *  3. Parse the HTML table (9 columns: 4 photos, Model#,
 *     Name, Color, Release Dates, Notes).
 *  4. Output to reference_releases_seed.csv.
 *
 * Usage:
 *   node scripts/scrape_releases.mjs
 * ============================================================
 */

import { load } from "cheerio";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- CONFIG ----
const BASE_URL = "https://www.identifyyourbreyer.com";
const DELAY_MS = 1500; // 1.5s between requests — polite crawl
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 15000; // 15s

// Scale index pages → we scrape these to build mold_name → URL map
const INDEX_PAGES = [
  { url: "/identify/traditional.htm", scale: "Traditional (1:9)" },
  { url: "/identify/Classic/classic.htm", scale: "Classic (1:12)" },
  { url: "/identify/Stablemate/sm.htm", scale: "Stablemate (1:32)" },
  { url: "/identify/PaddockPal/paddockpal.htm", scale: "Paddock Pals (1:24)" },
];

// ---- HTTP FETCH ----
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const req = proto.get(url, { timeout: REQUEST_TIMEOUT }, (res) => {
      // Follow redirects
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
        await sleep(DELAY_MS * 2);
      } else {
        throw err;
      }
    }
  }
}

// ---- STEP 1: Build mold_name → URL map from index pages ----
async function buildMoldUrlMap() {
  const moldUrlMap = new Map(); // key: "mold_name|||scale" → URL

  for (const indexPage of INDEX_PAGES) {
    const url = BASE_URL + indexPage.url;
    console.log(`\n📋 Scraping index: ${indexPage.scale} → ${url}`);

    try {
      const html = await fetchWithRetry(url);
      const $ = load(html);

      // Find all links that point to mold detail pages
      // Pattern: links inside the main content area pointing to .htm files
      $("a").each((_i, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (!href || !text) return;

        // Only links that look like mold detail pages
        // Typically relative paths like "adios.htm", "LadyP.htm", "../identify/adios.htm"
        if (!href.match(/\.htm$/i)) return;
        if (href.includes("index") || href.includes("glossary") || href.includes("links")) return;
        if (href.includes("traditional.htm") || href.includes("classic.htm")) return;
        if (href.includes("sm.htm") || href.includes("paddockpal.htm")) return;
        if (href.includes("webspecials") || href.includes("specialevent")) return;
        if (href.includes("HorseBio") || href.includes("packaging")) return;

        // Check if the surrounding context looks like a mold entry
        // On the index pages, molds are typically listed with "Sculpted by:" text nearby
        const parent = $(el).closest("td, div, p");
        const parentText = parent.text();

        // We want the mold name links, not navigation links
        // Molds on the index page have "Introduced:" or "Sculpted by:" nearby
        if (
          parentText.includes("Introduced:") ||
          parentText.includes("Sculpted by:") ||
          parentText.includes("Mold #")
        ) {
          // Resolve relative URL
          const baseDir = url.substring(0, url.lastIndexOf("/") + 1);
          let absUrl;
          if (href.startsWith("http")) {
            absUrl = href;
          } else if (href.startsWith("../")) {
            absUrl = new URL(href, url).href;
          } else {
            absUrl = baseDir + href;
          }

          const key = `${text}|||${indexPage.scale}`;
          if (!moldUrlMap.has(key)) {
            moldUrlMap.set(key, absUrl);
          }
        }
      });

      console.log(`   Found ${[...moldUrlMap.values()].length} mold URLs so far`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  ❌ Failed to scrape index ${url}: ${err.message}`);
    }
  }

  return moldUrlMap;
}

// ---- STEP 2: Parse a mold detail page for releases ----
function parseReleasesFromPage(html, moldName) {
  const $ = load(html);
  const releases = [];

  // The main release table has 9 columns:
  // [Photo1] [Photo2] [Photo3] [Photo4] [Model Number] [Name] [Color] [Release Dates] [Notes]
  // We find all <tr> elements in the main table (border="1")
  const tables = $('table[border="1"]');

  if (tables.length === 0) {
    console.log(`    ⚠ No bordered table found for ${moldName}`);
    return releases;
  }

  // Use the first bordered table (the release table)
  const mainTable = tables.first();
  const rows = mainTable.find("tr");

  rows.each((_i, row) => {
    try {
      const cells = $(row).find("td");

      // Skip header row (it has "Model Number" text)
      if (cells.length < 5) return;
      const headerCheck = $(cells[4]).text().trim();
      if (headerCheck === "Model Number" || headerCheck === "Photo") return;


      // RIGHT-ALIGNED COLUMN MAPPING.
      //
      // These tables end with a fixed tail — Model# | Name | Color |
      // Release Dates | Released Through/Notes — while the number of
      // LEADING photo cells varies per page (4 to 9 seen). So count from
      // the end, where the layout is stable.
      //
      // The previous version sniffed for the model number by content,
      // matching /^d{1,6}[A-Z]?$/ against each cell left to right. A YEAR
      // MATCHES THAT PATTERN. On the rows whose Model# cell is blank —
      // one-of-a-kind auction pieces, test runs, prize models — it walked
      // past the empty cell, found "1994" in Release Dates, and declared
      // that the model number, shifting Name/Color/Dates one place right.
      // 1,489 catalog rows were imported with a year as their model number,
      // their notes as their title, and their real name and colour dropped.
      // Anchoring on position instead of content is what makes that
      // impossible to repeat.
      const n = cells.length;
      if (n < 5) return;
      const notesIdx = n - 1;
      const datesIdx = n - 2;
      const colorIdx = n - 3;
      const nameIdx = n - 4;
      const modelNumIdx = n - 5;

      // A blank or non-numeric Model# cell is LEGITIMATE (those one-offs
      // genuinely have no SKU). Record it as empty rather than borrowing a
      // neighbour's value.
      const rawNum = $(cells[modelNumIdx]).text().trim();
      const looksLikeYear = /^(19|20)[0-9]{2}([ ]*[-–][ ]*[0-9]{2,4})?$/.test(rawNum);
      if (looksLikeYear) return; // misaligned row — skip rather than corrupt

      // Safely extract text from each target column
      const modelNumber = modelNumIdx < cells.length ? $(cells[modelNumIdx]).text().trim() : "";
      const releaseName = nameIdx < cells.length ? $(cells[nameIdx]).text().trim() : "";
      const colorDesc = colorIdx < cells.length ? $(cells[colorIdx]).text().trim() : "";
      const datesRaw = datesIdx < cells.length ? $(cells[datesIdx]).text().trim() : "";

      // Skip empty rows or rows that are clearly not releases
      if (!modelNumber && !releaseName) return;
      if (!modelNumber || modelNumber.length > 12) return; // Skip invalid model numbers

      // Parse dates: "1969-1973", "1969-current", "2003", "1970-1987"
      let yearStart = null;
      let yearEnd = null;
      const dateMatch = datesRaw.match(/(\d{4})\s*[-–]\s*(\d{4}|current|present)/i);
      if (dateMatch) {
        yearStart = parseInt(dateMatch[1], 10);
        const endStr = dateMatch[2].toLowerCase();
        yearEnd = endStr === "current" || endStr === "present" ? null : parseInt(endStr, 10);
      } else {
        const singleYear = datesRaw.match(/(\d{4})/);
        if (singleYear) {
          yearStart = parseInt(singleYear[1], 10);
        }
      }

      // Clean up
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

      if (cleanName) {
        releases.push({
          mold_name: moldName,
          model_number: modelNumber,
          release_name: cleanName,
          color_description: cleanColor || "",
          release_year_start: yearStart,
          release_year_end: yearEnd,
        });
      }
    } catch (err) {
      // Individual row parse error — skip silently
    }
  });

  return releases;
}

// ---- STEP 3: Deduplicate releases ----
// IYB often has multiple rows for the same model# when there are color variations
function deduplicateReleases(releases) {
  const seen = new Map();
  const deduped = [];

  for (const r of releases) {
    const key = `${r.mold_name}|${r.model_number}|${r.release_name}|${r.color_description}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      deduped.push(r);
    }
  }
  return deduped;
}

// ---- STEP 4: CSV export ----
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

// ---- MAIN ----
async function main() {
  console.log("🐴 IYB Release Scraper — Starting...\n");

  // 1. Read our reference molds CSV to know which molds we care about
  const csvPath = join(__dirname, "..", "supabase", "seed", "reference_molds_seed.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  const moldRows = csvContent
    .split("\n")
    .slice(1) // skip header
    .filter((line) => line.trim())
    .map((line) => {
      // Parse CSV: manufacturer,mold_name,scale,release_year_start
      const match = line.match(/^([^,]+),(.+),([^,]+),(\d+)$/);
      if (!match) return null;
      return {
        manufacturer: match[1],
        mold_name: match[2],
        scale: match[3],
      };
    })
    .filter(Boolean);

  console.log(`📦 Loaded ${moldRows.length} molds from reference_molds_seed.csv`);

  // 2. Build URL map from index pages
  const moldUrlMap = await buildMoldUrlMap();
  console.log(`\n🗺️  Built URL map with ${moldUrlMap.size} entries\n`);

  // 3. For each mold in our CSV, try to find and scrape its detail page
  const allReleases = [];
  let scraped = 0;
  let skipped = 0;
  let failed = 0;

  // Get unique mold names (some appear across scales with different pages)
  const processedUrls = new Set();

  for (const mold of moldRows) {
    const key = `${mold.mold_name}|||${mold.scale}`;

    // Try exact match first
    let pageUrl = moldUrlMap.get(key);

    // If no exact match, try fuzzy matching by mold name only
    if (!pageUrl) {
      for (const [mapKey, mapUrl] of moldUrlMap.entries()) {
        const mapMoldName = mapKey.split("|||")[0];
        if (mapMoldName.toLowerCase() === mold.mold_name.toLowerCase()) {
          pageUrl = mapUrl;
          break;
        }
      }
    }

    if (!pageUrl) {
      skipped++;
      continue;
    }

    // Don't scrape the same page twice (same mold can appear in multiple scales)
    if (processedUrls.has(pageUrl)) {
      // But still attach releases we already found for this mold name
      continue;
    }
    processedUrls.add(pageUrl);

    try {
      console.log(`🔍 [${++scraped}] Scraping: ${mold.mold_name} → ${pageUrl}`);
      const html = await fetchWithRetry(pageUrl);
      const releases = parseReleasesFromPage(html, mold.mold_name);

      if (releases.length > 0) {
        console.log(`   ✅ Found ${releases.length} releases`);
        allReleases.push(...releases);
      } else {
        console.log(`   ⚠ No releases parsed (table may have unusual structure)`);
      }

      await sleep(DELAY_MS);
    } catch (err) {
      failed++;
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }

  // 4. Deduplicate and export
  const dedupedReleases = deduplicateReleases(allReleases);
  console.log(`\n📊 Summary:`);
  console.log(`   Molds scraped:   ${scraped}`);
  console.log(`   Molds skipped:   ${skipped} (no URL found on IYB)`);
  console.log(`   Molds failed:    ${failed}`);
  console.log(`   Total releases:  ${allReleases.length}`);
  console.log(`   After dedup:     ${dedupedReleases.length}`);

  // 5. Write CSV
  const header = "mold_name,model_number,release_name,color_description,release_year_start,release_year_end";
  const csvRows = dedupedReleases.map(toCsvRow);
  const outputPath = join(__dirname, "..", "supabase", "seed", "reference_releases_seed.csv");
  writeFileSync(outputPath, header + "\n" + csvRows.join("\n") + "\n", "utf-8");
  console.log(`\n💾 Saved to: ${outputPath}`);
  console.log("🏁 Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
