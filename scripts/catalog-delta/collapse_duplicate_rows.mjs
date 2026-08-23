#!/usr/bin/env node
/**
 * Duplicate collapse — removes rows that are byte-identical to another row.
 *
 * A full-catalog audit found groups of rows identical on EVERY field that
 * matters: title, maker, scale, item_type, parent mold, and the whole
 * attributes object. They are double-imports, not distinct releases.
 *
 *   node scripts/catalog-delta/collapse_duplicate_rows.mjs
 *   node scripts/catalog-delta/collapse_duplicate_rows.mjs --apply
 *
 * THIS IS THE ONLY DESTRUCTIVE SCRIPT IN THIS DIRECTORY. Everything else
 * here inserts or updates. Read this before running it:
 *
 *   * Every foreign key into catalog_items is ON DELETE SET NULL. Deleting
 *     a row a member's horse points at does not error — it silently
 *     unlinks their model from the catalog. So the survivor of each group
 *     is chosen as THE ROW MEMBERS ALREADY REFERENCE, and references are
 *     re-counted live at run time, never trusted from a snapshot.
 *   * If any group has references spread across MORE THAN ONE row, the
 *     script refuses to run at all. Collapsing that group would orphan
 *     somebody. Repointing has to be a deliberate, separate decision.
 *   * With no references anywhere in a group, the oldest row survives.
 *   * --apply also writes a catalog_changelog 'removal' per deleted row,
 *     so the removal is visible to members rather than silent.
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

/** Every table whose rows point at a catalog item. */
const REFERENCES = [
    ["user_horses", "catalog_id"],
    ["user_wishlists", "catalog_id"],
    ["id_suggestions", "catalog_id"],
    ["catalog_suggestions", "catalog_item_id"],
];

async function main() {
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const rows = [];
    let from = 0;
    while (true) {
        const { data, error } = await admin.from("catalog_items")
            .select("id, title, maker, scale, item_type, parent_id, attributes, created_at")
            .range(from, from + 999);
        if (error) { console.error(error.message); process.exit(1); }
        if (!data.length) break;
        rows.push(...data);
        from += 1000;
        if (data.length < 1000) break;
    }

    const key = (r) => JSON.stringify([r.title, r.maker, r.scale, r.item_type, r.parent_id, r.attributes]);
    const groups = new Map();
    for (const r of rows) {
        const k = key(r);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
    }
    const dupes = [...groups.values()].filter((g) => g.length > 1);
    if (!dupes.length) { console.log("No duplicate rows."); return; }

    // Live reference count — never from a snapshot.
    const ids = dupes.flatMap((g) => g.map((r) => r.id));
    const refCount = new Map(ids.map((id) => [id, 0]));
    for (const [table, col] of REFERENCES) {
        for (let i = 0; i < ids.length; i += 200) {
            const chunk = ids.filter((_, j) => j >= i && j < i + 200);
            const { data, error } = await admin.from(table).select(col).in(col, chunk);
            if (error) { console.error(`cannot read ${table}.${col}: ${error.message}`); process.exit(1); }
            for (const r of data ?? []) refCount.set(r[col], (refCount.get(r[col]) ?? 0) + 1);
        }
    }

    // Refuse the whole run if any group would orphan a member's horse.
    const split = dupes.filter((g) => g.filter((r) => (refCount.get(r.id) ?? 0) > 0).length > 1);
    if (split.length) {
        console.error(`REFUSING TO RUN: ${split.length} group(s) have members pointing at more than one row.`);
        for (const g of split.slice(0, 10)) {
            console.error(`  ${g[0].title}`);
            for (const r of g) console.error(`    ${r.id}  ${refCount.get(r.id) ?? 0} reference(s)`);
        }
        console.error("Repoint those references first; that is a separate decision.");
        process.exit(1);
    }

    let deleted = 0, kept = 0, keptForRef = 0;
    for (const g of dupes) {
        const referenced = g.filter((r) => (refCount.get(r.id) ?? 0) > 0);
        const survivor = referenced[0]
            ?? [...g].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
        if (referenced[0]) keptForRef++;
        kept++;
        const doomed = g.filter((r) => r.id !== survivor.id);

        console.log(`  ${g[0].title.slice(0, 62)}`);
        console.log(`      keep   ${survivor.id}${referenced[0] ? `  (${refCount.get(survivor.id)} member reference(s))` : "  (oldest)"}`);
        for (const d of doomed) console.log(`      ${APPLY ? "DELETE" : "would delete"} ${d.id}`);

        if (APPLY) {
            for (const d of doomed) {
                await admin.from("catalog_changelog").insert({
                    catalog_item_id: null,
                    change_type: "removal",
                    summary: `Removed a duplicate row for "${d.title}" (identical to ${survivor.id})`,
                });
                const { error } = await admin.from("catalog_items").delete().eq("id", d.id);
                if (error) { console.error(`      x ${error.message}`); continue; }
                deleted++;
            }
        } else {
            deleted += doomed.length;
        }
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${dupes.length} duplicate groups, ${kept} rows kept, ` +
        `${deleted} rows ${APPLY ? "deleted" : "would be deleted"}`);
    console.log(`  ${keptForRef} survivors chosen because a member's horse points at them`);
    console.log(`  ${kept - keptForRef} survivors chosen as the oldest row (no references)`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
