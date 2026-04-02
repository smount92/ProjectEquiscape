-- ============================================================
-- Migration 108: RLS-Safe Horse Counting
-- The discover_users_view has security_invoker=true, meaning
-- its subqueries inherit RLS. The user_horses SELECT policy
-- only allows seeing your-own OR is_public=true horses.
-- This means total_horse_count returns 0 when viewed by others.
--
-- Fix: SECURITY DEFINER helper functions bypass RLS for counting.
-- ============================================================

-- Count ALL non-deleted horses for a user (bypasses RLS)
CREATE OR REPLACE FUNCTION count_user_horses_total(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*)
  FROM user_horses
  WHERE owner_id = p_user_id
    AND deleted_at IS NULL;
$$;

-- Count PUBLIC non-deleted horses for a user (bypasses RLS)
CREATE OR REPLACE FUNCTION count_user_horses_public(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*)
  FROM user_horses
  WHERE owner_id = p_user_id
    AND visibility = 'public'
    AND deleted_at IS NULL;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION count_user_horses_total(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION count_user_horses_public(UUID) TO authenticated;

-- Now update the view to use these RLS-bypassing functions
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
  AND u.is_test_account = false;
