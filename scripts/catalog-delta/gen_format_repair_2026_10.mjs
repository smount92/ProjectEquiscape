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
// Known-correct spellings win their group whatever the counts say.
const PREFERRED = new Set([
  "Pamela du Boulay", // the sculptor's own spelling: lowercase "du"
]);
// Pairs the evidence can't settle: merged as the counts say, but flagged.
const CONFIRM = new Set(["D'Arry Jones Frank", "Sandra Winters"]);
const pairs = [];
for (const g of groups.values()) {
  if (g.length < 2) continue;
  g.sort((a, b) => (PREFERRED.has(b) - PREFERRED.has(a)) || (count[b] - count[a]));
  const keep = g[0];
  for (const drop of g.slice(1)) pairs.push({ keep, drop, keepN: count[keep], dropN: count[drop], preferred: PREFERRED.has(keep), tie: !PREFERRED.has(keep) && count[keep] === count[drop], confirm: CONFIRM.has(drop) || CONFIRM.has(keep) });
}
pairs.sort((p, r) => r.keepN - p.keepN);

// ── Titles that hold a description ──
// Same rule as hasTrailingPunctuation/tidyName in src/lib/catalog/corrections.ts.
const ABBREVIATION_END = /(?:(?<!\p{L})\p{L}|\b(?:Co|Jr|Sr|Inc|Ltd|St|Mr|Mrs|Ms|Dr|No|Bros|Corp|Mt|vs))\.$/u;
const stray = (t) => /[.,;:]$/.test(t.trim()) && !ABBREVIATION_END.test(t.trim());
// A closing bracket with no opening one is a leftover from a cut description.
const unbalancedClose = (v) => v.endsWith(")") && (v.match(/\(/g) ?? []).length < (v.match(/\)/g) ?? []).length;
const tidy = (t) => {
  let v = t.replace(/\s+/g, " ").trim();
  for (;;) {
    if (stray(v) || unbalancedClose(v)) v = v.slice(0, -1).trimEnd();
    else return v;
  }
};
const rel = items.filter((i) => stray(i.title));
// Mold pages find the sets a mold was sold in by reading "With <mold>" in
// set titles, so any title whose "with" part names a known mold keeps it.
// Mold titles (generation suffix stripped) of 4+ letters, matched as whole
// words with their own capitals: "Rojo" counts, "foal blanket" is not "Foal".
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const moldNames = [...new Set(items.filter((i) => i.item_type === "plastic_mold")
  .map((m) => m.title.replace(/\(\s*g[1-6]\s*\)/gi, "").replace(/\s+/g, " ").trim())
  .filter((t) => (t.match(/\p{L}/gu) ?? []).length >= 4))];
