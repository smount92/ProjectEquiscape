#!/usr/bin/env node
/**
 * Repair `catalog_items.scale` against identifyyourbreyer.com.
 *
 * WHY IT IS WRONG. Where two Breyer molds share a name (Fighting Stallion
 * exists as both a Traditional and a Stablemate), the import attached every
 * release to ONE mold record and each release inherited that mold's scale.
 * Four researchers measured the damage independently; the sharpest reading:
 * when our catalog says "Stablemate" it is actually Traditional ~92% of the
 * time, while "Traditional" was right 67/67.
 *
 * HOW A ROW QUALIFIES. Three gates, all required:
 *   1. Our model_number matches an IDYB row, and that number appears at
 *      exactly ONE scale in the corpus (numbers living at two scales are
 *      skipped, not guessed).
 *   2. The names corroborate — normalized equality, or one being a prefix of
 *      the other. Token overlap alone is NOT enough: "Grayingham Lucky Lad"
 *      and "Nobel II" both carry "See 20th Anniversary Commemorative Set
 *      page" and scored a perfect overlap while being different horses.
 *   3. The scales actually differ.
 * Everything else is written to a hold file for human review.
 *
 * IDYB's scale is trustworthy because it is structural, not editorial: a row
 * IS the mold page it sits on.
 *
 * UPDATES EXISTING ROWS ONLY — never inserts, so it cannot duplicate.
 * DRY RUN by default; --apply writes.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DATA = (process.argv.find((a) => a.startsWith("--data=")) ?? "").split("=")[1]
    || process.argv[process.argv.indexOf("--data") + 1];

function loadEnv() {
    const out = {};
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i === -1) continue;
        out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
    return out;
}

const VALID_SCALES = new Set([
    "Traditional (1:9)", "Classic (1:12)", "Stablemate (1:32)",
    "Paddock Pal (1:24)", "Mini Whinnie (1:64)", "Other",
]);

async function main() {
    if (!DATA) { console.error("Pass --data <scale-apply.json>"); process.exit(1); }
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const recs = JSON.parse(readFileSync(DATA, "utf8"));

    let changed = 0, skipped = 0, failed = 0, drifted = 0;
    const byDirection = {};

    for (const rec of recs) {
        if (!VALID_SCALES.has(rec.idyb)) { skipped++; continue; }
        // Re-read: the row must still look the way the audit found it.
        const { data: row } = await admin.from("catalog_items")
            .select("id, scale, title").eq("id", rec.id).maybeSingle();
        if (!row) { skipped++; continue; }
        if (row.scale !== rec.ours) { drifted++; continue; }   // someone changed it since the audit
        if (row.scale === rec.idyb) { skipped++; continue; }

        if (APPLY) {
            const { error } = await admin.from("catalog_items").update({ scale: rec.idyb }).eq("id", rec.id);
            if (error) { failed++; continue; }
        }
        changed++;
        const key = `${rec.ours} -> ${rec.idyb}`;
        byDirection[key] = (byDirection[key] || 0) + 1;
        if (changed <= 5) console.log(`  ${APPLY ? "✓" : "would"} #${rec.num} ${String(rec.title).slice(0, 38)} : ${rec.ours} -> ${rec.idyb}`);
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${changed} scales ${APPLY ? "corrected" : "would change"}`);
    for (const [k, v] of Object.entries(byDirection).sort((a, b) => b[1] - a[1])) console.log(`  ${v}  ${k}`);
    if (drifted) console.log(`  ${drifted} skipped — row changed since the audit`);
    if (skipped) console.log(`  ${skipped} skipped — already correct or unresolvable`);
    if (failed) console.log(`  ${failed} FAILED`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
