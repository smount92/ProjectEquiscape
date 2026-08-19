-- ============================================================
-- 156: Attribution split — artist vs manufacturer
-- (owner decision 2026-08-19, from MODEL HORSES INTERNATIONAL's
-- Maker→Artist request)
--
-- A catalog row credits up to two parties:
--   artist        — a person: the sculptor of a factory mold, or
--                   the resin/micro/medallion artist.
--   manufacturer  — a company: Breyer, Peter Stone, North Light…
--                   NULL for one-person artist pieces.
--
-- The legacy `maker` column is NOT renamed or rewritten: it stays
-- the row's primary attribution and the permanent basis of the
-- maker_slug reference URLs. No links change, ever. The backfill
-- below is mechanical and mirrors deriveAttribution() in
-- src/lib/catalog/taxonomy.ts — keep the two in sync.
-- ============================================================

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS artist TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT;

COMMENT ON COLUMN catalog_items.artist IS
  'The person credited: sculptor of a factory piece, or the artist of an artist piece. Display label "Artist".';
COMMENT ON COLUMN catalog_items.manufacturer IS
  'The company credited (Breyer, North Light, ...). NULL for one-person artist pieces. Display label "Manufacturer".';

-- Artist-attributed categories: maker IS the artist.
UPDATE catalog_items
SET artist = maker
WHERE artist IS NULL
  AND item_type IN ('artist_resin', 'micro_mini', 'medallion')
  AND trim(maker) <> '';

-- Factory categories: maker IS the manufacturer; the sculptor
-- credit (attributes->>'sculptor') is the artist where recorded.
UPDATE catalog_items
SET manufacturer = maker
WHERE manufacturer IS NULL
  AND item_type NOT IN ('artist_resin', 'micro_mini', 'medallion')
  AND trim(maker) <> '';

UPDATE catalog_items
SET artist = trim(attributes->>'sculptor')
WHERE artist IS NULL
  AND item_type NOT IN ('artist_resin', 'micro_mini', 'medallion')
  AND trim(coalesce(attributes->>'sculptor', '')) <> '';
