#!/usr/bin/env node
/**
 * Attribute enricher — the delta importer's sibling for EXISTING rows.
 *
 * The importer inserts rows that are missing; this merges attribute
 * values into rows that exist. First use: seeding original retail
 * prices (MSRP) researched from primary sources.
 *
 *   node scripts/catalog-delta/enrich_attributes.mjs --data ./found.json
 *   node scripts/catalog-delta/enrich_attributes.mjs --data ./found.json --apply
 *
 * Dataset shape: [ { catalogId, attributes: { retail_price: "59.99", ... },
 *                    source?: "https://..." } ]
 *
 * Rules, non-negotiable:
 *   · MERGE ONLY — a key already present on the row is NEVER overwritten;
 *     the conflict is reported instead. Community corrections beat imports.
 *   · DRY RUN by default; --apply writes via the service-role client.
 *   · Rejects malformed prices (must be 1-5 digits with optional 2dp).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const DATA = (process.argv.find((a) => a.startsWith("--data=")) ?? "").split("=")[1]
    || process.argv[process.argv.indexOf("--data") + 1];

function loadEnv() {
    const out = {};
    const raw = readFileSync(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i === -1) continue;
        out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
    return out;
}

const RUN_TYPES = new Set([
    "Regular Run", "Special Run", "BreyerFest", "Collector's Club",
    "Web Special", "Store Special", "Test Run", "One of a Kind", "Other",
]);

/**
 * Per-key validators. An unlisted key is REJECTED, not passed through —
 * a research agent inventing an attribute name should not be able to mint
 * a catalog field by accident.
 *
 * Strict on purpose: a first bulk run admitted 18 prices as "$75" and one
 * as "$90 for Set" because the price check only ran when the writer
 * happened to look for it. Now every value is validated at the door, and
 * a set price has no shape it can pass as.
 */
const VALIDATORS = {
        retail_price: (v) => /^[0-9]{1,5}([.][0-9]{1,2})?$/.test(String(v)),
    run_type: (v) => RUN_TYPES.has(String(v)),
        run_count: (v) => /^[0-9]{1,7}$/.test(String(v)) && Number(v) > 0,
        release_year_start: (v) => /^[0-9]{4}$/.test(String(v)) && Number(v) >= 1950 && Number(v) <= 2030,
        release_year_end: (v) => /^[0-9]{4}$/.test(String(v)) && Number(v) >= 1950 && Number(v) <= 2030,
        model_number: (v) => /^[A-Za-z0-9#/-]{1,24}$/.test(String(v)),
    color_description: (v) => String(v).length > 0 && String(v).length <= 300,
    sculptor: (v) => String(v).length > 0 && String(v).length <= 120,
    mold_name: (v) => String(v).length > 0 && String(v).length <= 200,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
    if (!DATA) { console.error("Pass --data <file.json>"); process.exit(1); }
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const records = JSON.parse(readFileSync(DATA, "utf8"));
    if (!Array.isArray(records)) { console.error("Dataset must be an array"); process.exit(1); }

    let merged = 0, skippedConflict = 0, skippedBad = 0, missing = 0;
    const conflicts = [];

    for (const rec of records) {
        if (!UUID.test(rec.catalogId ?? "") || typeof rec.attributes !== "object") { skippedBad++; continue; }
        // Validate EVERY key before anything is written.
        let recordOk = true;
        for (const [k, v] of Object.entries(rec.attributes)) {
            if (v == null || v === "") continue;
            const check = VALIDATORS[k];
            if (!check) { console.log(`  ✗ unknown attribute "${k}" — rejected`); recordOk = false; break; }
            if (!check(v)) { console.log(`  ✗ bad ${k}: ${JSON.stringify(v)} — rejected`); recordOk = false; break; }
        }
        if (!recordOk) { skippedBad++; continue; }

        const { data: row } = await admin.from("catalog_items")
            .select("id, title, attributes").eq("id", rec.catalogId).maybeSingle();
        if (!row) { missing++; continue; }

        const current = row.attributes ?? {};
        const additions = {};
        for (const [k, v] of Object.entries(rec.attributes)) {
            if (v == null || v === "") continue;
            if (current[k] != null && current[k] !== "") {
                if (String(current[k]) !== String(v)) {
                    conflicts.push(`${row.title}: ${k} already "${current[k]}", found "${v}"`);
                    skippedConflict++;
                }
                continue; // never overwrite
            }
            additions[k] = v;
        }
        if (Object.keys(additions).length === 0) continue;

        if (APPLY) {
            const { error } = await admin.from("catalog_items")
                .update({ attributes: { ...current, ...additions } }).eq("id", row.id);
            if (error) { console.error(`  ✗ ${row.title}: ${error.message}`); continue; }
        }
        merged++;
        if (merged <= 5) console.log(`  ${APPLY ? "✓" : "would"} merge ${JSON.stringify(additions)} → ${row.title}`);
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${merged} rows ${APPLY ? "updated" : "would update"}, ` +
        `${skippedConflict} conflicts (kept existing), ${skippedBad} malformed, ${missing} ids not found`);
    for (const c of conflicts.slice(0, 10)) console.log("  conflict:", c);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
