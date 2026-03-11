-- ============================================================
-- Migration 043: Drop Legacy Social Tables
-- Safe to run AFTER migration 042 data is verified (zero loss)
-- ============================================================
-- NOTE: We keep activity_likes + toggle_activity_like because
-- the Following tab still renders system events (new_horse,
-- favorite, follow, etc.) from activity_events with like buttons.

-- 1. Drop legacy likes tables for content that moved to posts
DROP TABLE IF EXISTS comment_likes CASCADE;
DROP TABLE IF EXISTS group_post_likes CASCADE;

-- 2. Drop legacy content tables (data migrated to posts + media_attachments)
DROP TABLE IF EXISTS horse_comments CASCADE;
DROP TABLE IF EXISTS group_post_replies CASCADE;
DROP TABLE IF EXISTS group_posts CASCADE;
DROP TABLE IF EXISTS event_comments CASCADE;
DROP TABLE IF EXISTS event_photos CASCADE;

-- 3. Remove migrated text_post rows from activity_events
-- (keep system events: new_horse, favorite, follow, rating, show_record, etc.)
DELETE FROM activity_events WHERE event_type = 'text_post';

-- 4. Drop legacy toggle functions for content that moved to posts
-- KEEP toggle_activity_like — still used by Following tab for system events
DROP FUNCTION IF EXISTS toggle_group_post_like CASCADE;
DROP FUNCTION IF EXISTS toggle_comment_like CASCADE;
