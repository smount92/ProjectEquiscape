-- ============================================================
-- Migration 048: Universal Catalog (Phase 4)
-- Grand Unification Plan — Single polymorphic reference table
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 0: ENSURE pg_trgm EXTENSION
-- ══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE CATALOG_ITEMS TABLE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS catalog_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type     TEXT NOT NULL CHECK (item_type IN (
    'plastic_mold',       -- Base sculpt (was reference_molds)
    'plastic_release',    -- Specific paint job (was reference_releases)
    'artist_resin',       -- Artist resin sculpt (was artist_resins)
    'tack',               -- Future: tack sets
    'medallion',          -- Future: medallions
    'micro_mini'          -- Future: micro/mini/stablemate
  )),
  parent_id     UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
  -- For releases: points to the mold. For others: NULL.

  -- Universal fields
  title         TEXT NOT NULL,
  -- For molds: mold_name. For releases: release_name. For resins: resin_name.
  maker         TEXT NOT NULL,
  -- For molds/releases: manufacturer (Breyer, Stone). For resins: sculptor_alias.
  scale         TEXT,
  -- Traditional, Classic, Stablemate, etc.

  -- Type-specific attributes stored in JSONB
  attributes    JSONB DEFAULT '{}',
  -- For molds:    { release_year_start }
  -- For releases: { model_number, color_description, release_year_start, release_year_end }
  -- For resins:   { cast_medium }

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users (immutable reference data)
CREATE POLICY "catalog_items_select" ON catalog_items FOR SELECT
TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE for regular users — admin/service role only

-- ══════════════════════════════════════════════════════════════
-- STEP 2: INDEXES
-- ══════════════════════════════════════════════════════════════

-- Search index (fuzzy matching on title + maker)
CREATE INDEX idx_catalog_items_title ON catalog_items USING gin (title gin_trgm_ops);
CREATE INDEX idx_catalog_items_maker ON catalog_items USING gin (maker gin_trgm_ops);

-- Type-based filtering
CREATE INDEX idx_catalog_items_type ON catalog_items (item_type);

-- Parent lookups (releases for a mold)
CREATE INDEX idx_catalog_items_parent ON catalog_items (parent_id) WHERE parent_id IS NOT NULL;

-- Composite: for searching within a type
CREATE INDEX idx_catalog_items_type_title ON catalog_items (item_type, title);

-- ══════════════════════════════════════════════════════════════
-- STEP 3: DATA MIGRATION (Zero Data Loss)
-- ══════════════════════════════════════════════════════════════

-- 3a: Migrate reference_molds → catalog_items
-- PRESERVE original UUIDs so FKs stay intact during transition
INSERT INTO catalog_items (id, item_type, title, maker, scale, attributes, created_at)
SELECT
  rm.id,
  'plastic_mold',
  rm.mold_name,
  rm.manufacturer,
  rm.scale,
  jsonb_build_object('release_year_start', rm.release_year_start),
  now()
FROM reference_molds rm
ON CONFLICT (id) DO NOTHING;

-- 3b: Migrate reference_releases → catalog_items
-- parent_id = mold's UUID (which is now also a catalog_items UUID)
INSERT INTO catalog_items (id, item_type, parent_id, title, maker, scale, attributes, created_at)
SELECT
  rr.id,
  'plastic_release',
  rr.mold_id,                  -- parent_id = the mold (same UUID in catalog_items)
  rr.release_name,
  rm.manufacturer,             -- releases inherit manufacturer from their mold
  rm.scale,                    -- releases inherit scale from their mold
  jsonb_build_object(
    'model_number', rr.model_number,
    'color_description', rr.color_description,
    'release_year_start', rr.release_year_start,
    'release_year_end', rr.release_year_end
  ),
  now()
FROM reference_releases rr
JOIN reference_molds rm ON rm.id = rr.mold_id
ON CONFLICT (id) DO NOTHING;

