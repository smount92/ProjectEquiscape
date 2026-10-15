// Builds the MHH-003 review list and the format repair SQL from the live
// Registry (public key, read-only). Run from the repo root:
//   node scripts/catalog-delta/gen_format_repair_2026_10.mjs
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
async function page(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(path + " " + r.status);
    const rows = await r.json(); out.push(...rows); if (rows.length < 1000) break;
  }
  return out;
}
const items = await page("catalog_items?select=id,title,item_type,maker,artist,manufacturer,parent_id,maker_slug,slug,attributes&order=id");
const byId = new Map(items.map((i) => [i.id, i]));
const q = (s) => (s === null || s === undefined ? "NULL" : "'" + String(s).replace(/'/g, "''") + "'");

// ── Names one or two letters apart ──
const norm = (s) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, x) => [x]); for (let y = 1; y <= b.length; y++) d[0][y] = y; for (let x = 1; x <= a.length; x++) for (let y = 1; y <= b.length; y++) d[x][y] = Math.min(d[x - 1][y] + 1, d[x][y - 1] + 1, d[x - 1][y - 1] + (a[x - 1] === b[y - 1] ? 0 : 1)); return d[a.length][b.length]; };
const count = {};
for (const i of items) for (const c of ["maker", "artist", "manufacturer"]) if (i[c]) count[i[c]] = (count[i[c]] ?? 0) + 1;
const names = Object.keys(count);
// Close spellings form groups (a chain of typos is one group); each group
// merges into its most common spelling.
const parent = new Map(names.map((n) => [n, n]));
const find = (n) => (parent.get(n) === n ? n : find(parent.get(n)));
for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
  const x = norm(names[a]), y = norm(names[b]);
  const close = x === y || (x.length > 6 && y.length > 6 && Math.abs(x.length - y.length) <= 2 && lev(x, y) <= 2);
  if (close) parent.set(find(names[a]), find(names[b]));
}
const groups = new Map();
for (const n of names) { const r = find(n); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(n); }
const pairs = [];
for (const g of groups.values()) {
  if (g.length < 2) continue;
  g.sort((a, b) => count[b] - count[a]);
  const keep = g[0];
  for (const drop of g.slice(1)) pairs.push({ keep, drop, keepN: count[keep], dropN: count[drop], tie: count[keep] === count[drop] });
}
pairs.sort((p, r) => r.keepN - p.keepN);

// ── Titles that hold a description ──
// Same rule as hasTrailingPunctuation/tidyName in src/lib/catalog/corrections.ts.
const ABBREVIATION_END = /(?:\b[A-Za-z]|\b(?:Co|Jr|Sr|Inc|Ltd|St|Mr|Mrs|Ms|Dr|No|Bros|Corp|Mt|vs))\.$/;
const stray = (t) => /[.,;:]$/.test(t.trim()) && !ABBREVIATION_END.test(t.trim());
const tidy = (t) => { let v = t.replace(/\s+/g, " ").trim(); while (stray(v)) v = v.slice(0, -1).trimEnd(); return v; };
const rel = items.filter((i) => stray(i.title));
// Mold pages find the sets a mold was sold in by reading "With <mold>" in
// set titles, so any title whose "with" part names a known mold keeps it.
const moldNames = [...new Set(items.filter((i) => i.item_type === "plastic_mold")
  .map((m) => m.title.replace(/\(\s*g[1-6]\s*\)/gi, "").trim().toLowerCase())
  .filter((t) => t.length >= 5))];
const namesAMold = (t) => {
  const w = t.toLowerCase().indexOf(" with ");
  if (w < 0) return false;
  const tail = t.slice(w).toLowerCase();
  return moldNames.some((m) => tail.includes(m));
};
const looksLikeSet = (t) => (/\b(set|collection|assortment|gift|box|series|family|pack|kit)\b/i.test(t) && /\bwith\b/i.test(t)) || namesAMold(t);
const titleRows = rel.map((i) => {
  const t = i.title.trim();
  if (looksLikeSet(t)) return { i, kind: "set", title: tidy(t), note: null };
  const w = t.search(/\s+With\s+/);
  const s = t.search(/\.\s+[A-Z]/);
  const cut = [w, s].filter((n) => n > 2).sort((a, b) => a - b)[0];
  if (cut === undefined) return { i, kind: "trim", title: tidy(t), note: null };
  const name = tidy(t.slice(0, cut));
  const rest = t.slice(cut).replace(/^\.\s*/, "").trim();
  return { i, kind: "split", title: name, note: rest.charAt(0).toUpperCase() + rest.slice(1) };
});

