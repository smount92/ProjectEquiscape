-- ============================================================
-- Migration 053: Universal Asset Expansion (Epic 2)
-- Expand user_horses to support tack, props, and dioramas
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: ADD asset_category COLUMN
-- ══════════════════════════════════════════════════════════════

ALTER TABLE user_horses ADD COLUMN IF NOT EXISTS
  asset_category TEXT NOT NULL DEFAULT 'model'
  CHECK (asset_category IN ('model', 'tack', 'prop', 'diorama'));

CREATE INDEX IF NOT EXISTS idx_user_horses_asset_category
  ON user_horses (asset_category);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: MAKE HORSE-SPECIFIC FIELDS NULLABLE
-- These fields are required for 'model' but optional for others.
-- Application logic enforces the requirement per category.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE user_horses ALTER COLUMN finish_type DROP NOT NULL;
ALTER TABLE user_horses ALTER COLUMN condition_grade DROP NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: EXPAND catalog_items.item_type CHECK
-- Add 'prop' and 'diorama' to allowed types
-- ══════════════════════════════════════════════════════════════

ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_item_type_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_item_type_check
  CHECK (item_type IN (
    'plastic_mold',
    'plastic_release',
    'artist_resin',
    'tack',
    'medallion',
    'micro_mini',
    'prop',
    'diorama'
  ));

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_name = 'user_horses'
-- AND column_name IN ('finish_type', 'condition_grade', 'asset_category');
-- Expected:
--   finish_type     | YES
--   condition_grade  | YES
--   asset_category   | NO (has default 'model')
