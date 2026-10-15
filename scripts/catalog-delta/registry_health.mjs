#!/usr/bin/env node
/**
 * Registry health scan: structure, duplicates, vocabulary and formats.
 *
 *   node scripts/catalog-delta/registry_health.mjs
 *   node scripts/catalog-delta/registry_health.mjs --json health.json   (also writes the counts)
 *   node scripts/catalog-delta/registry_health.mjs --compare last.json   (flags counts that rose)
 *
 * Read-only, and uses the public (anon) key only, so anyone can run it.
 * Run it before and after any repair script and paste both outputs into
 * the repair's notes: every repair should move at least one number here
 * and should move nothing it did not mean to.
 *
 * Where audit_catalog.mjs checks single rows (bad years, encoding damage),
 * this checks the shape of the Registry: releases under the right mold,
 * one mold per sculpture, one spelling per maker, one format per field.
 */
import fs from "node:fs";
const env = fs.existsSync(".env.local") ? Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
) : {};
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) env[k] ??= process.env[k];
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
async function page(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(path + " " + r.status + " " + (await r.text()).slice(0, 200));
    const rows = await r.json(); out.push(...rows); if (rows.length < 1000) break;
  }
  return out;
}
const items = await page("catalog_items?select=id,title,item_type,scale,maker,manufacturer,artist,parent_id,attributes,slug,maker_slug,created_at&order=id");
const byId = new Map(items.map((i) => [i.id, i]));
const out = [];
const say = (k, v, ex) => out.push({ k, v, ex: (ex ?? []).slice(0, 6) });
const count = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a; }, {});
const top = (o, n = 12) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

say("rows", items.length);
say("by type", JSON.stringify(count(items, (i) => i.item_type)));

// ── Scale vocabulary ──
const CANON = new Set(["Large Traditional (1:8)", "Traditional (1:9)", "Small Traditional (1:10)", "Classic (1:12)", "Pebbles (1:18)", "1:20", "Paddock Pal (1:24)", "Stablemate (1:32)", "Mini Whinnies (1:64)", "Venti", "Curio", "Micro Mini", "Plush", "Other"]);
const scales = count(items, (i) => i.scale ?? "(null)");
say("scale values", top(scales, 30).map(([k, v]) => `${k}=${v}`).join(" | "));
const nonCanon = items.filter((i) => i.scale && !CANON.has(i.scale));
say("non-canonical scale values", Object.keys(count(nonCanon, (i) => i.scale)).length, top(count(nonCanon, (i) => i.scale), 15).map(([k, v]) => `${k}=${v}`));
say("null scale by type", JSON.stringify(count(items.filter((i) => !i.scale), (i) => i.item_type)));

// ── Maker vocabulary ──
const makers = count(items, (i) => i.maker ?? "(null)");
const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const makerGroups = {};
for (const m of Object.keys(makers)) (makerGroups[norm(m)] ??= []).push(`${m} (${makers[m]})`);
const makerClash = Object.values(makerGroups).filter((g) => g.length > 1);
say("maker spellings that collide when normalised", makerClash.length, makerClash.map((g) => g.join(" / ")));
say("odd maker values", items.filter((i) => !i.maker || /^\?|unknown|n\/a|^-$|\d{4}.*custom/i.test(i.maker)).length, top(count(items.filter((i) => !i.maker || /^\?|unknown|n\/a|^-$|custom glaze/i.test(i.maker)), (i) => i.maker ?? "(null)")).map(([k, v]) => `${k}=${v}`));

