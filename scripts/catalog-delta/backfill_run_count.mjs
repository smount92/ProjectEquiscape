#!/usr/bin/env node
/**
 * run_count backfill — the number was in the title all along.
 *
 * The bulk import kept run sizes in the title text ("BreyerFest Special Run
 * (1,250 made)") and only sometimes lifted them into `run_count`, so the
 * Registry cannot filter or sort by a number it is already displaying.
 *
 *   node scripts/catalog-delta/backfill_run_count.mjs
 *   node scripts/catalog-delta/backfill_run_count.mjs --apply
 *
 * Rules:
 *   * MERGE ONLY. A populated run_count is never overwritten.
 *   * Any row whose title number DISAGREES with a stored run_count is
 *     reported and skipped — that is a real conflict for a human, not
 *     something to resolve by preferring one source.
 *   * Only counts stated as "N made" / "N sets made" / "N pieces made" are
 *     read. A bare number in a title is not a run size.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");

function loadEnv() {
    const out = {};
    for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i === -1) continue;
        out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
    return out;
}

/** "(1,250 made)", "(2,100 sets made)", "(75 pieces made)" -> "1250". */
function runCountFromTitle(title) {
    const m = /\(\s*([\d][\d,]*)\s*(?:sets?|pieces?|pcs)?\s*made\s*\)/i.exec(String(title ?? ""));
    if (!m) return null;
    const n = m[1].replace(/,/g, "");
    if (!/^\d{1,7}$/.test(n) || Number(n) <= 0) return null;
    return n;
}

async function main() {
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const rows = [];
    let from = 0;
    while (true) {
        const { data, error } = await admin.from("catalog_items")
            .select("id, title, attributes").range(from, from + 999);
        if (error) { console.error(error.message); process.exit(1); }
        if (!data.length) break;
        rows.push(...data);
        from += 1000;
        if (data.length < 1000) break;
    }

    let filled = 0, agreed = 0, skipped = 0;
    const conflicts = [];
    for (const r of rows) {
        const fromTitle = runCountFromTitle(r.title);
        if (!fromTitle) continue;
        const attrs = { ...(r.attributes ?? {}) };
        const existing = attrs.run_count == null ? "" : String(attrs.run_count).trim();

        if (existing) {
            if (existing === fromTitle) agreed++;
            else {
                conflicts.push(`${String(r.title).slice(0, 66)}\n      title says ${fromTitle}, stored ${existing}`);
                skipped++;
            }
            continue;
        }

        if (filled < 6) console.log(`  ${APPLY ? "filled" : "would fill"} ${fromTitle.padStart(6)}  ${String(r.title).slice(0, 62)}`);
        if (APPLY) {
            const { error } = await admin.from("catalog_items")
                .update({ attributes: { ...attrs, run_count: fromTitle } }).eq("id", r.id);
            if (error) { console.error(`      x ${error.message}`); continue; }
        }
        filled++;
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${filled} rows ${APPLY ? "backfilled" : "would be backfilled"}`);
    console.log(`  ${agreed} already agreed with the title (left alone)`);
    console.log(`  ${skipped} DISAGREE with the title — skipped, needs a human`);
    for (const c of conflicts.slice(0, 20)) console.log(`  conflict: ${c}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
