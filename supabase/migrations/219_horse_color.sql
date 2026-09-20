-- 219: Color / pattern on the show identity (2026-09-20).
--
-- Two members asked within a day: a new collector wanting a color field
-- "for workmanship divisions", and the owner's wife pointing out that an
-- OOAK Peter Stone's color is identity a judge should see, not a finish
-- detail. One nullable text column on user_horses, entered with breed,
-- gender and age under Show Identity, shown on both passports, and read
-- first by the judge's identity line (lib/shows/queries) ahead of the
-- registry's color and the finish type. Before the paste the app strips
-- it from saves and reads it as empty.

ALTER TABLE public.user_horses
  ADD COLUMN IF NOT EXISTS color TEXT
    CHECK (color IS NULL OR char_length(color) <= 60);

COMMENT ON COLUMN public.user_horses.color IS
  'Show identity: the color / pattern as the owner writes it ("bay tobiano"). Judges read it ahead of the registry''s color_description and the finish type.';

-- get_public_passport carries the key (same signature as 217).

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
      'regional_id', uh.regional_id,
      'resin_material', uh.resin_material,
      'resin_body', uh.resin_body,
      'cast_by', uh.cast_by,
      'prep_artist', uh.prep_artist,
      'color', uh.color
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
