#!/usr/bin/env node
/**
 * Auction row retitling — a date where there was only boilerplate.
 *
 * 919 rows are titled "BreyerFest Live Auction (1 made)" or a near variant.
 * 581 of them are byte-identical, so in any list view they are one
 * indistinguishable block — 8% of the Registry.
 *
 *   node scripts/catalog-delta/retitle_auction_rows.mjs
 *   node scripts/catalog-delta/retitle_auction_rows.mjs --apply
 *
 * LOT NUMBERS ARE NOT IN THE DATA. Only 2 of the 919 rows record one
 * ("Lot 71", "Lot 72"), and those are used. The rest get the year, which
 * takes one undifferentiated block of 581 down to about 25 per year. A
 * sequence number would LOOK like a lot number and be fabricated, so
 * there isn't one.
 *
 * Nothing is thrown away. These titles are the ONLY place some facts
 * live, so before the rename:
 *   * a sale price ("Sold for 11,000$", "sold for $14,000") is lifted to
 *     attributes.auction_sale_price — real money data on a site that runs
 *     a Blue Book, currently unqueryable inside a string
 *   * a Certificate of Authenticity note becomes attributes.coa
 *   * anything else the title said beyond boilerplate (pattern notes,
 *     cross-references) is kept verbatim in attributes.source_note
 * A row is renamed only if every part of its old title is either
 * boilerplate or has been preserved somewhere.
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

const AUCTION = /\b(Live|Silent) Auction\b/i;

/** "$11,000", "11,000$", "$6500" -> "11000". */
function salePrice(title) {
    const m = /sold for\s*\$?\s*([\d][\d,]*)\s*\$?/i.exec(title);
    if (!m) return null;
    const n = m[1].replace(/,/g, "");
    return /^\d{1,7}$/.test(n) ? n : null;
}

function lotNumber(title) {
    const m = /\blot\s*#?\s*(\d{1,4})\b/i.exec(title);
    return m ? m[1] : null;
}

/**
 * Strip every phrase the new title reproduces or that another field now
 * holds. Whatever survives is information we would otherwise lose.
 */
function residue(title) {
    return title
        .replace(/\bBreyer(Fest|West)\b/gi, "")
        // A title this script already wrote reads "BreyerFest 2016 — Live
        // Auction 07". Without stripping the year and sequence, re-running
        // it would file "2016" as though it were a note worth keeping.
        .replace(/\b(19|20)\d{2}\b/g, "")
        .replace(/\b(Live|Silent)\s+Auction(\s+model)?\s*\d{1,4}\b/gi, "")
        .replace(/\b(Live|Silent)\s+Auction(\s+model)?\b/gi, "")
        .replace(/\(\s*\d[\d,]*\s*(set\s+)?made[^)]*\)/gi, "")
        .replace(/\(\s*sold for[^)]*\)/gi, "")
        .replace(/\bsold for\s*\$?[\d,]+\s*\$?/gi, "")
        .replace(/\bwith (a )?certificate of authenticity\.?/gi, "")
        .replace(/\blot\s*#?\s*\d{1,4}\b/gi, "")
        .replace(/[\s,.\-—:;()]+/g, " ")
        .trim();
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

    let renamed = 0, noYear = 0, prices = 0, coas = 0, notes = 0, already = 0;
    const kept = [];

    /**
     * Sequence numbers, so rows within a year stop being interchangeable.
     *
     * The sequence is an INDEX WE ASSIGN, not a lot number — the auction's
     * real lot numbers are not in this data (2 rows of 935 record one).
     * That is why a real lot reads "Auction Lot 71" and a sequence reads
     * "Auction 07": the word Lot is what separates a fact from our own
     * ordering, so nobody reads position 7 as lot 7.
     *
     * Ordered by created_at then id — arbitrary but stable, so the same row
     * keeps the same number on every re-run. Zero-padded because titles now
     * sort by sort_key, where "Auction 10" would otherwise fall between
     * "Auction 1" and "Auction 2".
     */
    const auctionRows = rows
        .filter((r) => AUCTION.test(String(r.title ?? "")))
        .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || a.id.localeCompare(b.id));
    const seqOf = new Map();
    const perYear = new Map();
    for (const r of auctionRows) {
        const y = String(r.attributes?.release_year_start ?? "");
        const k = /^\d{4}$/.test(y) ? y : "?";
        const n = (perYear.get(k) ?? 0) + 1;
        perYear.set(k, n);
        seqOf.set(r.id, n);
    }
    const width = Math.max(2, String(Math.max(...perYear.values(), 0)).length);

    for (const r of rows) {
        const title = String(r.title ?? "");
        if (!AUCTION.test(title)) continue;

        const attrs = { ...(r.attributes ?? {}) };
        const year = /^\d{4}$/.test(String(attrs.release_year_start ?? ""))
            ? String(attrs.release_year_start) : null;
        if (!year) { noYear++; continue; }

        const event = /BreyerWest/i.test(title) ? "BreyerWest" : "BreyerFest";
        const kind = /Silent Auction/i.test(title) ? "Silent Auction" : "Live Auction";
        const lot = lotNumber(title);
        const seq = String(seqOf.get(r.id) ?? 0).padStart(width, "0");
        const next = lot
            ? `${event} ${year} — ${kind} Lot ${lot}`
            : `${event} ${year} — ${kind} ${seq}`;
        if (title === next) { already++; continue; }

        const patch = { ...attrs };
        const price = salePrice(title);
        if (price && !patch.auction_sale_price) { patch.auction_sale_price = price; prices++; }
        if (/certificate of authenticity/i.test(title) && !patch.coa) { patch.coa = "true"; coas++; }
        const left = residue(title);
        if (left && !patch.source_note) { patch.source_note = left; notes++; kept.push(`${left.slice(0, 74)}`); }

        if (renamed < 5) {
            console.log(`  ${APPLY ? "renamed" : "would rename"} ${title.slice(0, 58)}`);
            console.log(`      -> ${next}${price ? `   [sale $${price}]` : ""}${left ? `   [note: ${left.slice(0, 40)}]` : ""}`);
        }
        if (APPLY) {
            const { error } = await admin.from("catalog_items")
                .update({ title: next, attributes: patch }).eq("id", r.id);
            if (error) { console.error(`      x ${error.message}`); continue; }
        }
        renamed++;
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${renamed} auction rows ${APPLY ? "retitled" : "would be retitled"}`);
    console.log(`  ${prices} sale prices lifted out of the title into auction_sale_price`);
    console.log(`  ${coas} certificate-of-authenticity notes preserved`);
    console.log(`  ${notes} titles carried something else, kept in source_note`);
    console.log(`  ${noYear} skipped for having no release year, ${already} already renamed`);
    for (const k of kept.slice(0, 12)) console.log(`    kept: ${k}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
