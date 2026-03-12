-- ============================================================
-- Migration 062: Verified Finishing Artist
-- Prevents fake artist attribution on model horses
-- ============================================================

ALTER TABLE user_horses
    ADD COLUMN IF NOT EXISTS finishing_artist_verified BOOLEAN DEFAULT false;

-- Index for quick lookup of verified customs
CREATE INDEX IF NOT EXISTS idx_user_horses_verified_artist
    ON user_horses (finishing_artist_verified)
    WHERE finishing_artist_verified = true;