const moldRes = moldNames.map((m) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(m)}(?![\\p{L}\\p{N}])`, "u"));
const mentionsMold = (s) => moldRes.some((re) => re.test(s));
const withTail = (t) => { const w = t.toLowerCase().indexOf(" with "); return w < 0 ? null : t.slice(w + 6); };
const namesAMold = (t) => { const tail = withTail(t); return tail !== null && mentionsMold(tail); };
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
const isTextYear = (i, k) => typeof i.attributes?.[k] === "string" && /^\d{4}$/.test(i.attributes[k].trim());
const YEAR_KEYS = ["release_year_start", "release_year_end"];
const textYearRows = items.filter((i) => YEAR_KEYS.some((k) => isTextYear(i, k))).length;
// The SQL updates start and end separately, so the dry run counts values.
const textYearValues = items.reduce((n, i) => n + YEAR_KEYS.filter((k) => isTextYear(i, k)).length, 0);

// ── Counts for the names step (rows, not cells) ──
const merged = pairs.filter((p) => !p.tie);
const dropNames = new Set(merged.map((p) => p.drop));
const nameFields = (i) => [i.maker, i.artist, i.manufacturer, i.attributes?.sculptor];
const rowsNaming = (n) => items.filter((i) => nameFields(i).includes(n)).length;
const nameRows = items.filter((i) => nameFields(i).some((v) => dropNames.has(v))).length;
const sculptorRows = items.filter((i) => dropNames.has(i.attributes?.sculptor)).length;

// ── Titles left ending in punctuation after the run (abbreviations kept on purpose) ──
const newTitle = new Map(titleRows.map((r) => [r.i.id, r.title]));
const crossRefs = titleRows.filter((r) => r.kind === "split" && mentionsMold(r.note) && !/\bwith\b/i.test(r.note));
const punctLeft = items.filter((i) => /[.,;:]\s*$/.test(newTitle.get(i.id) ?? i.title)).length;

// ── Review document ──
const md = [];
md.push("# Registry format repair: review list (MHH-003)", "");
md.push(`Built ${new Date().toISOString().slice(0, 10)} from the live Registry. Nothing changes until the owner runs`);
md.push("`registry_format_repair_2026_10.sql` (dry run first). Owner rulings Q23, Q24, Q25.", "");
md.push("> **Before you run**", ">");
md.push("> 1. Paste migration 233 first (and 234). The repair stops with a message if 233 is missing: it records old page addresses so links keep working.");
md.push("> 2. Run `registry_format_repair_2026_10_dryrun.sql`. It changes nothing; its numbers should match the ones below.");
md.push("> 3. Run `registry_format_repair_2026_10.sql`. If any statement errors in the SQL editor, run `ROLLBACK;` before trying again.");
md.push("> 4. Pages are cached for up to an hour, so the changes appear on the site within the hour.", "");
md.push("## What the repair does (what the dry run will show)", "");
md.push(`1. **Colour descriptions** that start lowercase get a capital first letter: ${lowerColour} rows ("red chestnut" → "Red chestnut").`);
md.push(`2. **Years stored as text** become numbers: ${textYearValues} values (start and end years counted separately) on ${textYearRows} rows. The dry run counts values. Nothing visible changes.`);
md.push(`3. **Names one or two letters apart** merge into one spelling: ${merged.length} pairs (below), touching ${nameRows} rows (a row counts once even if its maker and artist both change; ${sculptorRows} of them have the old spelling in the sculptor field, which the Registry also reads). Known-correct spellings win; otherwise the more common one does. The less common spelling's pages forward to the kept one.`);
md.push(`4. **Titles ending in punctuation**: ${titleRows.length} rows (below). Sets keep their roster and lose only the final period; other titles keep the name and move the description into the release's notes.`, "");
md.push(`After the run, the final check's "titles ending in punctuation" should read about ${punctLeft}, not 0: titles that end in an abbreviation ("Co.", "Jr.", "I.C.E.") keep their period on purpose.`, "");
md.push("## 3. Names", "", "| Keep | Rows | Merge in | Rows | Check |", "|---|---|---|---|---|");
for (const p of pairs) {
  const check = p.tie ? "**Tie: which is right?** (not merged)" : p.confirm ? "**Please confirm**: the records don't settle which spelling is right" : p.preferred ? "Known correct spelling" : "";
  md.push(`| ${p.keep} | ${rowsNaming(p.keep)} | ${p.drop} | ${rowsNaming(p.drop)} | ${check} |`);
}
md.push("", "Rows: catalog rows naming that spelling as maker, artist, manufacturer or sculptor.", "");
md.push("If the kept spelling is itself the typo for any pair, say which and it will be flipped.", "");
md.push("Separate question, not merged: \"Maggie Jenner-Bennett\" may be the same artist as \"Maggie Bennett\". Say if they are one person.", "");
md.push("## 4. Titles", "");
md.push("Many of these \"titles\" are a run description rather than a name (\"BreyerFest Special Run (1,113 made) Split run of …\"); the March import put the source's notes where the name should be. This repair only tidies them as listed. Giving those releases real names is a separate job; say if you want it ticketed.", "");
md.push("Titles whose \"With …\" part names a mold are treated as sets and keep it: mold pages read it to list the sets a mold was sold in. A mold name counts when it appears with its own capitals as whole words (\"With Rojo\" counts; \"foal blanket\" is not the Foal mold).", "");
if (crossRefs.length) md.push(`${crossRefs.length} moved descriptions mention a mold only as a cross-reference (no "with", so mold pages never read them; nothing is lost): ${crossRefs.map((r) => `"${r.note}"`).join("; ")}`, "");
for (const [kind, label] of [["split", "Name kept, description moved to notes"], ["set", "Sets: roster kept, final period dropped"], ["trim", "Final punctuation dropped only"]]) {
  const rows = titleRows.filter((r) => r.kind === kind);
  md.push(`### ${label} (${rows.length})`, "", "| Title becomes | Notes get |", "|---|---|");
  for (const r of rows) md.push(`| ${r.title.replace(/\|/g, "/")} | ${(r.note ?? "").replace(/\|/g, "/")} |`);
  md.push("");
}
fs.writeFileSync("scripts/catalog-delta/review/registry_format_review_2026_10.md", md.join("\n"));

