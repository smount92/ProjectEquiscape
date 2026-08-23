-- ============================================================
-- 186: Make the Members directory actually return members
--
-- THE BUG. discover_users_view (last defined in 169) is
-- security_invoker = true, so it runs with the CALLER's permissions —
-- and its WHERE clause reads u.is_suspended, a column that was never
-- added to the column-level SELECT grants on users (133/142 model;
-- 169's own completion note says so). Under security_invoker a caller
-- must be able to read EVERY column the view references, so every
-- client SELECT on the view has failed with 42501 "permission denied
-- for table users" since 169 was applied. The Members room swallowed
-- the error and rendered "Nobody here yet" — with a correct count
-- beside it, because the count query reads only granted columns.
--
-- Found because a member finally said the room looked empty. It had
-- been empty for everyone, signed in or not, since before launch.
--
-- THE FIX, in the view's own established pattern: the two other
-- privileged reads in this view (public_horse_count, total_horse_count)
-- already go through SECURITY DEFINER functions. The suspension check
-- becomes the third. The helper returns only a boolean; suspended
-- members are indistinguishable from deleted ones from the outside,
-- which is exactly how the directory already treats them.
--
-- The view's name, columns and security_invoker setting are unchanged —
-- no application code changes, nothing to deploy. Paste and the room
-- fills in.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_user_suspended(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u.is_suspended FROM users u WHERE u.id = p_user_id),
    false
  );
$$;

COMMENT ON FUNCTION public.is_user_suspended(UUID) IS
  'Boolean-only DEFINER read of users.is_suspended, for views/queries that must filter suspended members without granting the column itself. Same pattern as count_user_horses_public (108).';

REVOKE ALL ON FUNCTION public.is_user_suspended(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_suspended(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW discover_users_view
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.alias_name,
    u.created_at,
    u.avatar_url,
    u.bio,
    count_user_horses_public(u.id) as public_horse_count,
    COALESCE((SELECT avg(stars) FROM reviews r WHERE r.target_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM reviews r WHERE r.target_id = u.id) as rating_count,
    EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id) as has_studio,
    count_user_horses_total(u.id) as total_horse_count
FROM users u
WHERE u.account_status = 'active'
  AND u.is_test_account = false
  AND is_user_suspended(u.id) IS NOT TRUE;

-- Verify (as it will actually be read — with a CLIENT key, not the SQL
-- editor, which runs as postgres and hides exactly this class of bug):
--   1. SELECT count(*) FROM discover_users_view;      -- sanity: rows exist
--   2. From the live site, open /discover logged OUT and logged IN —
--      member cards should render on both.
--   3. The bug's signature, should it ever return: the header shows a
--      real member count while the list says "Nobody here yet".