// ── Structure ──
const rel = items.filter((i) => i.item_type === "plastic_release");
const molds = items.filter((i) => i.item_type === "plastic_mold");
say("releases with no parent", rel.filter((r) => !r.parent_id).length, top(count(rel.filter((r) => !r.parent_id), (r) => r.maker)).map(([k, v]) => `${k}=${v}`));
const badParent = rel.filter((r) => r.parent_id && byId.get(r.parent_id) && byId.get(r.parent_id).item_type !== "plastic_mold");
say("releases whose parent is not a mold", badParent.length, badParent.map((r) => `${r.title} → ${byId.get(r.parent_id).item_type} "${byId.get(r.parent_id).title}"`));
const danglingParent = items.filter((i) => i.parent_id && !byId.has(i.parent_id));
say("rows pointing at a parent that does not exist", danglingParent.length, danglingParent.map((r) => r.title));
const nonReleaseWithParent = items.filter((i) => i.parent_id && i.item_type !== "plastic_release");
say("non-release rows that have a parent", nonReleaseWithParent.length, top(count(nonReleaseWithParent, (i) => i.item_type)).map(([k, v]) => `${k}=${v}`).concat(nonReleaseWithParent.slice(0, 4).map((r) => `${r.item_type} "${r.title}" → "${byId.get(r.parent_id)?.title}"`)));
const scaleMismatch = rel.filter((r) => r.parent_id && byId.get(r.parent_id)?.scale && r.scale && byId.get(r.parent_id).scale !== r.scale);
say("releases whose scale differs from their mold", scaleMismatch.length, top(count(scaleMismatch, (r) => `${r.scale} under ${byId.get(r.parent_id).scale}`)).map(([k, v]) => `${k}=${v}`));
const makerMismatch = rel.filter((r) => r.parent_id && byId.get(r.parent_id) && norm(byId.get(r.parent_id).maker) !== norm(r.maker));
say("releases whose maker differs from their mold", makerMismatch.length, makerMismatch.slice(0, 6).map((r) => `${r.maker} "${r.title}" under ${byId.get(r.parent_id).maker} "${byId.get(r.parent_id).title}"`));
const kids = count(rel.filter((r) => r.parent_id), (r) => r.parent_id);
say("molds with zero releases", molds.filter((m) => !kids[m.id]).length, top(count(molds.filter((m) => !kids[m.id]), (m) => `${m.maker} · ${m.scale}`)).map(([k, v]) => `${k}=${v}`));
const nonPlasticMolds = molds.filter((m) => /resin|artist/i.test(m.maker ?? "") || (m.artist && !m.manufacturer));
say("molds that look like artist pieces (artist set, no manufacturer)", nonPlasticMolds.length, nonPlasticMolds.slice(0, 6).map((m) => `${m.maker} "${m.title}" artist=${m.artist}`));

// ── Duplicates ──
const ttl = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const moldKey = count(molds, (m) => `${norm(m.maker)}|${m.scale ?? ""}|${ttl(m.title)}`);
const dupMolds = Object.entries(moldKey).filter(([, n]) => n > 1);
say("duplicate molds (maker + scale + title)", dupMolds.length, dupMolds.slice(0, 10).map(([k, n]) => `${k} ×${n}`));
const relKey = count(rel, (r) => `${r.parent_id}|${ttl(r.title)}|${ttl(r.attributes?.color_description)}|${r.attributes?.model_number ?? ""}`);
const dupRel = Object.entries(relKey).filter(([, n]) => n > 1);
say("identical releases on the same mold (title + colour + number)", dupRel.length, dupRel.slice(0, 6).map(([k, n]) => `${k.split("|").slice(1).join(" | ").slice(0, 90)} ×${n}`));
const resin = items.filter((i) => i.item_type === "artist_resin");
const resinKey = count(resin, (r) => `${norm(r.maker)}|${ttl(r.title)}|${r.scale ?? ""}`);
const dupResin = Object.entries(resinKey).filter(([, n]) => n > 1);
say("duplicate artist resins (artist + title + scale)", dupResin.length, dupResin.slice(0, 8).map(([k, n]) => `${k} ×${n}`));

