-- ══════════════════════════════════════════════════════════════
-- Migration 135: anon-safe public passport (FUNNEL-4)
-- ══════════════════════════════════════════════════════════════
-- Lets logged-out visitors view a public horse's passport (/community/[id]).
-- user_horses is SELECT TO authenticated (migration 109), so anon can't read it
-- — this SECURITY DEFINER RPC returns ONLY the public-safe fields for a horse
-- whose visibility is public/unlisted, plus the owner's alias and catalog info.
-- Explicit field list (never `SELECT *`) so no private column leaks; owner_id is
-- deliberately omitted. Aggregate/public data only — no vault, no email/name.
-- Additive + idempotent. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_public_passport(p_horse_id UUID)
RETURNS TABLE (
  horse JSONB,
  owner_alias TEXT,
  catalog JSONB,
  images JSONB
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    jsonb_build_object(
      'id', uh.id,
      'custom_name', uh.custom_name,
      'finish_type', uh.finish_type,
      'condition_grade', uh.condition_grade,
      'asset_category', uh.asset_category,
      'attributes', uh.attributes,
      'created_at', uh.created_at,
      'finishing_artist', uh.finishing_artist,
      'finishing_artist_verified', uh.finishing_artist_verified,
      'edition_number', uh.edition_number,
      'edition_size', uh.edition_size,
      'catalog_id', uh.catalog_id,
      'trade_status', uh.trade_status,
      'listing_price', uh.listing_price,
      'finish_details', uh.finish_details,
      'public_notes', uh.public_notes,
      'assigned_breed', uh.assigned_breed,
      'assigned_gender', uh.assigned_gender,
      'assigned_age', uh.assigned_age,
      'regional_id', uh.regional_id
    ) AS horse,
    u.alias_name AS owner_alias,
    CASE WHEN ci.id IS NULL THEN NULL ELSE jsonb_build_object(
      'title', ci.title,
      'maker', ci.maker,
      'maker_slug', ci.maker_slug,
      'slug', ci.slug,
      'scale', ci.scale,
      'item_type', ci.item_type,
      'attributes', ci.attributes
    ) END AS catalog,
    COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object(
                 'image_url', hi.image_url,
                 'angle_profile', hi.angle_profile,
                 'short_slug', hi.short_slug
               ) ORDER BY hi.uploaded_at
             )
      FROM public.horse_images hi
      WHERE hi.horse_id = uh.id
    ), '[]'::jsonb) AS images
  FROM public.user_horses uh
  JOIN public.users u ON u.id = uh.owner_id
  LEFT JOIN public.catalog_items ci ON ci.id = uh.catalog_id
  WHERE uh.id = p_horse_id
    AND uh.visibility IN ('public', 'unlisted')
    AND uh.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION get_public_passport(UUID) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 135 Complete — get_public_passport(). After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
