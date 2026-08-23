#!/usr/bin/env node
/**
 * Description rewriter — replaces colour descriptions with our own prose.
 *
 * The catalog's colour descriptions were imported verbatim from a hobby
 * reference site. The FACTS in them are free to state; the SENTENCES were
 * someone else's. This writes our own sentences back over them, keeping
 * every fact.
 *
 *   node scripts/catalog-delta/rewrite_descriptions.mjs --data scripts/catalog-delta/data/description_rewrites.json
 *   node scripts/catalog-delta/rewrite_descriptions.mjs --data scripts/catalog-delta/data/description_rewrites.json --apply
 *
 * Dataset shape: [ { id, title, expect, next } ]
 *
 * Rules, non-negotiable:
 *   · This is the ONLY script here that overwrites a populated field, so it
 *     carries the guard the merge-only enricher does not need: a row is
 *     written ONLY IF it still holds `expect` verbatim. If a member has
 *     corrected the description since the batch was cut, their correction
 *     stands and we skip. Corrections beat imports — including this one.
 *   · DRY RUN by default; --apply writes via the service-role client.
 *   · Only `color_description` is touched. Every other attribute is
 *     carried through untouched.
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

async function main() {
    if (!DATA) { console.error("Pass --data <file.json>"); process.exit(1); }
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const records = JSON.parse(readFileSync(DATA, "utf8"));
    if (!Array.isArray(records)) { console.error("Dataset must be an array"); process.exit(1); }

    let written = 0, alreadyOurs = 0, drifted = 0, missing = 0, bad = 0;
    const drift = [];

    // Read in chunks; write one row at a time so a single bad row cannot
    // take the batch down with it.
    const CHUNK = 200;
    for (let i = 0; i < records.length; i += CHUNK) {
        const slice = records.filter((r, j) => j >= i && j < i + CHUNK);
        const ids = slice.filter((r) => UUID.test(r.id ?? "")).map((r) => r.id);
        bad += slice.length - ids.length;
        if (!ids.length) continue;

        const { data: rows, error } = await admin.from("catalog_items")
            .select("id, title, attributes").in("id", ids);
        if (error) { console.error(`read failed: ${error.message}`); process.exit(1); }
        const byId = new Map((rows ?? []).map((r) => [r.id, r]));

        for (const rec of slice) {
            const row = byId.get(rec.id);
            if (!row) { missing++; continue; }
            const attrs = row.attributes ?? {};
            const live = norm(attrs.color_description);

            if (live === norm(rec.next)) { alreadyOurs++; continue; }
            if (live !== norm(rec.expect)) {
                drifted++;
                if (drift.length < 15) {
                    drift.push(`${row.title}\n      live: ${live || "(empty)"}\n      expected: ${norm(rec.expect)}`);
                }
                continue;
            }
            if (!rec.next || rec.next.length > 300) { bad++; continue; }

            if (APPLY) {
                const { error: wErr } = await admin.from("catalog_items")
                    .update({ attributes: { ...attrs, color_description: rec.next } })
                    .eq("id", row.id);
                if (wErr) { console.error(`  x ${row.title}: ${wErr.message}`); continue; }
            }
            written++;
            if (written <= 6) {
                console.log(`  ${APPLY ? "wrote" : "would write"} ${row.title}`);
                console.log(`      was: ${norm(rec.expect)}`);
                console.log(`      now: ${rec.next}`);
            }
        }
        process.stdout.write(`  ...${Math.min(i + CHUNK, records.length)}/${records.length}\r`);
    }

    console.log(`\n\n${APPLY ? "APPLIED" : "DRY RUN"}: ${written} rows ${APPLY ? "rewritten" : "would be rewritten"}`);
    console.log(`  ${alreadyOurs} already carry the new text (re-run is safe)`);
    console.log(`  ${drifted} changed since the batch was cut — SKIPPED, member text kept`);
    console.log(`  ${missing} ids not found, ${bad} malformed`);
    for (const d of drift) console.log(`  drift: ${d}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
