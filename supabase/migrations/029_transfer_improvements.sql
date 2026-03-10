-- ============================================================
-- Migration 029: Transfer Architecture Improvements
-- Fixes: ownership_history RLS, pedigree UPDATE, ghost remnants
-- ============================================================

-- 1. Fix horse_ownership_history SELECT
--    Problem: New owner can't see chain of custody on private horses
--    because the policy uses `auth.uid() = owner_id` (the record's
--    owner, not the horse's current owner).
DROP POLICY IF EXISTS "horse_ownership_history_select" ON horse_ownership_history;
CREATE POLICY "horse_ownership_history_select"
  ON horse_ownership_history FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_ownership_history.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_ownership_history.horse_id
        AND h.is_public = true
    )
  );

-- 2. Fix horse_pedigrees UPDATE
--    Problem: New owner can't update pedigree on transferred horse
--    because UPDATE policy uses `auth.uid() = user_id` (the original
--    creator, not the current owner).
DROP POLICY IF EXISTS "Owner can update own pedigree" ON horse_pedigrees;
DROP POLICY IF EXISTS "Owner can update pedigree" ON horse_pedigrees;
CREATE POLICY "Owner can update pedigree"
  ON horse_pedigrees FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_pedigrees.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_pedigrees.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
  );

-- 3. Add snapshot columns for ghost remnants
--    When a horse is transferred, the seller keeps a ghost card
--    showing the horse's name and thumbnail at time of transfer.
ALTER TABLE horse_ownership_history
  ADD COLUMN IF NOT EXISTS horse_name TEXT,
  ADD COLUMN IF NOT EXISTS horse_thumbnail TEXT;

-- ============================================================
-- ✅ Migration 029 Complete
-- Fixed: ownership_history SELECT, pedigree UPDATE for transfers
-- Added: ghost snapshot columns (horse_name, horse_thumbnail)
-- ============================================================