// ── Counts for the colour and year steps ──
const lowerColour = items.filter((i) => /^[a-z]/.test(i.attributes?.color_description ?? "")).length;
const textYears = items.filter((i) => ["release_year_start", "release_year_end"].some((k) => typeof i.attributes?.[k] === "string" && /^\d{4}$/.test(i.attributes[k].trim()))).length;

// ── Review document ──
const md = [];
md.push("# Registry format repair: review list (MHH-003)", "");
md.push(`Built ${new Date().toISOString().slice(0, 10)} from the live Registry. Nothing changes until the owner runs`);
md.push("`registry_format_repair_2026_10.sql` (dry run first). Owner rulings Q23, Q24, Q25.", "");
md.push("## What the repair does", "");
md.push(`1. **Colour descriptions** that start lowercase get a capital first letter: ${lowerColour} rows ("red chestnut" → "Red chestnut").`);
md.push(`2. **Years stored as text** become numbers: ${textYears} rows. Nothing visible changes.`);
md.push(`3. **Names one or two letters apart** merge into the more common spelling: ${pairs.length} pairs (below). The less common spelling's pages forward to the kept one.`);
md.push(`4. **Titles ending in punctuation**: ${titleRows.length} rows (below). Sets keep their roster and lose only the final period; other titles keep the name and move the description into the release's notes.`, "");
md.push("## 3. Names", "", "| Keep | Rows | Merge in | Rows | Check |", "|---|---|---|---|---|");
for (const p of pairs) md.push(`| ${p.keep} | ${p.keepN} | ${p.drop} | ${p.dropN} | ${p.tie ? "**Tie: which is right?**" : ""} |`);
md.push("", "If the kept spelling is itself the typo for any pair, say which and it will be flipped.", "");
md.push("## 4. Titles", "");
md.push("Many of these \"titles\" are a run description rather than a name (\"BreyerFest Special Run (1,113 made) Split run of …\"); the March import put the source's notes where the name should be. This repair only tidies them as listed. Giving those releases real names is a separate job; say if you want it ticketed.", "");
md.push("Titles whose \"With …\" part names a mold are treated as sets and keep it: mold pages read it to list the sets a mold was sold in.", "");
for (const [kind, label] of [["split", "Name kept, description moved to notes"], ["set", "Sets: roster kept, final period dropped"], ["trim", "Final punctuation dropped only"]]) {
  const rows = titleRows.filter((r) => r.kind === kind);
  md.push(`### ${label} (${rows.length})`, "", "| Title becomes | Notes get |", "|---|---|");
  for (const r of rows) md.push(`| ${r.title.replace(/\|/g, "/")} | ${(r.note ?? "").replace(/\|/g, "/")} |`);
  md.push("");
}
fs.writeFileSync("scripts/catalog-delta/review/registry_format_review_2026_10.md", md.join("\n"));

