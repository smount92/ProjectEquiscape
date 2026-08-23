#!/usr/bin/env node
/**
 * Import-damage repair — encoding corruption, truncation, photo captions.
 *
 * Three small classes of damage found by a full-catalog audit, all of them
 * unambiguous:
 *
 *   1. Three titles carry U+FFFD where a character was lost in transit —
 *      an apostrophe in two of them, an n-tilde in the third.
 *   2. Seventeen values end on a dangling comma, meaning the import
 *      truncated a list. Trimming the comma does not restore the lost
 *      marking; it stops the catalog rendering an obvious bug. The rows
 *      are listed in the audit so they can be re-sourced.
 *   3. Two colour fields ended in a caption about the source's own
 *      photographs, which describes a photo we do not have.
 *
 *   node scripts/catalog-delta/repair_import_damage.mjs
 *   node scripts/catalog-delta/repair_import_damage.mjs --apply
 *
 * Named replacements are an explicit table, not a rule. A general rule was
 * tried for a sibling repair and broke a different row on each of three
 * attempts; a handful of rows do not need a rule.
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

// Exact current text -> intended text. Keyed on the text so a re-run after
// any edit is a no-op rather than a second, wrong, correction.
const TITLE_FIXES = new Map([
    ["Black Beauty With a paperback version of Anna Sewell\uFFFDs novel Black Beauty.",
     "Black Beauty With a paperback version of Anna Sewell's novel Black Beauty."],
    ["Charm with Canterwood Crest\uFFFDs Take the Reins Includes Take the Reins paperback novel by Jessica Burkhart. Some autographed by author.",
     "Charm with Canterwood Crest's Take the Reins Includes Take the Reins paperback novel by Jessica Burkhart. Some autographed by author."],
    ["So\uFFFDador With winners' circle yellow flower blanket",
     "So\u00F1ador With winners' circle yellow flower blanket"],
]);

const COLOUR_FIXES = new Map([
    // "matte pictured" describes the source's photograph, not the model.
    // The matte/semigloss fact is already stated at the front.
    ["Matte and semigloss bay, bald face, four stockings, black mane and tail; matte pictured",
     "Matte and semigloss bay, bald face, four stockings, black mane and tail"],
    // "third photo is of a chalky" points at an image we do not have; the
    // fact it carries is that a chalky variation exists.
    ["grey third photo is of a chalky", "grey, some chalky"],
]);

const trimTrailing = (s) => String(s).replace(/\s*[,;]+\s*$/, "").trim();

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

    let encTitle = 0, encColour = 0, trimTitle = 0, trimColour = 0;
    for (const r of rows) {
        const title = String(r.title ?? "");
        const attrs = { ...(r.attributes ?? {}) };
        const colour = attrs.color_description == null ? null : String(attrs.color_description);

        let nextTitle = title;
        let nextColour = colour;

        if (TITLE_FIXES.has(title)) { nextTitle = TITLE_FIXES.get(title); encTitle++; }
        if (colour != null && COLOUR_FIXES.has(colour)) { nextColour = COLOUR_FIXES.get(colour); encColour++; }

        if (nextTitle === title && /[,;]\s*$/.test(title)) { nextTitle = trimTrailing(title); trimTitle++; }
        if (nextColour != null && nextColour === colour && /[,;]\s*$/.test(colour)) {
            nextColour = trimTrailing(colour); trimColour++;
        }

        if (nextTitle === title && nextColour === colour) continue;

        console.log(`  ${APPLY ? "fixed" : "would fix"} ${title.slice(0, 56)}`);
        if (nextTitle !== title) console.log(`      title : ${JSON.stringify(title.slice(-46))} -> ${JSON.stringify(nextTitle.slice(-46))}`);
        if (nextColour !== colour) console.log(`      colour: ${JSON.stringify(String(colour).slice(-46))} -> ${JSON.stringify(String(nextColour).slice(-46))}`);

        if (APPLY) {
            const patch = {};
            if (nextTitle !== title) patch.title = nextTitle;
            if (nextColour !== colour) patch.attributes = { ...attrs, color_description: nextColour };
            const { error } = await admin.from("catalog_items").update(patch).eq("id", r.id);
            if (error) { console.error(`      x ${error.message}`); continue; }
        }
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${encTitle} title encodings, ${encColour} photo captions, ` +
        `${trimTitle} titles and ${trimColour} colours trimmed of a dangling comma`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
