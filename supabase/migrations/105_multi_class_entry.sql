-- ============================================================
-- Migration 105: Multi-Class Entry Support
-- Allow the same horse to be entered in multiple classes
-- ============================================================

-- Drop the old unique constraint that only allowed one entry per horse per show
ALTER TABLE event_entries DROP CONSTRAINT IF EXISTS event_entries_unique;

-- Add new unique constraint: one entry per horse per class per show
-- NULLS NOT DISTINCT ensures that (event_id, horse_id, NULL) is also unique
-- (i.e., a horse can only have one "General/no class" entry per show)
CREATE UNIQUE INDEX event_entries_unique_class
  ON event_entries (event_id, horse_id, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'));
