#!/usr/bin/env node
/**
 * ============================================================
 * Seed Reference Releases — Imports reference_releases_seed.csv
 * into the Supabase reference_releases table.
 *
 * Logic:
 *  1. Reads the CSV file (mold_name → release data)
 *  2. Queries reference_molds to build a mold_name → UUID map
 *  3. Matches each CSV row to a mold_id
 *  4. Batch inserts into reference_releases (skips duplicates)
 *
 * Requirements:
 *  - SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 *    (get it from Supabase Dashboard → Settings → API → service_role)
 *  - npm install @supabase/supabase-js (already installed)
 *
 * Usage:
 *   node scripts/seed_releases.mjs
 * ============================================================
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- Load .env.local manually (no dotenv dependency) ----
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

// ---- Validate environment ----
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("");
  console.error("   To fix this, add the following line to your .env.local file:");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here");
  console.error("");
  console.error("   You can find it in your Supabase Dashboard:");
  console.error("   → Settings → API → Project API Keys → service_role (secret)");
  process.exit(1);
}

// ---- Create Supabase admin client (bypasses RLS) ----
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- CSV Parser (handles quoted fields with commas) ----
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ---- MAIN ----
async function main() {
  console.log("🐴 Seed Reference Releases — Starting...\n");

  // 1. Read CSV
  const csvPath = join(__dirname, "..", "supabase", "seed", "reference_releases_seed.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter((l) => l.trim());
  const header = lines[0];
  const dataLines = lines.slice(1);

  console.log(`📄 CSV loaded: ${dataLines.length} release rows`);

  // Parse CSV rows
  const csvRows = dataLines.map((line) => {
    const fields = parseCsvLine(line);
    return {
      mold_name: fields[0]?.trim() || "",
      model_number: fields[1]?.trim() || null,
      release_name: fields[2]?.trim() || "",
      color_description: fields[3]?.trim() || null,
      release_year_start: fields[4]?.trim() ? parseInt(fields[4], 10) : null,
      release_year_end: fields[5]?.trim() ? parseInt(fields[5], 10) : null,
    };
  }).filter((r) => r.mold_name && r.release_name);

  console.log(`   Parsed ${csvRows.length} valid release rows`);

  // 2. Fetch ALL reference_molds to build the name → UUID map
  console.log("\n📦 Fetching reference_molds from Supabase...");
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

  console.log(`   Found ${allMolds.length} molds in database`);

  // Build lookup map: mold_name (lowercase) → array of { id, scale }
  // Multiple molds can share a name across scales
  const moldMap = new Map();
  for (const mold of allMolds) {
    const key = mold.mold_name.toLowerCase();
    if (!moldMap.has(key)) moldMap.set(key, []);
    moldMap.get(key).push(mold);
  }

  // 3. Match CSV rows to mold_ids
  console.log("\n🔗 Matching releases to mold UUIDs...");
  const insertRows = [];
  let matched = 0;
  let unmatched = 0;
  const unmatchedNames = new Set();

  for (const row of csvRows) {
    const key = row.mold_name.toLowerCase();
    const candidates = moldMap.get(key);

    if (!candidates || candidates.length === 0) {
      unmatched++;
      unmatchedNames.add(row.mold_name);
      continue;
    }

    // If multiple molds with same name (different scales), pick the first match
    // This is fine since the release is linked to the mold, not the scale
    const mold = candidates[0];

    insertRows.push({
      mold_id: mold.id,
      model_number: row.model_number || null,
      release_name: row.release_name,
      color_description: row.color_description || null,
      release_year_start: isNaN(row.release_year_start) ? null : row.release_year_start,
      release_year_end: isNaN(row.release_year_end) ? null : row.release_year_end,
    });
    matched++;
  }

  console.log(`   ✅ Matched:   ${matched} releases`);
  console.log(`   ⚠ Unmatched: ${unmatched} releases (mold not found in DB)`);

  if (unmatchedNames.size > 0 && unmatchedNames.size <= 20) {
    console.log(`   Unmatched mold names: ${[...unmatchedNames].join(", ")}`);
  } else if (unmatchedNames.size > 20) {
    console.log(`   First 20 unmatched: ${[...unmatchedNames].slice(0, 20).join(", ")}...`);
  }

  if (insertRows.length === 0) {
    console.log("\n⚠ No rows to insert. Exiting.");
    process.exit(0);
  }

  // 4. Clear existing reference_releases data (fresh seed)
  console.log("\n🗑️  Clearing existing reference_releases data...");
  const { error: deleteError } = await supabase
    .from("reference_releases")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

  if (deleteError) {
    console.error("   ⚠ Delete warning:", deleteError.message);
    console.log("   Continuing anyway (table may already be empty)...");
  } else {
    console.log("   ✅ Cleared.");
  }

  // 5. Batch insert (Supabase has ~1000 row limit per request)
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(insertRows.length / BATCH_SIZE);
  let inserted = 0;
  let errors = 0;

  console.log(`\n📥 Inserting ${insertRows.length} releases in ${totalBatches} batches...`);

  for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
    const batch = insertRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { data, error } = await supabase
      .from("reference_releases")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`   ❌ Batch ${batchNum}/${totalBatches} failed: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += data.length;
      const pct = Math.round((inserted / insertRows.length) * 100);
      console.log(`   ✅ Batch ${batchNum}/${totalBatches} — ${data.length} rows (${pct}% complete)`);
    }
  }

  // 6. Summary
  console.log(`\n${"═".repeat(50)}`);
  console.log(`📊 SEED COMPLETE`);
  console.log(`${"═".repeat(50)}`);
  console.log(`   CSV rows parsed:    ${csvRows.length}`);
  console.log(`   Mold matches:       ${matched}`);
  console.log(`   Rows inserted:      ${inserted}`);
  console.log(`   Insert errors:      ${errors}`);
  console.log(`   Unmatched (skipped): ${unmatched}`);
  console.log(`${"═".repeat(50)}`);

  if (errors > 0) {
    console.log("\n⚠ Some inserts failed. Check the errors above.");
    process.exit(1);
  } else {
    console.log("\n🎉 All releases seeded successfully!");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
