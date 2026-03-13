-- ============================================================
-- Migration 070: Add "stripped" life stage
-- For models stripped of factory paint, sold as bodies
-- ============================================================

ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS user_horses_life_stage_check;

ALTER TABLE user_horses ADD CONSTRAINT user_horses_life_stage_check
    CHECK (life_stage IS NULL OR life_stage IN ('blank', 'stripped', 'in_progress', 'completed', 'for_sale', 'parked'));
