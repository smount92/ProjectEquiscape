import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const APPLY = process.argv.includes("--apply");
const env = {};
for (const line of readFileSync(".env.local","utf8").split(/\r?\n/)) {
  const t=line.trim(); if(!t||t.startsWith("#"))continue; const i=t.indexOf("=");
  if(i>-1) env[t.slice(0,i).trim()]=t.slice(i+1).trim().replace(/^["']|["']$/g,"");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Twelve rows whose descriptions point into another site's page ordering or
// numbering. Those pointers mean nothing here. Three attempts at a general
// rule each broke a different row — a greedy match ate "with no leg barring",
// a comparative strip left "more dapples than," dangling, and a third left
// "lighter" with nothing to be lighter than. Twelve rows do not need a rule.
// Keyed on the exact current text so a re-run after any edit is a no-op.
// Empty string means the description was nothing BUT the dead pointer.
const FIXES = new Map([
  ['Bay frame overo, wide blaze running down over the muzzle, four stockings, black knees, black mane and tail, same pattern as #90174',
   'Bay frame overo, wide blaze running down over the muzzle, four stockings, black knees, black mane and tail'],
  ['same as "1839"', ''],
  ['fleabitten rose grey, lighter grey points than above', 'fleabitten rose grey, lighter grey points'],
  ['same as above w/dorsal stripe', 'dorsal stripe'],
  ['bay, black points, near fore stocking. Same as "6049"', 'bay, black points, near fore stocking'],
  ['same as "62060"', ''],
  ['"same as 959"', ''],
  ['chestnut, same as #483', 'chestnut'],
  ['dark bay (same as #5655)', 'dark bay'],
  ['black (same as 20012)', 'black'],
  ['dun, same as above with no leg barring', 'dun, no leg barring'],
  ['Dapple grey carrying more dapples than #419025, baldish face, four stockings, darker grey mane and tail',
   'Dapple grey, baldish face, four stockings, darker grey mane and tail'],
]);

const rows=[]; let from=0;
while (true) {
  const { data } = await admin.from("catalog_items").select("id, title, attributes").range(from, from+999);
  if (!data || !data.length) break;
  rows.push(...data); from += 1000; if (data.length < 1000) break;
}
let edited=0, cleared=0, unmatched=[...FIXES.keys()];
for (const r of rows) {
  const was = String(r.attributes?.color_description ?? "");
  if (!FIXES.has(was)) continue;
  const now = FIXES.get(was);
  unmatched = unmatched.filter((k) => k !== was);
  console.log(`  ${r.title}`);
  console.log(`      was: ${was}`);
  console.log(`      now: ${now || "(cleared — nothing but a dead pointer)"}`);
  if (APPLY) {
    const attrs = { ...r.attributes };
    if (now) attrs.color_description = now; else delete attrs.color_description;
    const { error } = await admin.from("catalog_items").update({ attributes: attrs }).eq("id", r.id);
    if (error) { console.error(`      x ${error.message}`); continue; }
  }
  if (now) edited++; else cleared++;
}
console.log(`\n${APPLY?"APPLIED":"DRY RUN"}: ${edited} trimmed, ${cleared} cleared`);
if (unmatched.length) console.log(`  ${unmatched.length} fixes matched nothing (already applied?): ${unmatched.join(" | ")}`);
