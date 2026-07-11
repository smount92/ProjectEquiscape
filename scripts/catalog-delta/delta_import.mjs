/**
 * Source-agnostic catalog delta importer.
 *
 * Reads a JSON dataset of models (parsed from a source the owner provides —
 * e.g. an IdentifyYourBreyer event page pasted from the browser, or a Maggie
 * Bennett micro list), diffs it against the live `catalog_items` table, and
 * reports which rows are genuinely NEW, which already exist, and which are
 * SUPPRESSED because the model was previously corrected/removed in
 * `catalog_changelog` (so we never re-import known-bad data).
 *
 * DRY RUN by default — writes nothing. Prints a report and drops a JSON file
 * next to the dataset. Pass `--apply` to actually insert the NEW rows (plus a
 * `catalog_changelog` 'addition' entry each) via the service-role admin client.
 *
 *   node scripts/catalog-delta/delta_import.mjs                       # BF2026 dry run
 *   node scripts/catalog-delta/delta_import.mjs --data ./data/foo.json
 *   node scripts/catalog-delta/delta_import.mjs --apply               # write NEW rows
 *
 * Dataset shape (top-level defaults + per-record fields):
 *   { maker, year, item_type?, source, records: [ { name, variation, scale,
 *     model_number, finish, mold, number_produced, sold_for, category,
 *     run_type, iyb_id }, ... ] }
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── args ──
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dataArgIdx = args.indexOf("--data");
const DATA_PATH = dataArgIdx !== -1 && args[dataArgIdx + 1]
  ? resolve(process.cwd(), args[dataArgIdx + 1])
  : join(__dirname, "data", "iyb_breyerfest_2026.json");

// ── env: search upward for .env.local (scripts hand-parse it; no dotenv dep) ──
function loadEnv() {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ".env.local");
    if (existsSync(candidate)) {
      for (const line of readFileSync(candidate, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const k = t.slice(0, eq).trim();
        if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
      }
      return candidate;
    }
    dir = dirname(dir);
  }
  return null;
}
const envFile = loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(`\n✗ Missing Supabase env (looked for .env.local: ${envFile || "not found"}).`);
  console.error("  Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── normalization ──
const stripDiacritics = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s) =>
  stripDiacritics(String(s || "").toLowerCase())
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
// mold names: drop generation suffix + parentheticals ("Drafter - G4" → "drafter",
// "Nokota (8 Legs)" → "nokota", "Icelandic (Crystal)" → "icelandic")
const normMold = (s) =>
  norm(String(s || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s*-\s*[GM]\d+\s*$/i, ""));
// canonical mold title for creation (keeps casing, strips gen suffix + parens)
const canonicalMoldTitle = (s) =>
  String(s).replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s*-\s*[GM]\d+\s*$/i, "").replace(/\s+/g, " ").trim();
// known IYB→catalog mold-name mismatches, keyed by normMold+"|"+scale
const MOLD_ALIAS = { "icelandic|Stablemate (1:32)": "Icelandic Horse" };

// IYB scale → catalog scale strings (kept consistent with get_catalog_facets)
// keys are norm()-ed (punctuation stripped) so lookups via norm(raw) hit
const SCALE_MAP = {
  "traditional": "Traditional (1:9)",
  "animal traditional": "Traditional (1:9)",
  "gallery crystal": "Traditional (1:9)",
  "stablemates": "Stablemate (1:32)",
  "stablemate": "Stablemate (1:32)",
  "classic": "Classic (1:12)",
  "paddock pals": "Paddock Pals (1:24)",
  "plush": "Plush",
};
const mapScale = (raw) => SCALE_MAP[norm(raw)] || (raw || null);

// ── read all rows of a table, paginated ──
async function readAll(table, columns) {
  const PAGE = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function main() {
  const dataset = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  const {
    maker = "Breyer",
    year = null,
    item_type = "plastic_release",
    source = "unknown",
    records = [],
  } = dataset;

  console.log(`\n${"═".repeat(64)}`);
  console.log(`  Catalog delta — ${source}`);
  console.log(`  dataset: ${DATA_PATH}`);
  console.log(`  ${records.length} records · maker="${maker}" · ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}`);
  console.log(`${"═".repeat(64)}\n`);

  // ── load catalog ──
  const items = await readAll("catalog_items", "id, item_type, parent_id, title, maker, scale, attributes");
  const releases = items.filter((i) => i.item_type === item_type);
  const molds = items.filter((i) => i.item_type === "plastic_mold");
  const idToTitle = new Map(items.map((i) => [i.id, i.title]));

  // release index by normalized title (maker-scoped)
  const releaseByTitle = new Map();
  for (const r of releases) {
    if (norm(r.maker) !== norm(maker)) continue;
    const k = norm(r.title);
    if (!releaseByTitle.has(k)) releaseByTitle.set(k, []);
    releaseByTitle.get(k).push(r);
  }
  // mold index — scale-aware: key = normMold(title)+"|"+scale (mold identity is
  // (title, scale); e.g. Semi-Rearing Mustang exists in both SM and Traditional)
  const moldByKey = new Map();
  for (const m of molds) {
    moldByKey.set(normMold(m.title) + "|" + (m.scale || ""), m);
  }
  const resolveMold = (moldName, releaseScale) => {
    if (!moldName) return null;
    const scale = mapScale(releaseScale) || "";
    const direct = moldByKey.get(normMold(moldName) + "|" + scale);
    if (direct) return direct;
    const aliasTitle = MOLD_ALIAS[normMold(moldName) + "|" + scale];
    if (aliasTitle) return moldByKey.get(normMold(aliasTitle) + "|" + scale) || null;
    return null;
  };
  // idempotency: existing rows already tagged with this source's ids
  const existingSourceIds = new Set(
    releases
      .map((r) => r.attributes && r.attributes.source_id)
      .filter(Boolean)
  );

  // ── suppression corpus from changelog (correction/removal) ──
  const changelog = await readAll("catalog_changelog", "change_type, change_summary, catalog_item_id");
  const suppressed = new Set();
  for (const c of changelog) {
    if (c.change_type !== "correction" && c.change_type !== "removal") continue;
    if (c.catalog_item_id && idToTitle.has(c.catalog_item_id)) {
      suppressed.add(norm(idToTitle.get(c.catalog_item_id)));
    }
    // parse "…: A → B" out of the summary, suppress both sides
    const m = /:\s*(.+?)\s*[→\->]{1,2}\s*(.+)$/.exec(c.change_summary || "");
    if (m) { suppressed.add(norm(m[1])); suppressed.add(norm(m[2])); }
  }

  // ── classify ──
  const buckets = { present: [], newVariant: [], fresh: [], suppressed: [], alreadyImported: [] };
  const seenKeys = new Set(); // dedup within the dataset

  for (const rec of records) {
    const nTitle = norm(rec.name);
    const nVar = norm(rec.variation);
    const key = nTitle + "|" + nVar;
    const sourceId = `${source}:${rec.iyb_id || rec.model_number || key}`;

    const moldRow = resolveMold(rec.mold, rec.scale);

    const info = {
      name: rec.name,
      variation: rec.variation || null,
      model_number: rec.model_number || null,
      scale: mapScale(rec.scale),
      mold: rec.mold || null,
      mold_matched: moldRow ? moldRow.title : null,
      source_id: sourceId,
    };

    if (existingSourceIds.has(sourceId)) { buckets.alreadyImported.push(info); continue; }
    if (seenKeys.has(key)) { buckets.alreadyImported.push({ ...info, note: "duplicate within dataset" }); continue; }
    seenKeys.add(key);

    const candidates = releaseByTitle.get(nTitle) || [];
    if (candidates.length) {
      const exactByNumber =
        rec.model_number &&
        candidates.some((c) => c.attributes && c.attributes.model_number === rec.model_number);
      const byColor =
        nVar &&
        candidates.some((c) => c.attributes && norm(c.attributes.color_description) === nVar);
      const plainMatch = !nVar; // unnamed variant + title exists ⇒ treat as present
      if (exactByNumber || byColor || plainMatch) {
        buckets.present.push({ ...info, matched: candidates[0].title });
      } else {
        buckets.newVariant.push(info); // base name exists but this variant is new
      }
      continue;
    }

    if (suppressed.has(nTitle) || suppressed.has(norm(rec.name + " " + (rec.variation || "")))) {
      buckets.suppressed.push(info);
      continue;
    }
    buckets.fresh.push(info);
  }

  // ── report ──
  const line = (label, arr) => console.log(`  ${label.padEnd(28)} ${String(arr.length).padStart(3)}`);
  console.log("  DISPOSITION");
  console.log("  " + "-".repeat(34));
  line("NEW (fresh)", buckets.fresh);
  line("NEW variant (base exists)", buckets.newVariant);
  line("Already in catalog", buckets.present);
  line("Suppressed (bad-data)", buckets.suppressed);
  line("Already imported / dup", buckets.alreadyImported);
  console.log("  " + "-".repeat(34));
  console.log(`  ${"TOTAL".padEnd(28)} ${String(records.length).padStart(3)}\n`);

  const toInsert = [...buckets.fresh, ...buckets.newVariant];
  const missingMolds = [...new Set(toInsert.filter((r) => r.mold && !r.mold_matched).map((r) => r.mold))];

  if (buckets.suppressed.length) {
    console.log("  ⚠ SUPPRESSED (previously corrected/removed — NOT importing):");
    for (const r of buckets.suppressed) console.log(`     · ${r.name}${r.variation ? ` (${r.variation})` : ""}`);
    console.log("");
  }
  if (missingMolds.length) {
    console.log(`  ⚠ ${missingMolds.length} molds referenced by new releases are NOT in catalog_items`);
    console.log(`    (releases will import with parent_id=null until molds are added):`);
    console.log(`     ${missingMolds.join(", ")}\n`);
  }
  console.log(`  → ${toInsert.length} rows would be inserted as new ${item_type} entries.\n`);

  // ── write report file ──
  const reportPath = DATA_PATH.replace(/\.json$/, ".delta-report.json");
  writeFileSync(reportPath, JSON.stringify({ source, generated_for: DATA_PATH, counts: {
    fresh: buckets.fresh.length, newVariant: buckets.newVariant.length,
    present: buckets.present.length, suppressed: buckets.suppressed.length,
    alreadyImported: buckets.alreadyImported.length,
  }, buckets, missingMolds }, null, 2));
  console.log(`  Full report → ${reportPath}\n`);

  if (!APPLY) {
    console.log("  DRY RUN — nothing written. Re-run with --apply to insert the NEW rows.\n");
    return;
  }

  // ── APPLY: create absent molds, then insert releases + changelog additions ──
  console.log(`  APPLYING: ${toInsert.length} releases…\n`);
  // rebuild a source_id → record map with the SAME key logic used in classify
  const byId = new Map();
  for (const r of records) {
    const k = norm(r.name) + "|" + norm(r.variation);
    byId.set(`${source}:${r.iyb_id || r.model_number || k}`, r);
  }

  // 1) create molds that don't resolve at their scale (dedup by canonical title+scale)
  const moldsNeeded = new Map();
  for (const info of toInsert) {
    const rec = byId.get(info.source_id) || {};
    if (!rec.mold || resolveMold(rec.mold, rec.scale)) continue;
    const title = canonicalMoldTitle(rec.mold);
    const scale = mapScale(rec.scale) || null;
    moldsNeeded.set(`${norm(title)}|${scale}`, { title, scale });
  }
  if (moldsNeeded.size) {
    const moldRows = [...moldsNeeded.values()].map((m) => ({
      item_type: "plastic_mold",
      title: m.title,
      maker,
      scale: m.scale,
      attributes: { source, source_note: `auto-created for ${source} release import` },
    }));
    const { data: newMolds, error: moldErr } = await supabase
      .from("catalog_items").insert(moldRows).select("id, title, scale");
    if (moldErr) { console.error(`  ✗ mold insert failed: ${moldErr.message}`); process.exit(1); }
    for (const m of newMolds) moldByKey.set(normMold(m.title) + "|" + (m.scale || ""), m);
    console.log(`  ✓ created ${newMolds.length} molds: ${newMolds.map((m) => m.title).join(", ")}`);
    // log mold additions to the changelog too
    await supabase.from("catalog_changelog").insert(newMolds.map((m) => ({
      catalog_item_id: m.id, change_type: "addition",
      change_summary: `📗 Imported from ${source} (mold): ${m.title}`,
      contributor_alias: "system-import",
    })));
  }

  // 2) build release rows, now with molds resolvable
  const rows = toInsert.map((info) => {
    const rec = byId.get(info.source_id) || {};
    const moldRow = resolveMold(rec.mold, rec.scale);
    return {
      item_type,
      parent_id: moldRow ? moldRow.id : null,
      title: info.name,
      maker,
      scale: info.scale,
      attributes: {
        model_number: info.model_number || null,
        color_description: info.variation || null,
        release_year_start: rec.year ?? year,
        release_year_end: rec.year ?? year,
        finish: rec.finish || null,
        material: rec.material || null,
        mold_name: info.mold || null,
        run_count: rec.number_produced ?? null,
        retail_price: rec.sold_for || null,
        category: rec.category || null,
        run_type: rec.run_type || null,
        source,
        source_id: info.source_id,
      },
    };
  });

  const BATCH = 500;
  const inserted = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase.from("catalog_items").insert(batch).select("id, title");
    if (error) { console.error(`  ✗ insert failed: ${error.message}`); process.exit(1); }
    inserted.push(...data);
  }
  console.log(`  ✓ inserted ${inserted.length} catalog_items rows.`);

  const logRows = inserted.map((it) => ({
    catalog_item_id: it.id,
    change_type: "addition",
    change_summary: `📗 Imported from ${source}: ${it.title}`,
    contributor_alias: "system-import",
  }));
  for (let i = 0; i < logRows.length; i += BATCH) {
    const { error } = await supabase.from("catalog_changelog").insert(logRows.slice(i, i + BATCH));
    if (error) console.error(`  ⚠ changelog insert warning: ${error.message}`);
  }
  console.log(`  ✓ logged ${logRows.length} changelog additions.\n`);
}

main().catch((e) => { console.error("\n✗", e.message, "\n"); process.exit(1); });
