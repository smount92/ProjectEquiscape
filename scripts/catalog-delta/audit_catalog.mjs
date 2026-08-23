#!/usr/bin/env node
/**
 * Catalog health audit — deterministic checks over every row.
 *
 *   node scripts/catalog-delta/audit_catalog.mjs
 *
 * Writes catalog_snapshot.json (the rows as read) and reality_mech.json
 * (the findings), and prints a count per finding kind. Read-only.
 *
 * These are the checks worth automating because they need no judgement:
 * malformed or impossible years, prices and run counts, encoding damage,
 * truncation, rows identical on every field, and titles that are a run
 * blurb rather than a name. Anything requiring judgement — is this colour
 * plausible for this model, is this the right scale — is deliberately NOT
 * here, because a rule that guesses is worse than no rule.
 *
 * A caution learned from writing it: several checks in earlier drafts
 * produced more false positives than findings. "base" in a colour usually
 * means base COAT, not a display base; Paddock Pal is singular in the
 * taxonomy. Widen a pattern only after reading what it actually matches.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const line of readFileSync(".env.local","utf8").split(/\r?\n/)) {
  const t=line.trim(); if(!t||t.startsWith("#"))continue; const i=t.indexOf("=");
  if(i>-1) env[t.slice(0,i).trim()]=t.slice(i+1).trim().replace(/^["']|["']$/g,"");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const rows=[]; let from=0;
while (true) {
  const { data } = await admin.from("catalog_items")
    .select("id, title, item_type, parent_id, maker, scale, attributes").range(from, from+999);
  if (!data || !data.length) break;
  rows.push(...data); from += 1000; if (data.length < 1000) break;
}
writeFileSync("catalog_snapshot.json", JSON.stringify(rows));
console.log(`snapshot: ${rows.length} rows\n`);

const YEAR_NOW = 2026;
const find = [];
const add = (kind, r, detail) => find.push({ kind, id: r.id, title: String(r.title??"").slice(0,80), detail });

for (const r of rows) {
  const a = r.attributes ?? {};
  const t = String(r.title ?? "");
  const ys = a.release_year_start, ye = a.release_year_end;

  if (!t.trim()) add("empty-title", r, "");
  if (t.length > 200) add("title-over-200", r, `${t.length} chars`);
  // Mojibake / encoding damage
  if (/&[a-z]+;|&#\d+;|Ã.|â€|<\?>|\uFFFD/i.test(t)) add("title-encoding", r, t.slice(0,90));
  const cd = String(a.color_description ?? "");
  if (cd && /&[a-z]+;|&#\d+;|Ã.|â€|<\?>|\uFFFD/i.test(cd)) add("colour-encoding", r, cd.slice(0,90));
  // Truncation: ends mid-list
  if (cd && /[,;]\s*$/.test(cd)) add("colour-truncated", r, cd.slice(-50));
  if (/[,;]\s*$/.test(t)) add("title-truncated", r, t.slice(-50));
  // Years
  for (const [k,v] of [["release_year_start",ys],["release_year_end",ye]]) {
    if (v == null || v === "") continue;
    if (!/^\d{4}$/.test(String(v))) { add("year-malformed", r, `${k}="${v}"`); continue; }
    const n = Number(v);
    if (n < 1950 || n > YEAR_NOW + 1) add("year-out-of-range", r, `${k}=${v}`);
  }
  if (ys && ye && /^\d{4}$/.test(String(ys)) && /^\d{4}$/.test(String(ye)) && Number(ye) < Number(ys))
    add("year-end-before-start", r, `${ys} -> ${ye}`);
  // Run count / type
  if (a.run_count != null && a.run_count !== "" && !/^\d{1,7}$/.test(String(a.run_count)))
    add("run-count-malformed", r, `"${a.run_count}"`);
  if (a.run_count && Number(a.run_count) === 1 && a.run_type && a.run_type !== "One of a Kind" && a.run_type !== "Test Run")
    add("one-made-not-ooak", r, `run_type=${a.run_type}`);
  // Price
  if (a.retail_price != null && a.retail_price !== "" && !/^\d{1,5}(\.\d{1,2})?$/.test(String(a.retail_price)))
    add("price-malformed", r, `"${a.retail_price}"`);
  if (a.retail_price && Number(a.retail_price) > 2000) add("price-implausible", r, `$${a.retail_price}`);
  // Model number
  if (a.model_number != null && a.model_number !== "" && !/^[A-Za-z0-9#/\- .]{1,24}$/.test(String(a.model_number)))
    add("model-number-odd", r, `"${a.model_number}"`);
  if (a.model_number && /^(19|20)\d{2}$/.test(String(a.model_number)) && String(a.model_number) === String(ys))
    add("model-number-is-year", r, `#${a.model_number} == year ${ys}`);
  // Colour field holding non-colour data
  if (cd && /\b(base|stand|plaque|certificate|box|packaging|presentation|stamp|sticker|tag)\b/i.test(cd))
    add("colour-holds-non-colour", r, cd.slice(0,80));
  if (cd && /\b(shown|pictured|photo|listing|example above|not original)\b/i.test(cd))
    add("colour-holds-photo-note", r, cd.slice(0,80));
  // Title holding a run blurb instead of a name
  if (/\(\s*[\d,]+\s*(made|sets made|pcs)\s*\)/i.test(t) && !/^[A-Za-z'"]/.test(t.replace(/^["']/,"")))
    add("title-is-run-blurb", r, t.slice(0,80));
  if (/^(BreyerFest|Breyer)?\s*(Live|Silent) Auction/i.test(t)) add("title-auction-no-name", r, t.slice(0,60));
  // Scale sanity
  if (r.scale && !/Traditional|Stablemate|Classic|Paddock Pals|Mini Whinnies|Little Bits|Micro|Other/i.test(String(r.scale)))
    add("scale-unknown", r, String(r.scale));
}
// Duplicate titles within the same maker+scale carrying identical attributes
const seen = new Map();
for (const r of rows) {
  const a = r.attributes ?? {};
  const k = [r.title, r.maker, r.scale, a.model_number, a.color_description, a.release_year_start].join("||");
  if (seen.has(k)) find.push({ kind:"exact-duplicate-row", id:r.id, title:String(r.title).slice(0,80), detail:`same as ${seen.get(k)}` });
  else seen.set(k, r.id);
}

const byKind = new Map();
for (const f of find) byKind.set(f.kind, (byKind.get(f.kind)??0)+1);
console.log("=== mechanical findings ===");
[...byKind.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${k.padEnd(26)} ${String(v).padStart(5)}`));
console.log(`\n  TOTAL ${find.length}`);
writeFileSync("reality_mech.json", JSON.stringify(find,null,1));
for (const [k] of byKind) {
  const ex = find.filter(f=>f.kind===k).slice(0,3);
  console.log(`\n${k}:`);
  ex.forEach(f=>console.log(`   ${f.title} | ${f.detail}`));
}
