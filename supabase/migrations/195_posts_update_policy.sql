-- ============================================================
-- 195: Authors can edit their own posts — the policy that never existed
--
-- posts has had SELECT, INSERT and DELETE policies since migration 042,
-- and never an UPDATE policy. updatePost() has therefore been silently
-- broken since the day it was written: under RLS an update with no
-- policy matches ZERO rows and returns NO error, so the action reported
-- success, the optimistic UI showed the new text, and the database kept
-- the old one. Found the first time anyone pressed the new Edit button
-- in a barn thread and then refreshed.
--
-- (Same failure shape verified on catalog_sale_reports during the 190
-- checks: RLS denies by matching nothing, which reads exactly like
-- success at the client. The action side of this fix makes updatePost
-- demand the updated row back, so a zero-row update can never report
-- success again.)
-- ============================================================

DROP POLICY IF EXISTS "posts_update_own" ON posts;
CREATE POLICY "posts_update_own" ON posts
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = author_id)
    WITH CHECK ((SELECT auth.uid()) = author_id);

-- Verify (with a CLIENT key — the SQL editor runs as postgres, bypasses
-- RLS, and would report success even without this policy):
--   1. Edit one of your own posts, refresh: the edit survives.
--   2. UPDATE posts SET content = 'x' WHERE id = '<someone else''s post>'
--      as a signed-in member: 0 rows, content unchanged.
