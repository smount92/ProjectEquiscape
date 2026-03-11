-- ============================================================
-- Migration 052: The Great Purge (Ecosystem Expansion — Epic 1)
-- Drop all legacy tables and columns after code migration
-- ============================================================
-- PRE-REQUISITE: All application code must be deployed with
-- zero references to these tables/columns BEFORE running this.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: DROP LEGACY FK COLUMNS FROM user_horses
-- ══════════════════════════════════════════════════════════════

ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS horse_reference_check;
ALTER TABLE user_horses DROP COLUMN IF EXISTS reference_mold_id;
ALTER TABLE user_horses DROP COLUMN IF EXISTS artist_resin_id;
ALTER TABLE user_horses DROP COLUMN IF EXISTS release_id;

-- ══════════════════════════════════════════════════════════════
-- STEP 2: DROP LEGACY FK COLUMNS FROM user_wishlists
-- ══════════════════════════════════════════════════════════════

ALTER TABLE user_wishlists DROP COLUMN IF EXISTS mold_id;
ALTER TABLE user_wishlists DROP COLUMN IF EXISTS release_id;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: DROP LEGACY FK COLUMNS FROM id_suggestions
-- ══════════════════════════════════════════════════════════════

ALTER TABLE id_suggestions DROP COLUMN IF EXISTS reference_release_id;
ALTER TABLE id_suggestions DROP COLUMN IF EXISTS artist_resin_id;

-- ══════════════════════════════════════════════════════════════
-- STEP 4: DROP LEGACY CATALOG TABLES
-- ══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS reference_releases CASCADE;
DROP TABLE IF EXISTS reference_molds CASCADE;
DROP TABLE IF EXISTS artist_resins CASCADE;

-- ══════════════════════════════════════════════════════════════
-- STEP 5: DROP LEGACY SOCIAL/COMPETITION TABLES
-- (These were replaced in Phases 1-3 of Grand Unification)
-- ══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS horse_comments CASCADE;
DROP TABLE IF EXISTS group_posts CASCADE;
DROP TABLE IF EXISTS group_post_replies CASCADE;
DROP TABLE IF EXISTS user_ratings CASCADE;
DROP TABLE IF EXISTS photo_shows CASCADE;
DROP TABLE IF EXISTS show_entries CASCADE;
DROP TABLE IF EXISTS show_votes CASCADE;

-- ══════════════════════════════════════════════════════════════
-- STEP 6: DROP horse_timeline (if not already dropped)
-- ══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS horse_timeline CASCADE;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION (run manually after applying)
-- ══════════════════════════════════════════════════════════════
-- Confirm no legacy tables remain:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'reference_molds', 'reference_releases', 'artist_resins',
--   'horse_comments', 'group_posts', 'group_post_replies',
--   'user_ratings', 'photo_shows', 'show_entries', 'show_votes',
--   'horse_timeline'
-- );
-- Expected: 0 rows

-- Confirm no legacy columns remain on user_horses:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_horses'
-- AND column_name IN ('reference_mold_id', 'artist_resin_id', 'release_id');
-- Expected: 0 rows

-- Confirm no legacy columns remain on user_wishlists:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_wishlists'
-- AND column_name IN ('mold_id', 'release_id');
-- Expected: 0 rows

-- Confirm no legacy columns remain on id_suggestions:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'id_suggestions'
-- AND column_name IN ('reference_release_id', 'artist_resin_id');
-- Expected: 0 rows
