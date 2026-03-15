-- ============================================================
-- Migration 072: Show Bio & Detail Fields
-- Adds show identity, finish details, public notes, and regional ID
-- ============================================================

-- Finish surface description (Glossy, Matte, Satin, Chalky, Semi-Gloss)
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS finish_details TEXT;
COMMENT ON COLUMN user_horses.finish_details IS 'Surface finish description (e.g., Glossy, Matte, Satin, Chalky).';

-- Public-facing notes visible on the passport (quirks, accessories, provenance notes)
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS public_notes TEXT;
COMMENT ON COLUMN user_horses.public_notes IS 'Public notes visible on passport (e.g., comes with original box, factory rubs on near leg).';

-- Show Bio: The show persona assigned by the collector for competition
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS assigned_breed TEXT;
COMMENT ON COLUMN user_horses.assigned_breed IS 'Show persona breed (e.g., Andalusian, Arabian). Used for breed division classes.';

ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS assigned_gender TEXT;
COMMENT ON COLUMN user_horses.assigned_gender IS 'Show persona gender (e.g., Stallion, Mare, Gelding). Used for gender division classes.';

ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS assigned_age TEXT;
COMMENT ON COLUMN user_horses.assigned_age IS 'Show persona age (e.g., Foal, Yearling, Adult, 5 years). Stored as text for flexibility.';

-- Regional show system ID (e.g., RX, Texas System)
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS regional_id TEXT;
COMMENT ON COLUMN user_horses.regional_id IS 'Regional show system identifier (e.g., RX number, Texas System ID).';
