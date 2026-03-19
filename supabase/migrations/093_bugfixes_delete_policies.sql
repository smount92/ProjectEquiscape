-- ============================================================
-- Migration 093: Bug fixes — missing RLS policies + posts delete
-- ============================================================

-- 1. id_requests: Add DELETE policy (owner can delete own requests)
CREATE POLICY "Owner deletes own requests"
  ON id_requests FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 2. id_suggestions: Add DELETE policy (owner can delete own suggestions,
--    or cascade from id_requests delete handles it, but explicit RLS still needed)
CREATE POLICY "Owner deletes own suggestions"
  ON id_suggestions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 3. posts: Ensure DELETE policy exists for post authors
-- Check if one exists first; if not, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname ILIKE '%delete%'
  ) THEN
    EXECUTE 'CREATE POLICY "Author deletes own posts" ON posts FOR DELETE TO authenticated USING ((SELECT auth.uid()) = author_id)';
  END IF;
END $$;
