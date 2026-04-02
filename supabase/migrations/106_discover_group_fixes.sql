-- ============================================================
-- Migration 106: Discover + Group Member Count Fixes
-- 1. Add total_horse_count to discover_users_view
-- 2. Replace denormalized member_count with actual count from group_memberships
-- ============================================================

-- 1. Recreate discover_users_view with total_horse_count
DROP VIEW IF EXISTS discover_users_view;

CREATE VIEW discover_users_view
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.alias_name,
    u.created_at,
    u.avatar_url,
    u.bio,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.is_public = true AND h.deleted_at IS NULL) as public_horse_count,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.deleted_at IS NULL) as total_horse_count,
    COALESCE((SELECT avg(stars) FROM reviews r WHERE r.target_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM reviews r WHERE r.target_id = u.id) as rating_count,
    EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id) as has_studio
FROM users u
WHERE u.account_status = 'active'
  AND u.is_test_account = false;

GRANT SELECT ON discover_users_view TO anon, authenticated;
