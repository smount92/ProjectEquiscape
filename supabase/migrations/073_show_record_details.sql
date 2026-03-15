-- ============================================================
-- Migration 073: Show Record Detail Fields
-- Adds location, section, award category, competition level, and fuzzy date
-- ============================================================

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS show_location TEXT;
COMMENT ON COLUMN show_records.show_location IS 'Show location (e.g., Dallas TX, Ontario Canada).';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS section_name TEXT;
COMMENT ON COLUMN show_records.section_name IS 'Show section (e.g., Halter, Performance, Collectibility).';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS award_category TEXT;
COMMENT ON COLUMN show_records.award_category IS 'Award judging category (e.g., Breed, Workmanship, Color, Gender).';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS competition_level TEXT;
COMMENT ON COLUMN show_records.competition_level IS 'Competition level (e.g., Open, Novice, Intermediate, Youth).';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS show_date_text TEXT;
COMMENT ON COLUMN show_records.show_date_text IS 'Fuzzy show date for when exact date is unknown (e.g., Spring 2023, Summer 2015).';
