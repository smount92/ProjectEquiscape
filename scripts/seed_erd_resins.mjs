#!/usr/bin/env node
/**
 * ============================================================
 * Seed Artist Resins — Imports erd_resins CSV data into the
 * Supabase artist_resins table.
 *
 * Maps CSV columns → DB columns:
 *   resin_name    → resin_name
 *   sculptor      → sculptor_alias
 *   scale         → scale
 *   cast_medium   → 'Resin' (default)
 *
 * Usage:
 *   node scripts/seed_erd_resins.mjs
 *
 * Options:
 *   --dry-run     Parse CSV and show stats without inserting
 *   --append      Don't clear existing data before insert
 * ============================================================
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- Parse args ----
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const APPEND = args.includes("--append");

// ---- Load .env.local ----
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

// ---- CSV parser (handles quoted fields) ----
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
                    i++;
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
    console.log("🎨 Seed Artist Resins — Starting...");
    if (DRY_RUN) console.log("   (DRY RUN — no database changes)\n");
    if (APPEND) console.log("   (APPEND mode — keeping existing data)\n");

    // 1. Find all ERD CSV files and merge them
    const seedDir = join(__dirname, "..", "supabase", "seed");
    const csvFiles = readdirSync(seedDir)
        .filter((f) => f.startsWith("erd_resins") && f.endsWith(".csv"))
        .sort();

    if (csvFiles.length === 0) {
        console.error("❌ No erd_resins*.csv files found in supabase/seed/");
        process.exit(1);
    }

    console.log(`📄 Found ${csvFiles.length} CSV file(s): ${csvFiles.join(", ")}`);

    // 2. Parse all CSVs, dedup by erd_id
    const allRows = new Map(); // erd_id → row object
    let totalParsed = 0;

    for (const file of csvFiles) {
        const content = readFileSync(join(seedDir, file), "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        const dataLines = lines.slice(1); // skip header

        for (const line of dataLines) {
            const fields = parseCsvLine(line);
            if (fields.length < 4) continue;

            const erdId = parseInt(fields[0], 10);
            if (isNaN(erdId)) continue;

            allRows.set(erdId, {
                erd_id: erdId,
                resin_name: fields[1]?.trim() || "",
                sculptor: fields[2]?.trim() || "Unknown",
                scale: fields[3]?.trim() || "Unknown",
            });
            totalParsed++;
        }

        console.log(`   📋 ${file}: ${dataLines.length} rows parsed`);
    }

    const uniqueRows = [...allRows.values()];
    console.log(`\n   Total parsed: ${totalParsed}`);
    console.log(`   Unique (by ERD ID): ${uniqueRows.length}`);

    // 3. Build insert rows
    const insertRows = uniqueRows
        .filter((r) => r.resin_name)
        .map((r) => ({
            sculptor_alias: r.sculptor,
            resin_name: r.resin_name,
            scale: r.scale,
            cast_medium: "Resin",
        }));

    console.log(`   Insert candidates: ${insertRows.length}`);

    // Show scale distribution
    const scaleDist = {};
    for (const r of insertRows) {
        scaleDist[r.scale] = (scaleDist[r.scale] || 0) + 1;
    }
    console.log("\n   📊 Scale distribution:");
    for (const [scale, count] of Object.entries(scaleDist).sort((a, b) => b[1] - a[1])) {
        console.log(`      ${scale.padEnd(25)} ${count}`);
    }

    // Show sculptor distribution (top 15)
    const sculptorDist = {};
    for (const r of insertRows) {
        sculptorDist[r.sculptor_alias] = (sculptorDist[r.sculptor_alias] || 0) + 1;
    }
    const topSculptors = Object.entries(sculptorDist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    console.log("\n   🎨 Top 15 sculptors:");
    for (const [sculptor, count] of topSculptors) {
        console.log(`      ${sculptor.padEnd(35)} ${count}`);
    }

    if (DRY_RUN) {
        console.log("\n🏁 Dry run complete — no data inserted.");
        return;
    }

    // 4. Clear existing data (unless --append)
    if (!APPEND) {
        console.log("\n🗑️  Clearing existing artist_resins data...");
        const { error: deleteError } = await supabase
            .from("artist_resins")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");

        if (deleteError) {
            console.error("   ⚠ Delete warning:", deleteError.message);
        } else {
            console.log("   ✅ Cleared.");
        }
    }

    // 5. Batch insert
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(insertRows.length / BATCH_SIZE);
    let inserted = 0;
    let errors = 0;

    console.log(`\n📥 Inserting ${insertRows.length} resins in ${totalBatches} batches...`);

    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
        const batch = insertRows.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        const { data, error } = await supabase
            .from("artist_resins")
            .insert(batch)
            .select("id");

        if (error) {
            console.error(`   ❌ Batch ${batchNum}/${totalBatches}: ${error.message}`);
            errors += batch.length;
        } else {
            inserted += data.length;
            const pct = Math.round((inserted / insertRows.length) * 100);
            console.log(`   ✅ Batch ${batchNum}/${totalBatches} — ${data.length} rows (${pct}%)`);
        }
    }

    // 6. Summary
    console.log(`\n${"═".repeat(50)}`);
    console.log(`📊 SEED COMPLETE`);
    console.log(`${"═".repeat(50)}`);
    console.log(`   CSV rows:        ${uniqueRows.length}`);
    console.log(`   Rows inserted:   ${inserted}`);
    console.log(`   Insert errors:   ${errors}`);
    console.log(`   Unique sculptors: ${Object.keys(sculptorDist).length}`);
    console.log(`${"═".repeat(50)}`);

    if (errors > 0) {
        console.log("\n⚠ Some inserts failed. Check logs above.");
        process.exit(1);
    } else {
        console.log("\n🎉 All artist resins seeded successfully!");
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
