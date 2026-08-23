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
/**
 * --unlinked extends the repair to rows carrying only ONE signal, on the
 * owner's rule: if no member's horse points at a row, better data wins.
 * The bar is still evidence, not a guess — a lone anachronism says a field
 * is wrong without saying WHICH, so those are still skipped unless a
 * sibling majority names the replacement.
 */
const UNLINKED = process.argv.includes("--unlinked");

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

    /**
     * The sibling rule assumes a model number identifies one release. Some
     * numbers are import placeholders instead: #430040 carries 36 rows with
     * 35 different titles across 3 scales — Misty, a Clydesdale Foal, a Stud
     * Spider. Rows sharing a placeholder are not siblings and say nothing
     * about each other. Assortment numbers legitimately cover ~6 models, so
     * the line sits well above that.
     */
    const PLACEHOLDER_TITLES = 12;
    const placeholder = new Set();
    for (const [n, g] of byNum) {
        if (new Set(g.map((r) => String(r.title))).size > PLACEHOLDER_TITLES) placeholder.add(n);
    }
    if (placeholder.size) {
        console.log(`  ignoring ${placeholder.size} placeholder model number(s): ${[...placeholder].join(", ")}`);
    }

    /**
     * A row whose own title names a scale outranks its siblings. #711298
     * holds two Traditional "Churchill" rows and one "Stablemate Foal
     * Keychain"; the majority would have made the keychain Traditional,
     * against the word in its own name.
     */
    const TITLE_SCALE = [
        [/\btraditional\b/i, "Traditional (1:9)"],
        [/\bstablemates?\b/i, "Stablemate (1:32)"],
        [/\bclassics?\b/i, "Classic (1:12)"],
        [/\bpaddock pal|little bits?\b/i, "Paddock Pal (1:24)"],
    ];
    const titleSaysScale = (title) => TITLE_SCALE.find(([re]) => re.test(String(title)))?.[1] ?? null;

    const siblingSays = new Map();
    for (const [num, g] of byNum) {
        if (g.length < 2 || placeholder.has(num)) continue;
        const tally = new Map();
        for (const r of g) tally.set(r.scale, (tally.get(r.scale) ?? 0) + 1);
        if (tally.size < 2) continue;
        const [[top, n]] = [...tally.entries()].sort((a, b) => b[1] - a[1]);
        // A real majority, not a tie — and never against the row's own name.
        for (const r of g) {
            if (r.scale === top || !(n >= 2 && n > g.length - n)) continue;
            const own = titleSaysScale(r.title);
            if (own && own !== top) {
                console.log(`  held: "${String(r.title).slice(0, 46)}" — its own title says ${own}`);
                continue;
            }
            siblingSays.set(r.id, top);
        }
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

    // ── Second pass: one signal, but nobody has linked the row ──
    let unlinkedFixed = 0, ambiguous = 0, linkedHeld = 0;
    if (UNLINKED) {
        // Only rows a sibling majority can NAME a replacement for. An
        // anachronism on its own says something is wrong without saying
        // what to put instead.
        const nameable = oneSignal.filter((r) => siblingSays.has(r.id));
        ambiguous = oneSignal.length - nameable.length;

        // Live reference check — a row anyone points at is off limits.
        const linked = new Set();
        const ids = nameable.map((r) => r.id);
        for (const [table, col] of [["user_horses", "catalog_id"], ["user_wishlists", "catalog_id"],
                                    ["id_suggestions", "catalog_id"]]) {
            for (let i = 0; i < ids.length; i += 200) {
                const chunk = ids.filter((_, j) => j >= i && j < i + 200);
                if (!chunk.length) continue;
                const { data, error } = await admin.from(table).select(col).in(col, chunk);
                if (error) {
                    console.error(`REFUSING: cannot read ${table}.${col} (${error.message}) — that check is the whole rule.`);
                    process.exit(1);
                }
                for (const row of data ?? []) linked.add(row[col]);
            }
        }

        console.log(`\n── one signal, unlinked rows ──`);
        for (const r of nameable) {
            if (linked.has(r.id)) { linkedHeld++; continue; }
            const to = siblingSays.get(r.id);
            const why = anachronistic.has(r.id)
                ? `${r.scale} predates its line` : `siblings on #${r.attributes?.model_number} say ${to}`;
            console.log(`  ${APPLY ? "fixed" : "would fix"} ${String(r.title).slice(0, 42).padEnd(44)} ${r.scale} -> ${to}   (${why})`);
            if (APPLY) {
                const { error } = await admin.from("catalog_items").update({ scale: to }).eq("id", r.id);
                if (error) { console.error(`      x ${error.message}`); continue; }
            }
            unlinkedFixed++;
        }
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${written} scales ${APPLY ? "corrected" : "would be corrected"} (both signals agree)`);
    if (held) console.log(`  ${held} held because a member set the value`);
    if (UNLINKED) {
        console.log(`  ${unlinkedFixed} more ${APPLY ? "corrected" : "would be corrected"} — one signal, nobody linked`);
        console.log(`  ${linkedHeld} held because a member's horse points at them`);
        console.log(`  ${ambiguous} left alone — a signal says something is wrong but not what to put instead`);
    }
    console.log(`  ${oneSignal.length} rows have ONE signal only${UNLINKED ? "" : " — reported, never written"}`);
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
