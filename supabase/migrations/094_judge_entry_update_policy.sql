-- ============================================================
-- Migration 094: Allow judges and event creators to update entries
-- ============================================================
-- Bug: saveExpertPlacings fails silently because the RLS UPDATE
-- policy on event_entries only allows the entry owner (user_id)
-- to update. Judges and event creators need to update the
-- "placing" column during expert judging.
--
-- Fix: Replace the existing policy with one that also allows:
--   1. The event creator (events.created_by)
--   2. Assigned judges (event_judges.user_id)
-- ============================================================

-- Drop the existing owner-only UPDATE policy
DROP POLICY IF EXISTS "event_entries_update" ON event_entries;

-- Create a new UPDATE policy that allows:
-- a) Entry owner (the user who entered the horse)
-- b) Event creator (the show host)
-- c) Assigned judge
CREATE POLICY "event_entries_update" ON event_entries FOR UPDATE TO authenticated
USING (
  -- Entry owner can always update their own entry
  (SELECT auth.uid()) = user_id
  OR
  -- Event creator can update entries in their event
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_entries.event_id
      AND events.created_by = (SELECT auth.uid())
  )
  OR
  -- Assigned judges can update entries in their assigned events
  EXISTS (
    SELECT 1 FROM event_judges
    WHERE event_judges.event_id = event_entries.event_id
      AND event_judges.user_id = (SELECT auth.uid())
  )
);
