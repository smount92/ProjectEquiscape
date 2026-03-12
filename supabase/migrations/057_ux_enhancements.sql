-- ============================================================
-- Migration 057: V17 UX Enhancements
-- 1. Add `visibility` column to user_horses (public/private/unlisted)
-- 2. Add `sort_order` column to horse_images (photo reordering)
-- ============================================================

-- ── 1. Granular Visibility ──────────────────────────────────

ALTER TABLE user_horses
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private', 'unlisted'));

-- Migrate existing data: is_public = true → 'public', false → 'private'
UPDATE user_horses SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END;

-- Update RLS policies for community/show ring queries
-- The Show Ring should only show visibility = 'public'
-- Unlisted horses are accessible via direct URL but not in search/grid

-- ── 2. Photo Sort Order ─────────────────────────────────────

ALTER TABLE horse_images
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Set initial sort order based on insertion order (id)
UPDATE horse_images SET sort_order = sub.rn
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY horse_id ORDER BY id) AS rn
    FROM horse_images
) sub
WHERE horse_images.id = sub.id;

-- Index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_horse_images_sort ON horse_images(horse_id, sort_order);
