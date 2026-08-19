-- ============================================================
-- 151 — HOTFIX: show entries broken by 148 × 133 collision
--
-- THE BUG (user-reported: "Permission denied for table users" when
-- entering a class): migration 133 revoked table-level SELECT on
-- users and re-granted an explicit COLUMN list. Migration 148 added
-- is_suspended (not in that list) and referenced it inside the
-- show_class_entries INSERT policy's subquery — which runs with the
-- entrant's own privileges. Column ACL denies it, Postgres reports
-- "permission denied for table users", and EVERY entry INSERT has
-- failed since 148 was applied. During the entry window.
--
-- THE FIX: read the flag through a SECURITY DEFINER helper (owner
-- privileges bypass the column ACL) instead of granting the column —
-- suspension state stays unreadable to clients, and the policy works.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_caller_suspended()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT u.is_suspended FROM public.users u WHERE u.id = (SELECT auth.uid())),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_caller_suspended() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_caller_suspended() TO authenticated;

-- Recreate the INSERT policy from 148 with the helper swapped in.
-- All other conditions verbatim.
DROP POLICY IF EXISTS "Owner enters own horse while entries open" ON show_class_entries;

CREATE POLICY "Owner enters own horse while entries open"
  ON show_class_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_class_entries.show_id
        AND s.status = 'entries_open'
        AND (s.entries_close_at IS NULL OR s.entries_close_at >= now())
    )
    AND EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = show_class_entries.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM show_barred_entrants b
      WHERE b.show_id = show_class_entries.show_id
        AND b.user_id = (SELECT auth.uid())
    )
    AND NOT public.is_caller_suspended()
  );

-- ============================================================
-- Verify (as any signed-in test account): entering an open class
-- succeeds again. Suspension still enforced: suspend a test user
-- and their entry INSERT is refused.
-- ============================================================