// ── SQL ──
const titleValues = titleRows.map((r) => `  (${q(r.i.id)}, ${q(r.i.title)}, ${q(r.title)}, ${q(r.note)})`).join(",\n");
const nameValues = merged.map((p) => `  (${q(p.drop)}, ${q(p.keep)})`).join(",\n");
const guard = `DO $$ BEGIN IF to_regclass('public.catalog_slug_history') IS NULL THEN RAISE EXCEPTION 'Paste migration 233 first: it records old page addresses so links keep working.'; END IF; END $$;\n`;
const common = (dry) => `-- Registry format repair 2026-10 (MHH-003). ${dry ? "DRY RUN: changes nothing." : "Run the dry run first."}
-- Owner rulings Q23-Q25. Review list: scripts/catalog-delta/review/registry_format_review_2026_10.md
-- Every step is expect-guarded: a row changes only if it still holds what the
-- review list showed. Safe to run twice.
-- If any statement errors in the SQL editor, run ROLLBACK; before trying again.
${dry ? guard : "BEGIN;\n" + guard}
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
SELECT '1 colour' AS step, 'rows: colour descriptions given a capital first letter' AS detail,
  (SELECT count(*) FROM public.catalog_items WHERE attributes->>'color_description' ~ '^[a-z]') AS n
UNION ALL SELECT '2 years', 'values (start and end counted separately): years stored as text that become numbers',
  (SELECT count(*) FROM public.catalog_items WHERE jsonb_typeof(attributes->'release_year_start') = 'string' AND attributes->>'release_year_start' ~ '^\\s*\\d{4}\\s*$')
  + (SELECT count(*) FROM public.catalog_items WHERE jsonb_typeof(attributes->'release_year_end') = 'string' AND attributes->>'release_year_end' ~ '^\\s*\\d{4}\\s*$')
UNION ALL SELECT '3 names', 'rows (each once): maker, artist, manufacturer or sculptor spelling merges',
  (SELECT count(*) FROM public.catalog_items c WHERE c.maker IN (SELECT old_name FROM _names) OR c.artist IN (SELECT old_name FROM _names) OR c.manufacturer IN (SELECT old_name FROM _names) OR c.attributes->>'sculptor' IN (SELECT old_name FROM _names))
UNION ALL SELECT '4 titles', 'rows: titles tidied (still as listed)',
  (SELECT count(*) FROM _titles t JOIN public.catalog_items c ON c.id = t.id AND c.title = t.old_title)
UNION ALL SELECT '4 titles', 'rows: titles skipped (changed since the list was made)',
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
-- The sculptor field holds the same names and the Registry's linker reads it.
UPDATE public.catalog_items c SET attributes = jsonb_set(c.attributes, '{sculptor}', to_jsonb(n.new_name)) FROM _names n WHERE c.attributes->>'sculptor' = n.old_name;

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
SELECT 'rows: colours still lowercase' AS check, count(*) FROM public.catalog_items WHERE attributes->>'color_description' ~ '^[a-z]'
UNION ALL SELECT 'values: years still text', (SELECT count(*) FROM public.catalog_items WHERE jsonb_typeof(attributes->'release_year_start') = 'string' AND attributes->>'release_year_start' ~ '^\\s*\\d{4}\\s*$')
  + (SELECT count(*) FROM public.catalog_items WHERE jsonb_typeof(attributes->'release_year_end') = 'string' AND attributes->>'release_year_end' ~ '^\\s*\\d{4}\\s*$')
UNION ALL SELECT 'rows: old spellings left (incl. sculptor)', count(*) FROM public.catalog_items c WHERE c.maker IN (SELECT old_name FROM _names) OR c.artist IN (SELECT old_name FROM _names) OR c.manufacturer IN (SELECT old_name FROM _names) OR c.attributes->>'sculptor' IN (SELECT old_name FROM _names)
UNION ALL SELECT 'rows: titles ending in punctuation (about ${punctLeft} expected: abbreviations keep their period)', count(*) FROM public.catalog_items WHERE title ~ '[.,;:]\\s*$';
`;
fs.writeFileSync("scripts/catalog-delta/registry_format_repair_2026_10_dryrun.sql", dry);
fs.writeFileSync("scripts/catalog-delta/registry_format_repair_2026_10.sql", run);
console.log({ pairs: pairs.length, merged: merged.length, ties: pairs.filter((p) => p.tie).length, nameRows, sculptorRows, titles: titleRows.length, split: titleRows.filter((r) => r.kind === "split").length, sets: titleRows.filter((r) => r.kind === "set").length, trim: titleRows.filter((r) => r.kind === "trim").length, lowerColour, textYearValues, textYearRows, punctLeft });
// Split rows must not carry a "With <mold>" out of the title: mold pages read it there.
const leaked = titleRows.filter((r) => r.kind === "split" && namesAMold(" " + r.note));
console.log(`Split notes with "With <mold>": ${leaked.length}`, leaked.map((r) => `${r.i.id.slice(0, 8)} ${r.note}`));
console.log("Split notes mentioning a mold (no \"with\", so mold pages never read it):", crossRefs.map((r) => `${r.i.id.slice(0, 8)} ${r.note}`));