-- 3c: Migrate artist_resins → catalog_items
INSERT INTO catalog_items (id, item_type, title, maker, scale, attributes, created_at)
SELECT
  ar.id,
  'artist_resin',
  ar.resin_name,
  ar.sculptor_alias,
  ar.scale,
  jsonb_build_object('cast_medium', ar.cast_medium),
  now()
FROM artist_resins ar
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- STEP 4: ADD catalog_id TO REFERENCING TABLES
-- ══════════════════════════════════════════════════════════════

-- 4a: user_horses
ALTER TABLE user_horses ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_horses_catalog ON user_horses (catalog_id) WHERE catalog_id IS NOT NULL;

-- Populate catalog_id from existing FKs
-- Priority: release_id > reference_mold_id > artist_resin_id
UPDATE user_horses SET catalog_id = release_id WHERE release_id IS NOT NULL AND catalog_id IS NULL;
UPDATE user_horses SET catalog_id = reference_mold_id WHERE reference_mold_id IS NOT NULL AND catalog_id IS NULL;
UPDATE user_horses SET catalog_id = artist_resin_id WHERE artist_resin_id IS NOT NULL AND catalog_id IS NULL;

-- 4b: user_wishlists
ALTER TABLE user_wishlists ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL;

UPDATE user_wishlists SET catalog_id = release_id WHERE release_id IS NOT NULL AND catalog_id IS NULL;
UPDATE user_wishlists SET catalog_id = mold_id WHERE mold_id IS NOT NULL AND catalog_id IS NULL;

-- 4c: id_suggestions (Help ID feature)
ALTER TABLE id_suggestions ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL;

UPDATE id_suggestions SET catalog_id = reference_release_id WHERE reference_release_id IS NOT NULL AND catalog_id IS NULL;
UPDATE id_suggestions SET catalog_id = artist_resin_id WHERE artist_resin_id IS NOT NULL AND catalog_id IS NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 5: VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- SELECT 'reference_molds' AS source, count(*) FROM reference_molds
-- UNION ALL SELECT 'catalog (plastic_mold)', count(*) FROM catalog_items WHERE item_type = 'plastic_mold'
-- UNION ALL SELECT 'reference_releases', count(*) FROM reference_releases
-- UNION ALL SELECT 'catalog (plastic_release)', count(*) FROM catalog_items WHERE item_type = 'plastic_release'
-- UNION ALL SELECT 'artist_resins', count(*) FROM artist_resins
-- UNION ALL SELECT 'catalog (artist_resin)', count(*) FROM catalog_items WHERE item_type = 'artist_resin'
-- UNION ALL SELECT 'user_horses with catalog_id', count(*) FROM user_horses WHERE catalog_id IS NOT NULL
-- UNION ALL SELECT 'user_horses with old FKs', count(*) FROM user_horses WHERE reference_mold_id IS NOT NULL OR artist_resin_id IS NOT NULL OR release_id IS NOT NULL;
-- Last two counts should match.

-- ══════════════════════════════════════════════════════════════
-- STEP 6: DROP OLD COLUMNS — separate migration 049 AFTER code migrated
-- ══════════════════════════════════════════════════════════════
-- ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS horse_reference_check;
-- ALTER TABLE user_horses DROP COLUMN IF EXISTS reference_mold_id;
-- ALTER TABLE user_horses DROP COLUMN IF EXISTS artist_resin_id;
-- ALTER TABLE user_horses DROP COLUMN IF EXISTS release_id;
-- ALTER TABLE user_wishlists DROP COLUMN IF EXISTS mold_id;
-- ALTER TABLE user_wishlists DROP COLUMN IF EXISTS release_id;
-- ALTER TABLE id_suggestions DROP COLUMN IF EXISTS reference_release_id;
-- ALTER TABLE id_suggestions DROP COLUMN IF EXISTS artist_resin_id;
-- DROP TABLE IF EXISTS reference_releases CASCADE;
-- DROP TABLE IF EXISTS reference_molds CASCADE;
-- DROP TABLE IF EXISTS artist_resins CASCADE;