// ── SQL ──
const titleValues = titleRows.map((r) => `  (${q(r.i.id)}, ${q(r.i.title)}, ${q(r.title)}, ${q(r.note)})`).join(",\n");
const nameValues = pairs.filter((p) => !p.tie).map((p) => `  (${q(p.drop)}, ${q(p.keep)})`).join(",\n");
const common = (dry) => `-- Registry format repair 2026-10 (MHH-003). ${dry ? "DRY RUN: changes nothing." : "Run the dry run first."}
-- Owner rulings Q23-Q25. Review list: scripts/catalog-delta/review/registry_format_review_2026_10.md
-- Every step is expect-guarded: a row changes only if it still holds what the
-- review list showed. Safe to run twice.
${dry ? "" : "BEGIN;\n"}
CREATE TEMP TABLE IF NOT EXISTS _titles (id uuid, old_title text, new_title text, note text);
TRUNCATE _titles;
INSERT INTO _titles VALUES
${titleValues};

CREATE TEMP TABLE IF NOT EXISTS _names (old_name text, new_name text);
TRUNCATE _names;
INSERT INTO _names VALUES
${nameValues};
`;
const dry = common(true) + `
SELECT '1 colour' AS step, 'colour descriptions given a capital first letter' AS detail,
  (SELECT count(*) FROM public.catalog_items WHERE attributes->>'color_description' ~ '^[a-z]') AS n
UNION ALL SELECT '2 years', 'years stored as text that become numbers',
  (SELECT count(*) FROM public.catalog_items WHERE jsonb_typeof(attributes->'release_year_start') = 'string' AND attributes->>'release_year_start' ~ '^\\s*\\d{4}\\s*$')
  + (SELECT count(*) FROM public.catalog_items WHERE jsonb_typeof(attributes->'release_year_end') = 'string' AND attributes->>'release_year_end' ~ '^\\s*\\d{4}\\s*$')
UNION ALL SELECT '3 names', 'rows whose maker, artist or manufacturer spelling merges',
  (SELECT count(*) FROM public.catalog_items c WHERE c.maker IN (SELECT old_name FROM _names) OR c.artist IN (SELECT old_name FROM _names) OR c.manufacturer IN (SELECT old_name FROM _names))
UNION ALL SELECT '4 titles', 'titles tidied (still as listed)',
  (SELECT count(*) FROM _titles t JOIN public.catalog_items c ON c.id = t.id AND c.title = t.old_title)
UNION ALL SELECT '4 titles', 'titles skipped (changed since the list was made)',
  (SELECT count(*) FROM _titles t LEFT JOIN public.catalog_items c ON c.id = t.id AND c.title = t.old_title WHERE c.id IS NULL);
`;
const run = common(false) + `
-- 1. Colour descriptions start with a capital.
UPDATE public.catalog_items
SET attributes = jsonb_set(attributes, '{color_description}',
      to_jsonb(upper(left(attributes->>'color_description', 1)) || substr(attributes->>'color_description', 2)))
WHERE attributes->>'color_description' ~ '^[a-z]';

-- 2. Four-digit years stored as text become numbers.
UPDATE public.catalog_items
SET attributes = jsonb_set(attributes, '{release_year_start}', to_jsonb(btrim(attributes->>'release_year_start')::int))
WHERE jsonb_typeof(attributes->'release_year_start') = 'string' AND attributes->>'release_year_start' ~ '^\\s*\\d{4}\\s*$';
UPDATE public.catalog_items
SET attributes = jsonb_set(attributes, '{release_year_end}', to_jsonb(btrim(attributes->>'release_year_end')::int))
WHERE jsonb_typeof(attributes->'release_year_end') = 'string' AND attributes->>'release_year_end' ~ '^\\s*\\d{4}\\s*$';

-- 3. One spelling per person or company. A maker change moves the page and
--    records the old address (migrations 232, 233), so old links forward.
UPDATE public.catalog_items c SET maker = n.new_name FROM _names n WHERE c.maker = n.old_name;
UPDATE public.catalog_items c SET artist = n.new_name FROM _names n WHERE c.artist = n.old_name;
UPDATE public.catalog_items c SET manufacturer = n.new_name FROM _names n WHERE c.manufacturer = n.old_name;

-- 4. Titles: the name stays; the description moves into the release's notes.
UPDATE public.catalog_items c
SET title = t.new_title,
    attributes = CASE WHEN t.note IS NULL THEN c.attributes
                      ELSE jsonb_set(c.attributes, '{registry_notes}',
                             to_jsonb(concat_ws(E'\\n\\n', NULLIF(c.attributes->>'registry_notes', ''), t.note))) END
FROM _titles t
WHERE c.id = t.id AND c.title = t.old_title;

COMMIT;

-- What changed (run with the health scan before and after).
SELECT 'colours still lowercase' AS check, count(*) FROM public.catalog_items WHERE attributes->>'color_description' ~ '^[a-z]'
UNION ALL SELECT 'years still text', count(*) FROM public.catalog_items WHERE jsonb_typeof(attributes->'release_year_start') = 'string' AND attributes->>'release_year_start' ~ '^\\s*\\d{4}\\s*$'
UNION ALL SELECT 'old spellings left', count(*) FROM public.catalog_items c WHERE c.maker IN (SELECT old_name FROM _names) OR c.artist IN (SELECT old_name FROM _names) OR c.manufacturer IN (SELECT old_name FROM _names)
UNION ALL SELECT 'titles ending in punctuation', count(*) FROM public.catalog_items WHERE title ~ '[.,;:]\\s*$';
`;
fs.writeFileSync("scripts/catalog-delta/registry_format_repair_2026_10_dryrun.sql", dry);
fs.writeFileSync("scripts/catalog-delta/registry_format_repair_2026_10.sql", run);
console.log({ pairs: pairs.length, ties: pairs.filter((p) => p.tie).length, titles: titleRows.length, split: titleRows.filter((r) => r.kind === "split").length, sets: titleRows.filter((r) => r.kind === "set").length, trim: titleRows.filter((r) => r.kind === "trim").length, lowerColour, textYears });
