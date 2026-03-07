-- ============================================================
-- Migration 017: Add bio field to users table
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL;

COMMENT ON COLUMN users.bio IS 'Public bio/about text for the collector profile. Max 500 chars enforced at app layer.';
