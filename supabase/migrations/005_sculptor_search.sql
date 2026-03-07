-- ============================================================
-- Migration 005: Sculptor / Artist Field + Search Support
-- Adds a sculptor column to user_horses for manual artist tagging,
-- especially critical for Artist Resins and unlisted models.
-- ============================================================

-- 1. Add optional sculptor column to user_horses
ALTER TABLE user_horses
ADD COLUMN sculptor TEXT;

COMMENT ON COLUMN user_horses.sculptor IS 'Optional sculptor/artist tag for Artist Resins or unlisted models.';

-- 2. Create index on sculptor for potential future server-side queries
CREATE INDEX idx_user_horses_sculptor ON user_horses(sculptor) WHERE sculptor IS NOT NULL;

-- ============================================================
-- ✅ MIGRATION COMPLETE
-- New column: user_horses.sculptor (nullable TEXT)
-- New index: btree on sculptor
-- ============================================================
