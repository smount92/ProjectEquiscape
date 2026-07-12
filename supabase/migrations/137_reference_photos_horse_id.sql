-- ══════════════════════════════════════════════════════════════
-- Migration 137: reference photos link to their passport
-- ══════════════════════════════════════════════════════════════
-- The reference-page photo gallery showed collectors' photos of a model but had
-- no way to reach the actual horse (passport). Add horse_id to
-- get_catalog_reference_photos so each photo can link to /community/[horse_id].
-- Changing the RETURNS TABLE shape requires DROP + CREATE (CREATE OR REPLACE
-- can't change a function's return type). No deploy hazard: the currently
-- deployed code reads image_url/horse_name only and simply ignores the new
-- column. Still opt-out-aware + public-only. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS get_catalog_reference_photos(UUID, INT);

CREATE FUNCTION get_catalog_reference_photos(
  p_catalog_id UUID,
  p_limit INT DEFAULT 8
)
RETURNS TABLE (horse_id UUID, image_url TEXT, horse_name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    uh.id AS horse_id,
    COALESCE(
      (SELECT hi.image_url FROM public.horse_images hi
       WHERE hi.horse_id = uh.id AND hi.angle_profile = 'Primary_Thumbnail' LIMIT 1),
      (SELECT hi.image_url FROM public.horse_images hi
       WHERE hi.horse_id = uh.id ORDER BY hi.id LIMIT 1)
    ) AS image_url,
    uh.custom_name AS horse_name
  FROM public.user_horses uh
  JOIN public.users u ON u.id = uh.owner_id
  WHERE uh.catalog_id = p_catalog_id
    AND uh.is_public = true
    AND uh.deleted_at IS NULL
    AND COALESCE(u.show_photos_on_reference, true) = true
    AND EXISTS (SELECT 1 FROM public.horse_images hi WHERE hi.horse_id = uh.id)
  ORDER BY uh.id
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_catalog_reference_photos(UUID, INT) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 137 Complete — get_catalog_reference_photos now returns horse_id.
-- After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
