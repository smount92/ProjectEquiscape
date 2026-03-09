-- ============================================================
-- Migration 027: Fix RLS for transferred horses
-- The current SELECT policies on horse_timeline, show_records,
-- and horse_pedigrees only allow viewing if you are the record
-- creator (user_id = auth.uid()) OR the horse is public.
-- After a transfer, the new owner can't see records created
-- by the previous owner on private horses.
-- Fix: add an ownership check so the current horse owner
-- can always see all records for their horse.
-- ============================================================

-- ────────────────────────────────────────
-- TABLE: horse_timeline
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "horse_timeline_select" ON horse_timeline;
CREATE POLICY "horse_timeline_select"
  ON horse_timeline FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_timeline.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM user_horses h WHERE h.id = horse_timeline.horse_id AND h.is_public = true
      )
    )
  );

-- ────────────────────────────────────────
-- TABLE: show_records
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "show_records_select" ON show_records;
CREATE POLICY "show_records_select"
  ON show_records FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = show_records.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = show_records.horse_id AND h.is_public = true
    )
  );

-- ────────────────────────────────────────
-- TABLE: horse_pedigrees
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "horse_pedigrees_select" ON horse_pedigrees;
CREATE POLICY "horse_pedigrees_select"
  ON horse_pedigrees FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_pedigrees.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_pedigrees.horse_id AND h.is_public = true
    )
  );

-- ============================================================
-- ✅ Migration 027 Complete
-- Fixed: horse_timeline, show_records, horse_pedigrees SELECT
--        policies now include ownership check so transferred
--        horses retain full history visibility for new owner.
-- ============================================================
