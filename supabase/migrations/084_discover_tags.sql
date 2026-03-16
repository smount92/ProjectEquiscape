-- ============================================================
-- Migration 084: Enhance Discover View with Bio + Studio Tags
-- Adds bio text + has_studio flag to discover_users_view
-- for client-side searching and tag filtering.
-- ============================================================

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
WHERE u.account_status = 'active';
