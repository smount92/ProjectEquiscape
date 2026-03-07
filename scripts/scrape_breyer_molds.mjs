/**
 * scrape_breyer_molds.mjs
 * ───────────────────────
 * Scrapes mold reference data from identifyyourbreyer.com and writes a clean
 * CSV file (reference_molds_seed.csv) with columns:
 *
 *   manufacturer, mold_name, scale, release_year_start
 *
 * Targets:
 *   • Traditional     (1:9)
 *   • Classic/Freedom (1:12)
 *   • Paddock Pals    (1:24)
 *   • Stablemates     (1:32)
 *
 * Dependencies:  npm install cheerio
 * Usage:         node scripts/scrape_breyer_molds.mjs
 *
 * NO images are downloaded — only text data.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

// ── Configuration ─────────────────────────────────────────────────────────

const BASE_URL = "https://www.identifyyourbreyer.com";

/** @type {Array<{url: string, scale: string}>} */
const PAGES = [
  { url: `${BASE_URL}/identify/traditional.htm`, scale: "Traditional (1:9)" },
  { url: `${BASE_URL}/identify/Classic/classic.htm`, scale: "Classic (1:12)" },
  {
    url: `${BASE_URL}/identify/PaddockPal/paddockpal.htm`,
    scale: "Paddock Pals (1:24)",
  },
  { url: `${BASE_URL}/identify/Stablemate/sm.htm`, scale: "Stablemate (1:32)" },
];

const MANUFACTURER = "Breyer";

/** Regex to capture the introduction year from text like "Introduced: 1984" */
const YEAR_RE = /Introduced:\s*(\d{4})/;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, "..", "supabase", "seed");
const OUTPUT_FILE = join(OUTPUT_DIR, "reference_molds_seed.csv");

const REQUEST_DELAY_MS = 1500;

// ── Helpers ───────────────────────────────────────────────────────────────

async function fetchPage(url) {
  console.log(`  ↳ Fetching ${url} …`);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function cleanMoldName(raw) {
  return raw.replace(/\s+/g, " ").trim();
}

function csvEscape(value) {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Core extraction ───────────────────────────────────────────────────────

/**
 * Parse mold entries from one index page.
 *
 * Site structure (consistent across all 4 scale pages):
 *   - A single <table> contains all mold entries
 *   - Each <tr> has 4 <td> cells: [photo, name+info, photo, name+info]
 *   - The name <td> contains:
 *       <font size="4"><a href="MoldPage.htm">Mold Name</a></font>
 *       <p><font>Sculpted by: ...<br>Introduced: YYYY<br>Mold #NNN</font></p>
 *   - Some sculptor names are also hyperlinked inside the info text —
 *     these must NOT be confused with mold name links.
 *
 * Strategy:
 *   1. Iterate over every <td> in the table.
 *   2. Look for a <font size="4"> (or size 4-equivalent) containing an <a>.
 *      That <a>'s text is the mold name.
 *   3. Get the full text of the <td> and extract the "Introduced: YYYY" year.
 */
async function extractMolds(url, scale) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  /** @type {Array<{manufacturer: string, mold_name: string, scale: string, release_year_start: number}>} */
  const molds = [];
  const seenNames = new Set();

  // Process every <td> in the page's table(s)
  $("td").each((_i, td) => {
    const $td = $(td);
    const cellText = $td.text();

    // Quick check: does this cell contain "Introduced:" at all?
    if (!cellText.includes("Introduced:")) return;

    // Find the mold name link — it is the <a> inside a <font size="4">
    // (sometimes the font tag has size="4" or size=4)
    let moldName = null;

    // Strategy 1: <font size="4"> > <a>
    $td.find('font[size="4"] > a, font[size="4"] a').each((_j, a) => {
      if (!moldName) {
        const text = $(a).text().trim();
        // Skip image links (empty text or just whitespace)
        // Min length 3 to avoid HTML artifacts from broken links (e.g. "ri", "Li")
        if (text && text.length >= 3) {
          moldName = text;
        }
      }
    });

    // Strategy 2: If no font[size=4] match, look for <a> that appears before
    // "Sculpted by:" in the cell text (fallback for variant markup)
    if (!moldName) {
      $td.find("a").each((_j, a) => {
        if (moldName) return;
        const text = $(a).text().trim();
        const href = $(a).attr("href") || "";
        // Skip image links and external links
        if (
          !text ||
          text.length < 3 ||
          href.endsWith(".jpg") ||
          href.endsWith(".png") ||
          href.endsWith(".gif")
        ) {
          return;
        }
        // The mold link should appear BEFORE the sculptor info in DOM order
        // Check that this isn't a sculptor link (sculptor links appear after
        // "Sculpted by:" in the cell text)
        const textBefore = cellText.substring(0, cellText.indexOf(text));
        if (!textBefore.includes("Sculpted by")) {
          moldName = text;
        }
      });
    }

    if (!moldName) return;

    // Extract the introduction year from the cell text
    const yearMatch = cellText.match(YEAR_RE);
    if (!yearMatch) return;

    const introYear = parseInt(yearMatch[1], 10);
    moldName = cleanMoldName(moldName);
    if (!moldName) return;

    // Deduplicate
    const key = moldName.toLowerCase();
    if (seenNames.has(key)) return;
    seenNames.add(key);

    molds.push({
      manufacturer: MANUFACTURER,
      mold_name: moldName,
      scale,
      release_year_start: introYear,
    });
  });

  return molds;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Breyer Mold Scraper — identifyyourbreyer.com");
  console.log("=".repeat(60));

  let allMolds = [];

  for (const { url, scale } of PAGES) {
    console.log(`\n▸ Scraping scale: ${scale}`);
    const molds = await extractMolds(url, scale);
    console.log(`  ✓ Found ${molds.length} mold(s)`);
    allMolds.push(...molds);
    await sleep(REQUEST_DELAY_MS);
  }

  if (allMolds.length === 0) {
    console.error("\n✗ No molds found — the site structure may have changed.");
    process.exit(1);
  }

  // Sort by scale then mold name
  allMolds.sort((a, b) => {
    const s = a.scale.localeCompare(b.scale);
    return s !== 0 ? s : a.mold_name.localeCompare(b.mold_name);
  });

  // Build CSV
  const header = "manufacturer,mold_name,scale,release_year_start";
  const rows = allMolds.map(
    (m) =>
      `${csvEscape(m.manufacturer)},${csvEscape(m.mold_name)},${csvEscape(m.scale)},${m.release_year_start}`
  );
  const csvContent = [header, ...rows].join("\n") + "\n";

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, csvContent, "utf-8");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ✅ Done! ${allMolds.length} molds written to:`);
  console.log(`     ${OUTPUT_FILE}`);
  console.log(`${"=".repeat(60)}`);

  // Preview
  console.log("\nPreview (first 20 rows):");
  console.log(
    `  ${"manufacturer".padEnd(12)} ${"mold_name".padEnd(42)} ${"scale".padEnd(22)} year`
  );
  console.log(
    `  ${"-".repeat(12).padEnd(12)} ${"-".repeat(42).padEnd(42)} ${"-".repeat(22).padEnd(22)} ----`
  );
  for (const m of allMolds.slice(0, 20)) {
    console.log(
      `  ${m.manufacturer.padEnd(12)} ${m.mold_name.padEnd(42)} ${m.scale.padEnd(22)} ${m.release_year_start}`
    );
  }
  if (allMolds.length > 20) {
    console.log(`  … and ${allMolds.length - 20} more rows`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
