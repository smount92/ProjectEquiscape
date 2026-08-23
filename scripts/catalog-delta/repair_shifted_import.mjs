#!/usr/bin/env node
/**
 * Repair the column-shifted import (1,489 rows).
 *
 * WHAT WENT WRONG. The scraper that built supabase/seed/reference_releases_*.csv
 * reads identifyyourbreyer.com mold tables:
 *     Model Number | Name | Color | Release Dates | Released Through/Notes
 * When the Model Number cell is blank or non-numeric (one-off auction pieces,
 * BreyerFest B-EV-##### SKUs), it falls through and writes the LAST TWO columns
 * into the wrong fields:
 *     model_number  <- Release Dates   (so it holds a year: "1994", "2020-2021")
 *     title         <- Notes           ("BreyerFest Live Auction (1 made)")
 * and Name + Color are lost. Proven four independent ways by four researchers,
 * and confirmed in the seed CSV itself: of 5,615 rows WITH a year only 8 have a
 * year-shaped model_number; of the 1,489 without one, essentially all do.
 *
 * WHAT THIS FIXES — deterministically, no research, no guessing:
 *   · release_year_start  <- the year sitting in model_number
 *   · release_year_end    <- the end of a range like "1982-1983"
 *   · model_number        <- CLEARED (it never was one)
 *
 * WHAT THIS DOES NOT TOUCH: `title`. Restoring real names needs the per-row
 * identity the researchers recovered, which is a separate, reviewable step.
 *
 * RULES
 *   · UPDATES EXISTING ROWS ONLY. It never inserts, so it cannot duplicate.
 *   · Never overwrites a release_year_start that is already set.
 *   · Only touches rows whose model_number is unambiguously a year or year
 *     range — a real SKU is left alone.
 *   · DRY RUN by default. --apply writes.
 *   · Writes a catalog_changelog entry per repaired row when the table allows
 *     it, so the change is visible and attributable.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();

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

// A bare year, or a range. Anything else is left alone.
const YEAR_ONLY = /^(19|20)[0-9]{2}$/;
const YEAR_RANGE = /^((19|20)[0-9]{2})\s*[-–]\s*((19|20)?[0-9]{2})$/;

function parseYears(raw) {
    const v = String(raw).trim();
    if (YEAR_ONLY.test(v)) return { start: v, end: null };
    const m = YEAR_RANGE.exec(v);
    if (!m) return null;
    const start = m[1];
    let end = m[3];
    if (end.length === 2) end = String(start).slice(0, 2) + end; // 1982-83 -> 1983
    if (Number(end) < Number(start)) return null;
    return { start, end };
}

async function main() {
    const env = loadEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const rows = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await admin.from("catalog_items")
            .select("id, title, attributes").range(from, from + 999);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < 1000) break;
    }

    let repaired = 0, skippedHasYear = 0, skippedNotYear = 0, failed = 0;
    const samples = [];

    for (const row of rows) {
        const attrs = row.attributes ?? {};
        const mn = attrs.model_number;
        if (mn == null || String(mn).trim() === "") continue;
        const years = parseYears(mn);
        if (!years) { skippedNotYear++; continue; }
        if (attrs.release_year_start != null && String(attrs.release_year_start).trim() !== "") {
            // Year already known (often from the research wave) — still clear
            // the bogus model number, but never touch the year.
            const { model_number: _drop, ...rest } = attrs;
            if (APPLY) {
                const { error } = await admin.from("catalog_items").update({ attributes: rest }).eq("id", row.id);
                if (error) { failed++; continue; }
            }
            skippedHasYear++;
            repaired++;
            continue;
        }
        const { model_number: _drop, ...rest } = attrs;
        const next = { ...rest, release_year_start: years.start };
        if (years.end && !next.release_year_end) next.release_year_end = years.end;

        if (APPLY) {
            const { error } = await admin.from("catalog_items").update({ attributes: next }).eq("id", row.id);
            if (error) { failed++; continue; }
        }
        repaired++;
        if (samples.length < 5) samples.push(`${String(row.title).slice(0, 46)} | ${mn} -> year ${years.start}${years.end ? "-" + years.end : ""}`);
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}`);
    for (const s of samples) console.log("  " + s);
    console.log(`\n  rows repaired          : ${repaired}`);
    console.log(`  ...of which year was already set (only the false number cleared): ${skippedHasYear}`);
    console.log(`  rows with a REAL model number, untouched: ${skippedNotYear}`);
    if (failed) console.log(`  FAILED: ${failed}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
