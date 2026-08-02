-- ══════════════════════════════════════════════════════════════
-- Migration 147: catalog browse thumbnails (batch, anon-safe)
-- ══════════════════════════════════════════════════════════════
-- NUMBERING NOTE: 146 (public horse records RPC) was the last migration on
-- disk when this was written. If a parallel agent collides on a number, the
-- integration merger renumbers at merge (143's convention).
--
-- Powers the catalog CARDS browse (/catalog behind NEXT_PUBLIC_CATALOG_V2):
-- each identification card wants one community-photo thumbnail. Anon can't
-- read user_horses / horse_images through RLS, so this is a SECURITY DEFINER
-- batch RPC — one call resolves a thumbnail per catalog item for the whole
-- visible page instead of N per-row calls.
--
-- Privacy guards mirror get_catalog_reference_photos (migration 137) EXACTLY:
--   * horse must be public          (uh.is_public = true)
--   * and not deleted               (uh.deleted_at IS NULL)
--   * owner's reference-photo opt-out honored
--                                   (COALESCE(u.show_photos_on_reference, true))
--   * photo preference order matches 137: Primary_Thumbnail angle first,
--     else the horse's first image by id; horses chosen in uh.id order so
--     the pick is stable across calls.
--
-- Adversarial notes (what this can and cannot leak):
--   * Returns (catalog_id, image_url) pairs ONLY — never horse ids, owner
--     ids, names, or counts. The image_url is one the reference-page RPC
--     (137) already exposes publicly for the same horse.
--   * Input is hard-capped: only the first 60 array elements are read
--     (p_ids[1:60]), so a hostile caller can't turn one call into a
--     whole-table scan; unknown/garbage uuids simply match nothing.
--   * Private/deleted/opted-out horses can never influence the result, so
--     the response doesn't even reveal their existence.
--
-- The app feature-detects: until this migration is applied the RPC errors,
-- the page swallows it, and cards render with the 🐴 placeholder.
-- Additive + idempotent (CREATE OR REPLACE). After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_catalog_browse_thumbs(p_ids UUID[])
RETURNS TABLE (catalog_id UUID, image_url TEXT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT ids.id AS catalog_id, pick.image_url
  FROM (SELECT DISTINCT unnest(p_ids[1:60]) AS id) ids
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (SELECT hi.image_url FROM public.horse_images hi
       WHERE hi.horse_id = uh.id AND hi.angle_profile = 'Primary_Thumbnail' LIMIT 1),
      (SELECT hi.image_url FROM public.horse_images hi
       WHERE hi.horse_id = uh.id ORDER BY hi.id LIMIT 1)
    ) AS image_url
    FROM public.user_horses uh
    JOIN public.users u ON u.id = uh.owner_id
    WHERE uh.catalog_id = ids.id
      AND uh.is_public = true
      AND uh.deleted_at IS NULL
      AND COALESCE(u.show_photos_on_reference, true) = true
      AND EXISTS (SELECT 1 FROM public.horse_images hi WHERE hi.horse_id = uh.id)
    ORDER BY uh.id
    LIMIT 1
  ) pick
  WHERE pick.image_url IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION get_catalog_browse_thumbs(UUID[]) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 147 Complete — get_catalog_browse_thumbs(). One thumbnail per
-- catalog item for the visible browse page (≤60 ids), 137-guarded.
-- After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
