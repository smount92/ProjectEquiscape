-- Migration 112: Friendly Photo URLs
-- Adds short_slug to horse_images for shareable /photo/xxx links
-- Also widens RLS to allow anon SELECT for social preview crawlers

-- ═══════════════════════════════════════════════════════════════
-- PART A: Schema Changes
-- ═══════════════════════════════════════════════════════════════

-- Add short_slug column (nullable to allow gradual backfill)
ALTER TABLE horse_images
  ADD COLUMN IF NOT EXISTS short_slug TEXT UNIQUE;

-- Index for fast lookup on the /photo/[slug] route
CREATE INDEX IF NOT EXISTS idx_horse_images_short_slug
  ON horse_images(short_slug) WHERE short_slug IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- PART B: RLS — Allow anon read access for public, non-deleted horses
-- CRITICAL: Without this, social platform crawlers (Facebook, Twitter,
-- Discord, Blab) cannot fetch OG metadata from /photo/[slug] pages.
-- The crawlers hit our route as anon users with no auth token.
-- ═══════════════════════════════════════════════════════════════

-- Widen horse_images SELECT: authenticated OR (anon + public horse + not deleted)
DROP POLICY IF EXISTS "horse_images_select" ON horse_images;
CREATE POLICY "horse_images_select"
  ON horse_images FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND (
          user_horses.owner_id = (SELECT auth.uid())
          OR (user_horses.is_public = true AND user_horses.deleted_at IS NULL)
        )
    )
  );

-- Widen user_horses SELECT: anon can see public, non-deleted horses
-- (Required for the join in getPhotoBySlug to work for anon crawlers)
DROP POLICY IF EXISTS "user_horses_select" ON user_horses;
CREATE POLICY "user_horses_select"
  ON user_horses FOR SELECT
  TO authenticated, anon
  USING (
    (SELECT auth.uid()) = owner_id
    OR (is_public = true AND deleted_at IS NULL)
  );

-- ═══════════════════════════════════════════════════════════════
-- PART C: Slug Generation
-- ═══════════════════════════════════════════════════════════════

-- Backfill RPC: generates 8-char URL-safe slugs for all existing images
CREATE OR REPLACE FUNCTION backfill_photo_short_slugs()
RETURNS integer AS $$
DECLARE
  rec RECORD;
  new_slug TEXT;
  updated_count INTEGER := 0;
BEGIN
  FOR rec IN SELECT id FROM horse_images WHERE short_slug IS NULL
  LOOP
    -- Generate 8-char URL-safe slug (no +, /, =)
    new_slug := replace(replace(replace(
      encode(gen_random_bytes(6), 'base64'),
      '+', ''), '/', ''), '=', '');
    new_slug := left(new_slug, 8);

    BEGIN
      UPDATE horse_images SET short_slug = new_slug WHERE id = rec.id;
      updated_count := updated_count + 1;
    EXCEPTION WHEN unique_violation THEN
      new_slug := replace(replace(replace(
        encode(gen_random_bytes(6), 'base64'),
        '+', ''), '/', ''), '=', '');
      new_slug := left(new_slug, 8);
      UPDATE horse_images SET short_slug = new_slug WHERE id = rec.id;
      updated_count := updated_count + 1;
    END;
  END LOOP;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-assign slug on new image INSERT
CREATE OR REPLACE FUNCTION trg_horse_images_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.short_slug IS NULL THEN
    NEW.short_slug := replace(replace(replace(
      encode(gen_random_bytes(6), 'base64'),
      '+', ''), '/', ''), '=', '');
    NEW.short_slug := left(NEW.short_slug, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_horse_images_auto_slug
  BEFORE INSERT ON horse_images
  FOR EACH ROW EXECUTE FUNCTION trg_horse_images_slug();
