# Catalog delta importer

Source-agnostic tool for adding external model data to `catalog_items` **without
re-importing known-bad data**. Parses a JSON dataset (from a source the owner
provides — e.g. an IdentifyYourBreyer event page or a Maggie Bennett micro list),
diffs it against the live catalog, and reports what's genuinely new vs. already
present vs. suppressed.

## Usage

```bash
# DRY RUN (default) — writes nothing, prints a report + drops <data>.delta-report.json
node scripts/catalog-delta/delta_import.mjs

# point at any dataset
node scripts/catalog-delta/delta_import.mjs --data ./scripts/catalog-delta/data/maggie_bennett_micros.json

# APPLY — insert the NEW rows (+ a catalog_changelog 'addition' each). Owner-gated.
node scripts/catalog-delta/delta_import.mjs --apply
```

Reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`
(searched upward from the script; no `dotenv` dependency — same pattern as the
`scripts/seed_*.mjs` tooling). Writes require the service-role key because
`catalog_items` has no user-facing insert policy.

## How it classifies

Each record lands in one bucket:

- **NEW (fresh)** — no catalog row with this title; inserted on `--apply`.
- **NEW variant** — base title exists but this colour/variation doesn't.
- **Already in catalog** — matched by model number, colour, or plain title.
- **Suppressed** — the title was previously `correction`/`removal`-ed in
  `catalog_changelog`, so we never re-add the bad data.
- **Already imported / dup** — matched by `attributes->>source_id` (idempotent
  re-runs) or a duplicate within the dataset.

## Dataset shape

```jsonc
{
  "source": "identifyyourbreyer.com/…",   // used for source_id + changelog text
  "maker": "Breyer",
  "item_type": "plastic_release",          // or micro_mini, artist_resin, …
  "year": 2026,                            // default; per-record "year" overrides
  "records": [
    {
      "name": "Corgi Hill Flinka",
      "variation": "Bell Tail Version",    // → attributes.color_description
      "scale": "Traditional",              // mapped to "Traditional (1:9)" etc.
      "model_number": "B-EV-10722",
      "finish": "Matte",
      "material": "pewter",                // → attributes.material
      "mold": "Fjord Mare",                // resolved scale-aware to a plastic_mold
      "number_produced": 1200,
      "sold_for": "$75",
      "category": "Event Model",
      "run_type": "Celebration Horse",
      "iyb_id": "4674"                      // stable id for source_id
    }
  ]
}
```

## Catalog model notes baked in

- `catalog_items` is polymorphic: only `item_type`/`title`/`maker` are columns;
  everything else lives in the `attributes` JSONB.
- Scale strings match `get_catalog_facets()`: `Traditional (1:9)`,
  `Stablemate (1:32)`, `Classic (1:12)`, `Paddock Pals (1:24)`.
- Mold identity is `(title, scale)` — resolution is scale-aware, with a small
  `MOLD_ALIAS` map for IYB↔catalog name gaps (e.g. SM `Icelandic` → `Icelandic Horse`).
- On `--apply`, absent molds referenced by new releases are auto-created first,
  then releases link via `parent_id`.

## Datasets on disk

- `data/iyb_breyerfest_2026.json` — BreyerFest 2026 (67 records). Applied: 61
  releases + 9 molds.
- `data/maggie_bennett_micros.json` — Maggie Bennett micro-minis (26 confidently
  named pieces; the JS-rendered gallery's unnamed monthly cells were excluded).
