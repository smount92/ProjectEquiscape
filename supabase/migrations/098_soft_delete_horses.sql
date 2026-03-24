-- ═══════════════════════════════════════
-- MIGRATION 098: Soft-Delete for user_horses
-- ═══════════════════════════════════════
-- Adds a `deleted_at` timestamp column and a partial index
-- so deleted horses are excluded from normal queries but
-- their FK relationships (hoofprint, transfers, show records) survive.

ALTER TABLE user_horses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index: only non-deleted horses appear in normal queries
CREATE INDEX IF NOT EXISTS idx_user_horses_active
  ON user_horses (owner_id)
  WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN user_horses.deleted_at IS 'Soft-delete timestamp. When set, the horse is treated as deleted but FK relationships (transfers, show records, hoofprint) are preserved.';
