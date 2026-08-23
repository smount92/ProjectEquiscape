#!/usr/bin/env node
/**
 * Title restorer — puts real model names back where prose stood.
 *
 * Two kinds of damage, both from the same bulk import:
 *   · The title is a run blurb with no name in it at all ("BreyerFest
 *     Special Run (1,250 made)Split run of loose mane and braided mane
 *     mold variations"). The name was never captured.
 *   · The title carries the source site's own page navigation
 *     ("1993 Grayingham Lucky Lad See 20th Anniversary Commemorative Set
 *     page"). The name is there; a pointer to another site's layout is
 *     stapled to it.
 *
 *   node scripts/catalog-delta/restore_titles.mjs --data scripts/catalog-delta/data/title_fixes.json
 *   node scripts/catalog-delta/restore_titles.mjs --data scripts/catalog-delta/data/title_fixes.json --apply
 *
 * Rules:
 *   · A row is written ONLY IF it still holds `expectTitle` verbatim. A
 *     member's correction beats this import, so drift means skip.
 *   · `fill` is MERGE ONLY — it fills blank attributes and never
 *     overwrites a populated one.
 *   · The run counts these blurbs carried are already in `run_count`, so
 *     replacing the title loses no fact. Verified before this ran.
 *   · DRY RUN by default.
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

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

async function main() {
    if (!DATA) { console.error("Pass --data <file.json>"); process.exit(1); }
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const records = JSON.parse(readFileSync(DATA, "utf8"));

    let renamed = 0, filled = 0, already = 0, drifted = 0, missing = 0;
    for (const rec of records) {
        const { data: row } = await admin.from("catalog_items")
            .select("id, title, attributes").eq("id", rec.id).maybeSingle();
        if (!row) { missing++; continue; }

        const live = norm(row.title);
        if (live === norm(rec.nextTitle)) { already++; continue; }
        if (live !== norm(rec.expectTitle)) {
            drifted++;
            console.log(`  drift, skipped: "${live}"`);
            continue;
        }

        const attrs = { ...(row.attributes ?? {}) };
        const additions = {};
        for (const [k, v] of Object.entries(rec.fill ?? {})) {
            if (attrs[k] != null && attrs[k] !== "") continue; // never overwrite
            additions[k] = v;
        }

        console.log(`  ${APPLY ? "wrote" : "would write"} "${rec.nextTitle}"`);
        console.log(`      was: ${live.slice(0, 90)}`);
        if (Object.keys(additions).length) console.log(`      fills: ${JSON.stringify(additions)}`);

        if (APPLY) {
            const patch = { title: rec.nextTitle };
            if (Object.keys(additions).length) patch.attributes = { ...attrs, ...additions };
            const { error } = await admin.from("catalog_items").update(patch).eq("id", row.id);
            if (error) { console.error(`      x ${error.message}`); continue; }
        }
        renamed++;
        filled += Object.keys(additions).length;
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${renamed} titles ${APPLY ? "restored" : "would be restored"}, ${filled} blank attributes filled`);
    console.log(`  ${already} already carry the name (re-run is safe)`);
    console.log(`  ${drifted} changed since staging — SKIPPED, ${missing} ids not found`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
