#!/usr/bin/env node
/**
 * Material repair — rows whose own title names a material the row denies.
 *
 * "English Shire Porcelain" recorded as Plastic; "Status Symbol (china)"
 * recorded as Resin. The title states the material outright, so the row
 * contradicts itself in plain text.
 *
 *   node scripts/catalog-delta/repair_material.mjs
 *   node scripts/catalog-delta/repair_material.mjs --apply
 *
 * Vocabulary note: the values here come from the product's own list in
 * SuggestNewEntryForm — Plastic, Resin, Pewter, China, Metal, Other.
 * Porcelain maps to CHINA rather than adding a "Porcelain" value: a value
 * the suggest form cannot produce would be a facet members can see but
 * never file into.
 *
 * Only STRONG title evidence counts. A horse named Crystal is not a
 * crystal horse, and an Olympic Bronze Medal Winner is not made of
 * bronze — both were caught rejecting a looser rule, and both are left
 * alone here.
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

// The material word has to be unambiguous in context — a parenthetical, or
// the word "porcelain" itself, which is not used as a horse's name.
const EVIDENCE = [
    [/\(\s*china\s*\)/i, "China"],
    [/\bfine china\b|\bbone china\b/i, "China"],
    [/\bporcelain\b/i, "China"],
    [/\bfine crystal\b|\bcrystalworks\b/i, "Other"], // no Crystal in the vocabulary
];

/**
 * A material named in the title is not always the HORSE's material. The
 * Elegance Collection Dressage Set lists "an 8\" porcelain dressage rider
 * figure" — the rider is porcelain, the horse is the plastic Breyer model,
 * and its sibling rows on model 1191 say Plastic. Any material word
 * attached to an accessory is evidence about the accessory only.
 */
const ACCESSORY = /\b(?:china|porcelain|crystal|pewter|bronze)\b[^.,]{0,24}\b(?:rider|figure|figurine|doll|ornament)\b/i;
// Deliberately NOT in that list: base, box, trunk, plaque. A model is
// routinely "porcelain on base" or "porcelain in a keepsake box", where the
// material still belongs to the horse — including "base" held Hidalgo
// Porcelain, which is exactly the kind of row this repair exists for.

async function main() {
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const rows = [];
    let from = 0;
    while (true) {
        const { data, error } = await admin.from("catalog_items")
            .select("id, title, item_type, maker, attributes").range(from, from + 999);
        if (error) { console.error(error.message); process.exit(1); }
        if (!data.length) break;
        rows.push(...data);
        from += 1000;
        if (data.length < 1000) break;
    }

    let changed = 0, alreadyRight = 0;
    for (const r of rows) {
        const title = String(r.title ?? "");
        const hit = EVIDENCE.find(([re]) => re.test(title));
        if (!hit) continue;
        if (ACCESSORY.test(title)) {
            console.log(`  held  ${title.slice(0, 52)} — the material belongs to an accessory`);
            continue;
        }
        const should = hit[1];
        const attrs = { ...(r.attributes ?? {}) };
        const now = String(attrs.material ?? "");
        if (now === should) { alreadyRight++; continue; }

        console.log(`  ${APPLY ? "fixed" : "would fix"} ${title.slice(0, 52).padEnd(54)} ${now || "(none)"} -> ${should}`);
        // cast_medium is a free-text sibling of material; if it repeats the
        // wrong value, correct it too rather than leave the row disagreeing
        // with itself in a second place.
        const patch = { ...attrs, material: should };
        if (attrs.cast_medium && String(attrs.cast_medium) === now) patch.cast_medium = should;

        if (APPLY) {
            const { error } = await admin.from("catalog_items").update({ attributes: patch }).eq("id", r.id);
            if (error) { console.error(`      x ${error.message}`); continue; }
        }
        changed++;
    }
    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${changed} materials ${APPLY ? "corrected" : "would be corrected"}, ${alreadyRight} already right`);
    console.log("  Porcelain is recorded as China — the vocabulary's ceramic value.");
    console.log("  The one Fine Crystal row becomes Other; the list has no Crystal.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