// ── Titles ──
const t = (f) => items.filter((i) => f(i.title ?? ""));
say("titles with HTML entities", t((s) => /&(amp|lt|gt|quot|#\d+);/.test(s)).length, t((s) => /&(amp|lt|gt|quot|#\d+);/.test(s)).map((i) => i.title));
say("titles with leading/trailing/double spaces", t((s) => s !== s.trim() || /\s{2,}/.test(s)).length, t((s) => s !== s.trim() || /\s{2,}/.test(s)).map((i) => JSON.stringify(i.title)));
say("ALL-CAPS titles (4+ letters)", t((s) => /[A-Z]{4}/.test(s) && s === s.toUpperCase() && /[A-Z]/.test(s)).length, t((s) => s === s.toUpperCase() && /[A-Z]{4}/.test(s)).map((i) => i.title));
say("titles starting with a model number", rel.filter((r) => /^#?\s*\d{3,7}\s/.test(r.title)).length);
say("titles starting with a 4-digit year", items.filter((i) => /^(19|20)\d\d\s/.test(i.title)).length, items.filter((i) => /^(19|20)\d\d\s/.test(i.title)).map((i) => i.title));
say("very long titles (>120 chars)", t((s) => s.length > 120).length, t((s) => s.length > 120).map((i) => i.title.slice(0, 110) + "…"));
say("empty or 1-character titles", t((s) => s.trim().length < 2).length, t((s) => s.trim().length < 2).map((i) => `${i.item_type} ${JSON.stringify(i.title)}`));
say("titles that are the literal word undefined/null", t((s) => /^(undefined|null|untitled)$/i.test(s.trim())).length, t((s) => /^(undefined|null|untitled)$/i.test(s.trim())).map((i) => `${i.item_type} ${i.maker}`));

// ── Attributes ──
const keys = {};
for (const i of items) for (const k of Object.keys(i.attributes ?? {})) keys[k] = (keys[k] ?? 0) + 1;
say("attribute keys in use", Object.keys(keys).length, top(keys, 40).map(([k, v]) => `${k}=${v}`));
const strBad = (v) => typeof v === "string" && /^(undefined|null|nan|\[object object\])$/i.test(v.trim());
const badVals = [];
for (const i of items) for (const [k, v] of Object.entries(i.attributes ?? {})) if (strBad(v) || (v && typeof v === "object" && !Array.isArray(v))) badVals.push(`${i.title.slice(0, 40)} · ${k}=${JSON.stringify(v).slice(0, 50)}`);
say("attribute values that are 'undefined'/'null' strings or nested objects", badVals.length, badVals);
const yr = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const yrBad = items.filter((i) => { const a = yr(i.attributes?.release_year_start), b = yr(i.attributes?.release_year_end); return (a !== null && (!Number.isFinite(a) || a < 1940 || a > 2027)) || (b !== null && (!Number.isFinite(b) || b < 1940 || b > 2027)) || (a && b && b < a); });
say("years out of range or ending before they start", yrBad.length, yrBad.map((i) => `${i.title.slice(0, 40)} ${i.attributes.release_year_start}–${i.attributes.release_year_end}`));
const yrType = count(items.filter((i) => i.attributes?.release_year_start !== undefined), (i) => typeof i.attributes.release_year_start);
say("release_year_start stored as", JSON.stringify(yrType));
const RUN = new Set(["Regular Run", "Special Run", "BreyerFest", "Collector's Club", "Web Special", "Store Special", "Test Run", "One of a Kind", "Other"]);
say("run_type values outside the list", items.filter((i) => i.attributes?.run_type && !RUN.has(i.attributes.run_type)).length, top(count(items.filter((i) => i.attributes?.run_type && !RUN.has(i.attributes.run_type)), (i) => i.attributes.run_type)).map(([k, v]) => `${k}=${v}`));
const mnOdd = rel.filter((r) => r.attributes?.model_number && !/^[A-Za-z0-9#\-\s./]+$/.test(String(r.attributes.model_number)));
say("model numbers with odd characters", mnOdd.length, mnOdd.map((r) => `${r.title.slice(0, 30)}: ${r.attributes.model_number}`));
const mnHash = rel.filter((r) => /^#/.test(String(r.attributes?.model_number ?? "")));
say("model numbers stored with a leading #", mnHash.length);
const moldWithReleaseFields = molds.filter((m) => m.attributes?.color_description || m.attributes?.model_number);
say("molds carrying a colour or model number (release fields)", moldWithReleaseFields.length, moldWithReleaseFields.slice(0, 6).map((m) => `${m.maker} "${m.title}" colour=${m.attributes?.color_description ?? "-"} #${m.attributes?.model_number ?? "-"}`));
const moldNameOnMold = molds.filter((m) => m.attributes?.mold_name);
say("molds with a redundant mold_name attribute", moldNameOnMold.length);
const relMoldNameMismatch = rel.filter((r) => r.parent_id && r.attributes?.mold_name && ttl(String(r.attributes.mold_name).replace(/^g[1-6]\s+/i, "")) !== ttl(byId.get(r.parent_id)?.title));
say("releases whose typed mold name disagrees with the mold they are filed under", relMoldNameMismatch.length, relMoldNameMismatch.slice(0, 8).map((r) => `"${r.title.slice(0, 40)}" typed "${r.attributes.mold_name}" but under "${byId.get(r.parent_id)?.title}" (${byId.get(r.parent_id)?.scale})`));

// ── Slugs ──
say("rows with no slug", items.filter((i) => !i.slug || !i.maker_slug).length);
const slugKey = count(items, (i) => `${i.maker_slug}/${i.slug}`);
say("duplicate maker_slug/slug pairs (URL collision)", Object.values(slugKey).filter((n) => n > 1).length, Object.entries(slugKey).filter(([, n]) => n > 1).slice(0, 5).map(([k, n]) => `${k} ×${n}`));
say("rows whose slug carries a -N suffix", items.filter((i) => /-\d+$/.test(i.slug ?? "")).length);

// ── Attribution (156) ──
say("artist_resin rows with a manufacturer but no artist", resin.filter((r) => r.manufacturer && !r.artist).length);
say("artist_resin rows with neither artist nor maker", resin.filter((r) => !r.artist && !r.maker).length);
say("plastic rows with an artist set", items.filter((i) => i.item_type.startsWith("plastic") && i.artist).length, items.filter((i) => i.item_type.startsWith("plastic") && i.artist).slice(0, 5).map((i) => `${i.maker} "${i.title}" artist=${i.artist}`));

// ── Formats (one shape per field) ──
const yrText = items.filter((i) => typeof i.attributes?.release_year_start === "string" || typeof i.attributes?.release_year_end === "string");
say("years stored as text instead of numbers", yrText.length);
const col = items.map((i) => i.attributes?.color_description).filter((v) => typeof v === "string" && v.trim());
say("colour descriptions starting lowercase / uppercase", `${col.filter((v) => /^[a-z]/.test(v)).length} / ${col.filter((v) => /^[A-Z]/.test(v)).length}`);
// Same rule as hasTrailingPunctuation in src/lib/catalog/corrections.ts: an abbreviation's period ("I.C.E.", "Co.") is fine.
const ABBREVIATION_END = /(?:(?<!\p{L})\p{L}|\b(?:Co|Jr|Sr|Inc|Ltd|St|Mr|Mrs|Ms|Dr|No|Bros|Corp|Mt|vs))\.$/u;
const strayEnd = (s) => /[.,;:]$/.test(s.trim()) && !ABBREVIATION_END.test(s.trim());
say("titles ending in punctuation (usually a description pasted into the title)", t(strayEnd).length, t(strayEnd).map((i) => i.title.slice(0, 80)));
say("titles starting lowercase", t((s) => /^[a-z]/.test(s)).length, t((s) => /^[a-z]/.test(s)).map((i) => i.title));
const people = {};
for (const i of items) for (const c of ["maker", "artist"]) if (i[c]) people[i[c]] = (people[i[c]] ?? 0) + 1;
const names = Object.keys(people);
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, x) => [x]); for (let y = 1; y <= b.length; y++) d[0][y] = y; for (let x = 1; x <= a.length; x++) for (let y = 1; y <= b.length; y++) d[x][y] = Math.min(d[x - 1][y] + 1, d[x][y - 1] + 1, d[x - 1][y - 1] + (a[x - 1] === b[y - 1] ? 0 : 1)); return d[a.length][b.length]; };
const near = [];
for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
  const x = norm(names[a]), y = norm(names[b]);
  if (x.length > 6 && y.length > 6 && Math.abs(x.length - y.length) <= 2 && lev(x, y) <= 2) near.push(`${names[a]} (${people[names[a]]}) ~ ${names[b]} (${people[names[b]]})`);
}
say("maker/artist names one or two letters apart (check: typo or two people?)", near.length, near);

// ── Recency ──
say("rows added in the last 14 days", items.filter((i) => i.created_at >= new Date(Date.now() - 14 * 864e5).toISOString()).length, top(count(items.filter((i) => i.created_at >= new Date(Date.now() - 14 * 864e5).toISOString()), (i) => `${i.created_at.slice(0, 10)} ${i.item_type}`), 14).map(([k, v]) => `${k}=${v}`));

for (const o of out) console.log(`\n■ ${o.k}: ${o.v}${o.ex.length ? "\n   - " + o.ex.join("\n   - ") : ""}`);

// ── Machine-readable counts, and the week-on-week comparison ──
const arg = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };
const counts = Object.fromEntries(out.filter((o) => typeof o.v === "number").map((o) => [o.k, o.v]));
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify({ at: new Date().toISOString(), counts }, null, 2));
if (arg("--compare") && fs.existsSync(arg("--compare"))) {
  const last = JSON.parse(fs.readFileSync(arg("--compare"), "utf8"));
  const rose = Object.entries(counts).filter(([k, v]) => typeof last.counts?.[k] === "number" && v > last.counts[k] && k !== "rows" && !k.startsWith("rows added"));
  console.log(`
■ Compared with ${last.at.slice(0, 10)}: ${rose.length ? rose.length + " count(s) rose" : "nothing rose"}`);
  for (const [k, v] of rose) console.log(`   ▲ ${k}: ${last.counts[k]} → ${v}`);
}
