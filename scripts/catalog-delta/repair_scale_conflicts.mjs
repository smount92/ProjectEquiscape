#!/usr/bin/env node
/**
 * Scale conflict repair — Traditional moulds filed as Stablemates.
 *
 * A bulk import collapsed the scale on some set members. Five independent
 * reviewers found the same shape: 1958-1970 Breyer moulds — the Old Mold
 * Arabians, Grazing Mare, Buttons and Bows, the basket Donkey — carrying
 * "Stablemate (1:32)" while their own sibling rows say Traditional.
 *
 *   node scripts/catalog-delta/repair_scale_conflicts.mjs
 *   node scripts/catalog-delta/repair_scale_conflicts.mjs --apply
 *   node scripts/catalog-delta/repair_scale_conflicts.mjs --tier=all   (report only)
 *
 * Two independent signals decide confidence:
 *   A. ANACHRONISM — the scale's product line did not exist in the row's
 *      own release year. Stablemates began 1975, Classics 1973, Paddock
 *      Pals 1983, Micro Minis 2019.
 *   B. SIBLINGS — rows sharing this model number overwhelmingly disagree.
 *
 * ONLY rows carrying BOTH signals are written. A row with one signal is
 * reported and left alone, because one signal cannot say WHICH field is
 * wrong: a 1972 Classic Man O' War is just as likely a bad year as a bad
 * scale, and guessing would trade a visible error for an invisible one.
 *
 * A row a member has corrected is never touched, whatever the signals say.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const SHOW_ALL = process.argv.includes("--tier=all");

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

const LINE_BORN = {
    "Stablemate (1:32)": 1975,
    "Classic (1:12)": 1973,
    "Paddock Pal (1:24)": 1983,
    "Micro Mini": 2019,
};
const yearOf = (r) => {
    const v = r.attributes?.release_year_start;
    return /^\d{4}$/.test(String(v ?? "")) ? Number(v) : null;
};

async function main() {
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const rows = [];
    let from = 0;
    while (true) {
        const { data, error } = await admin.from("catalog_items")
            .select("id, title, scale, attributes").range(from, from + 999);
        if (error) { console.error(error.message); process.exit(1); }
        if (!data.length) break;
        rows.push(...data);
        from += 1000;
        if (data.length < 1000) break;
    }

    const anachronistic = new Set();
    for (const r of rows) {
        const born = LINE_BORN[r.scale];
        const y = yearOf(r);
        if (born && y && y < born) anachronistic.add(r.id);
    }

    const byNum = new Map();
    for (const r of rows) {
        const n = r.attributes?.model_number;
        if (!n || !r.scale) continue;
        if (!byNum.has(n)) byNum.set(n, []);
        byNum.get(n).push(r);
    }
    const siblingSays = new Map();
    for (const [, g] of byNum) {
        if (g.length < 2) continue;
        const tally = new Map();
        for (const r of g) tally.set(r.scale, (tally.get(r.scale) ?? 0) + 1);
        if (tally.size < 2) continue;
        const [[top, n]] = [...tally.entries()].sort((a, b) => b[1] - a[1]);
        // A real majority, not a tie.
        for (const r of g) if (r.scale !== top && n >= 2 && n > g.length - n) siblingSays.set(r.id, top);
    }

    const both = rows.filter((r) => anachronistic.has(r.id) && siblingSays.has(r.id));
    const oneSignal = rows.filter((r) => (anachronistic.has(r.id) !== siblingSays.has(r.id)));

    // A member's correction outranks both signals.
    const memberTouched = new Set();
    const ids = both.map((r) => r.id);
    if (ids.length) {
        const { data, error } = await admin.from("catalog_suggestions")
            .select("catalog_item_id, status, field_changes").in("catalog_item_id", ids);
        // A read failure here must not be treated as "nobody objected" —
        // without this check the script has no right to overwrite.
        if (error) {
            console.error(`REFUSING TO RUN: cannot read catalog_suggestions (${error.message}).`);
            console.error("That check is what stops this overwriting a member's own correction.");
            process.exit(1);
        }
        // 'auto_approved' is an approval too — a trusted member's edit that
        // skipped the queue is still the member's edit.
        for (const s of data ?? []) {
            const approved = s.status === "approved" || s.status === "auto_approved";
            const fields = Object.keys(s.field_changes ?? {});
            if (approved && fields.includes("scale")) memberTouched.add(s.catalog_item_id);
        }
    }

    let written = 0, held = 0;
    for (const r of both) {
        const to = siblingSays.get(r.id);
        if (memberTouched.has(r.id)) {
            console.log(`  HELD (a member set this scale) ${String(r.title).slice(0, 50)}`);
            held++;
            continue;
        }
        console.log(`  ${APPLY ? "fixed" : "would fix"} ${String(r.attributes.release_year_start).padEnd(5)} ${String(r.title).slice(0, 44).padEnd(46)} ${r.scale} -> ${to}`);
        if (APPLY) {
            const { error } = await admin.from("catalog_items").update({ scale: to }).eq("id", r.id);
            if (error) { console.error(`      x ${error.message}`); continue; }
        }
        written++;
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${written} scales ${APPLY ? "corrected" : "would be corrected"} (both signals agree)`);
    if (held) console.log(`  ${held} held because a member set the value`);
    console.log(`  ${oneSignal.length} rows have ONE signal only — reported, never written`);
    if (SHOW_ALL) {
        for (const r of oneSignal) {
            const why = anachronistic.has(r.id)
                ? `${r.scale} did not exist in ${r.attributes.release_year_start}`
                : `siblings on #${r.attributes.model_number} say ${siblingSays.get(r.id)}`;
            console.log(`    ${String(r.title).slice(0, 52).padEnd(54)} ${why}`);
        }
    } else {
        console.log("  re-run with --tier=all to list them");
    }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
