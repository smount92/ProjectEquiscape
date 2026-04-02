-- ============================================================
-- Migration 106: Discover + Group Member Count Fixes
-- 1. Add total_horse_count to discover_users_view
-- 2. Fix public_horse_count to exclude soft-deleted horses
-- ============================================================

-- CREATE OR REPLACE VIEW requires new columns at the END.
-- Existing column order: id, alias_name, created_at, avatar_url, bio,
--   public_horse_count, avg_rating, rating_count, has_studio
-- New column: total_horse_count → appended after has_studio.

CREATE OR REPLACE VIEW discover_users_view
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.alias_name,
    u.created_at,
    u.avatar_url,
    u.bio,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.is_public = true AND h.deleted_at IS NULL) as public_horse_count,
    COALESCE((SELECT avg(stars) FROM reviews r WHERE r.target_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM reviews r WHERE r.target_id = u.id) as rating_count,
    EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id) as has_studio,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.deleted_at IS NULL) as total_horse_count
FROM users u
WHERE u.account_status = 'active'
  AND u.is_test_account = false;
