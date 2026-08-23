#!/usr/bin/env node
/**
 * Spelling normalisation — "colour" inside a compound word.
 *
 * The description rewrite normalised house spelling with /\bcolour/, which
 * requires a word boundary before the c. Compounds have none, so
 * "bicolour", "tricolour" and "multicoloured" survived into the catalog
 * while 148 other occurrences became "color". Caught by reading the live
 * page after deploy, not by any check.
 *
 *   node scripts/catalog-delta/normalize_colour_spelling.mjs
 *   node scripts/catalog-delta/normalize_colour_spelling.mjs --apply
 *
 * The rule is unconditional because it is safe to be: this catalog is US
 * spelling throughout and "colour" is never the correct form here. No word
 * boundary anywhere in the pattern — that was the bug.
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

const fix = (s) => String(s).replace(/colour/g, "color").replace(/Colour/g, "Color");

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

    let changed = 0;
    for (const r of rows) {
        const attrs = { ...(r.attributes ?? {}) };
        const was = attrs.color_description == null ? null : String(attrs.color_description);
        if (!was || !/colour/i.test(was)) continue;
        const now = fix(was);
        if (now === was) continue;

        console.log(`  ${APPLY ? "fixed" : "would fix"} ${String(r.title).slice(0, 34)}`);
        console.log(`      ${was.slice(0, 88)}`);
        console.log(`   -> ${now.slice(0, 88)}`);
        if (APPLY) {
            const { error } = await admin.from("catalog_items")
                .update({ attributes: { ...attrs, color_description: now } }).eq("id", r.id);
            if (error) { console.error(`      x ${error.message}`); continue; }
        }
        changed++;
    }
    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${changed} descriptions ${APPLY ? "normalised" : "would be normalised"}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
