-- ============================================================
-- Migration 086: Hide E2E Test Accounts from Discover
-- Adds is_test_account flag to users table and excludes
-- flagged accounts from the discover_users_view.
-- ============================================================

-- 1. Add the flag (default false — no existing users affected)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT false;

-- 2. Flag the known test accounts
UPDATE users SET is_test_account = true
WHERE alias_name IN ('User_1eb8ef62', 'user_5ae5879d', 'testbot');

-- 3. Rebuild the discover view to exclude test accounts
DROP VIEW IF EXISTS discover_users_view;

CREATE VIEW discover_users_view AS
SELECT  
    u.id, 
    u.alias_name, 
    u.created_at, 
    u.avatar_url,
    u.bio,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.is_public = true) as public_horse_count,
    COALESCE((SELECT avg(stars) FROM reviews r WHERE r.target_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM reviews r WHERE r.target_id = u.id) as rating_count,
    EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id) as has_studio
FROM users u
WHERE u.account_status = 'active'
  AND u.is_test_account = false;
