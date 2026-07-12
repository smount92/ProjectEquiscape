-- ══════════════════════════════════════════════════════════════
-- Migration 131: Reference-page photo opt-out
-- ══════════════════════════════════════════════════════════════
-- A per-user privacy control: even with public horses, a collector can opt out
-- of having their photos featured in the community galleries on public
-- reference pages. Default is on (photos shown) — this is an opt-OUT.
--
-- Delivered via a SECURITY DEFINER RPC because reference pages are anon-facing
-- and the users table is SELECT-only for `authenticated` (migration 022), so a
-- plain join would hide photos from anon. The RPC bypasses RLS, applies the
-- opt-out, and returns only public-safe fields. Aggregate/photo data only —
-- no owner identity, no vault values. Additive + idempotent.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_photos_on_reference BOOLEAN NOT NULL DEFAULT true;

-- Representative photos of a catalog model from public horses whose owners
-- haven't opted out. Returns the storage path + the owner's horse name (used to
-- caption different finishes on a mold). Thumbnail preferred, else first image.
CREATE OR REPLACE FUNCTION get_catalog_reference_photos(
  p_catalog_id UUID,
  p_limit INT DEFAULT 8
)
RETURNS TABLE (image_url TEXT, horse_name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
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
-- ✅ Migration 131 Complete — users.show_photos_on_reference (default true) +
-- get_catalog_reference_photos(). After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
