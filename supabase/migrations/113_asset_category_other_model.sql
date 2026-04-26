-- ============================================================
-- Migration 113: Asset Category Expansion
-- 1. Add 'other_model' to asset_category CHECK constraint
-- 2. Add 'attributes' JSONB column to user_horses
-- 3. Add 'non_horse' boolean to event_entries (data-model prep)
-- ============================================================

-- STEP 1: EXPAND asset_category CHECK constraint
ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS user_horses_asset_category_check;
ALTER TABLE user_horses ADD CONSTRAINT user_horses_asset_category_check
  CHECK (asset_category IN ('model', 'tack', 'prop', 'diorama', 'other_model'));

-- STEP 2: ADD attributes JSONB column to user_horses
ALTER TABLE user_horses ADD COLUMN IF NOT EXISTS
  attributes jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_horses.attributes IS 'Category-specific attributes stored as JSONB. Schema varies by asset_category. Validated in application layer via validateAttributes().';

-- STEP 3: ADD non_horse flag to event_entries (future-proofing)
ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS non_horse boolean DEFAULT false;
COMMENT ON COLUMN event_entries.non_horse IS 'Flag for future non-horse entries (tack, props). UI not yet built.';
