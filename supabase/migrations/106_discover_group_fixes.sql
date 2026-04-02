-- ============================================================
-- Migration 106: Discover + Group Member Count Fixes
-- 1. Add total_horse_count to discover_users_view
-- 2. Fix public_horse_count to exclude soft-deleted horses
-- ============================================================

-- Uses CREATE OR REPLACE VIEW instead of DROP+CREATE.
-- This is non-destructive: no view downtime, no GRANT re-issue needed.
-- Only adds a new column (total_horse_count) and modifies the subquery
-- for public_horse_count — both are safe operations for REPLACE.

CREATE OR REPLACE VIEW discover_users_view
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
