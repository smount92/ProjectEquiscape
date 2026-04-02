-- ============================================================
-- Migration 107: Fix discover_users_view to use visibility column
-- The `is_public` boolean drifts from `visibility` string on
-- bulk operations and quick-add. Switch to the authoritative column.
-- ============================================================

CREATE OR REPLACE VIEW discover_users_view
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.alias_name,
    u.created_at,
    u.avatar_url,
    u.bio,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.visibility = 'public' AND h.deleted_at IS NULL) as public_horse_count,
    COALESCE((SELECT avg(stars) FROM reviews r WHERE r.target_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM reviews r WHERE r.target_id = u.id) as rating_count,
    EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id) as has_studio,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.deleted_at IS NULL) as total_horse_count
FROM users u
WHERE u.account_status = 'active'
  AND u.is_test_account = false;
