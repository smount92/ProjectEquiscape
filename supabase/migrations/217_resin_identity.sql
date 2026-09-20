-- 217: Artist resin identity — material, body, caster, prep artist
-- (2026-09-20).
--
-- Asked for by the first professional artist on the site: a resin's
-- passport should say whether it is a white urethane cast, a print or an
-- injection-moulded piece (Chronos Miniatures), hollow or solid, who cast
-- it (MVS, Jolt…) and who prepped it before the finisher. Four nullable
-- columns on user_horses; the forms show them only for the Artist Resin
-- finish. Before this is pasted the app strips them from saves and reads
-- them as empty, so nothing degrades but the four rows.
--
-- Three things change:
--   1. user_horses gains the columns (with their vocabularies as CHECKs).
--   2. get_public_passport (135) carries the four keys in the horse jsonb
--      — same signature, so CREATE OR REPLACE is enough.
--   3. v_artist_finished_horses (216) gains a third branch: prep credits
--      by name, so a studio's wall shows the resins it prepped as well as
--      the ones it finished. get_studio_wall (212) reads the view by name.

ALTER TABLE public.user_horses
  ADD COLUMN IF NOT EXISTS resin_material TEXT
    CHECK (resin_material IS NULL OR resin_material IN ('cast_resin', 'printed_resin', 'injection_molded')),
  ADD COLUMN IF NOT EXISTS resin_body TEXT
    CHECK (resin_body IS NULL OR resin_body IN ('hollow', 'solid')),
  ADD COLUMN IF NOT EXISTS cast_by TEXT
    CHECK (cast_by IS NULL OR char_length(cast_by) <= 100),
  ADD COLUMN IF NOT EXISTS prep_artist TEXT
    CHECK (prep_artist IS NULL OR char_length(prep_artist) <= 100);

COMMENT ON COLUMN public.user_horses.resin_material IS
  'Artist resin only: cast_resin (urethane cast), printed_resin (3D print) or injection_molded.';
COMMENT ON COLUMN public.user_horses.resin_body IS
  'Artist resin only: hollow or solid.';
COMMENT ON COLUMN public.user_horses.cast_by IS
  'Artist resin only: the casting studio (MVS, Jolt…), as the owner wrote it.';
COMMENT ON COLUMN public.user_horses.prep_artist IS
  'Artist resin only: who prepped the casting, as the owner wrote it. Matched by name to a studio for its wall (v_artist_finished_horses branch 3).';

-- ── 2. The public passport RPC ──────────────────────────────────────

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
      'prep_artist', uh.prep_artist
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

-- ── 3. The wall: finishing credits, then prep credits ───────────────

DROP VIEW IF EXISTS public.v_artist_finished_horses;
CREATE VIEW public.v_artist_finished_horses
WITH (security_invoker = true) AS
-- Branch 1 — work records (unchanged from 212).
SELECT
  uh.id                          AS horse_id,
  uh.owner_id,
  uh.custom_name                 AS horse_name,
  uh.finishing_artist,
  uh.finishing_artist_verified,
  uh.is_public,
  uh.catalog_id,
  uh.created_at                  AS horse_created_at,
  uh.deleted_at                  AS horse_deleted_at,
  cl.id                          AS log_id,
  cl.artist_user_id,
  cl.commission_id,
  cl.work_type,
  cl.date_completed,
  cl.recorded_by,
  cl.owner_confirmed_at,
  cl.disavowed_at,
  (
    COALESCE(uh.finishing_artist_verified, false)
    OR cl.owner_confirmed_at IS NOT NULL
    OR cl.recorded_by IN ('owner', 'commission')
    OR cl.artist_user_id = uh.owner_id
  )                              AS credit_verified,
  COALESCE(
    NULLIF(cl.image_urls, '{}'::TEXT[]),
    reel.urls,
    '{}'::TEXT[]
  )                              AS image_urls,
  COALESCE(sr.show_count, 0)     AS show_count,
  COALESCE(sr.nan_qualifying, 0) AS nan_qualifying_count,
  sr.best_placing,
  sr.latest_show_date,
  COALESCE(ht.titles, ARRAY[]::TEXT[]) AS titles
FROM public.customization_logs cl
JOIN public.user_horses uh ON uh.id = cl.horse_id
LEFT JOIN LATERAL (
  SELECT ARRAY[wm.image_urls[array_upper(wm.image_urls, 1)]] AS urls
  FROM public.work_moments wm
  WHERE wm.log_id = cl.id
    AND wm.is_public
    AND COALESCE(array_length(wm.image_urls, 1), 0) > 0
  ORDER BY wm.sort_order DESC, wm.created_at DESC
  LIMIT 1
) reel ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                   AS show_count,
    COUNT(*) FILTER (WHERE r.is_nan_qualifying)                AS nan_qualifying,
    MIN(NULLIF(regexp_replace(r."placing", '\D', '', 'g'), '')::INT) AS best_placing,
    MAX(r.show_date)                                           AS latest_show_date
  FROM public.show_records r
  WHERE r.horse_id = uh.id
) sr ON true
LEFT JOIN LATERAL (
  SELECT array_agg(t.title_code ORDER BY t.title_code) AS titles
  FROM public.horse_titles t
  WHERE t.horse_id = uh.id
) ht ON true
WHERE cl.artist_user_id IS NOT NULL

UNION ALL

-- Branch 2 — older text credits with no work record by this artist.
-- `cl` is joined on FALSE so every log column keeps its real type and
-- comes back NULL; the artist is the profile whose names match.
SELECT
  uh.id                          AS horse_id,
  uh.owner_id,
  uh.custom_name                 AS horse_name,
  uh.finishing_artist,
  uh.finishing_artist_verified,
  uh.is_public,
  uh.catalog_id,
  uh.created_at                  AS horse_created_at,
  uh.deleted_at                  AS horse_deleted_at,
  cl.id                          AS log_id,
  ap.user_id                     AS artist_user_id,
  cl.commission_id,
  cl.work_type,
  cl.date_completed,
  cl.recorded_by,
  cl.owner_confirmed_at,
  cl.disavowed_at,
  (
    COALESCE(uh.finishing_artist_verified, false)
    OR ap.user_id = uh.owner_id
  )                              AS credit_verified,
  COALESCE(photo.urls, '{}'::TEXT[]) AS image_urls,
  COALESCE(sr.show_count, 0)     AS show_count,
  COALESCE(sr.nan_qualifying, 0) AS nan_qualifying_count,
  sr.best_placing,
  sr.latest_show_date,
  COALESCE(ht.titles, ARRAY[]::TEXT[]) AS titles
FROM public.user_horses uh
JOIN public.artist_profiles ap
  ON ap.portfolio_visible = true
 AND (
       lower(btrim(uh.finishing_artist)) = lower(btrim(ap.studio_name))
    OR lower(btrim(uh.finishing_artist)) = ANY (SELECT lower(btrim(n)) FROM unnest(ap.also_known_as) AS n)
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = ap.user_id
           AND lower(btrim(uh.finishing_artist)) = lower(btrim(u.alias_name))
       )
 )
LEFT JOIN public.customization_logs cl ON false
LEFT JOIN LATERAL (
  SELECT ARRAY[hi.image_url] AS urls
  FROM public.horse_images hi
  WHERE hi.horse_id = uh.id
  ORDER BY hi.uploaded_at
  LIMIT 1
) photo ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                   AS show_count,
    COUNT(*) FILTER (WHERE r.is_nan_qualifying)                AS nan_qualifying,
    MIN(NULLIF(regexp_replace(r."placing", '\D', '', 'g'), '')::INT) AS best_placing,
    MAX(r.show_date)                                           AS latest_show_date
  FROM public.show_records r
  WHERE r.horse_id = uh.id
) sr ON true
LEFT JOIN LATERAL (
  SELECT array_agg(t.title_code ORDER BY t.title_code) AS titles
  FROM public.horse_titles t
  WHERE t.horse_id = uh.id
) ht ON true
WHERE uh.finishing_artist IS NOT NULL
  AND btrim(uh.finishing_artist) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.customization_logs x
    WHERE x.horse_id = uh.id AND x.artist_user_id = ap.user_id
  )

UNION ALL

-- Branch 3 (217) — prep credits by name: user_horses.prep_artist matches
-- the studio's name, alias or also_known_as. Same shape as branch 2, with
-- the work type stated. A horse whose finishing credit ALSO matches this
-- studio is left to branch 2, so the wall never lists it twice.
SELECT
  uh.id                          AS horse_id,
  uh.owner_id,
  uh.custom_name                 AS horse_name,
  uh.finishing_artist,
  uh.finishing_artist_verified,
  uh.is_public,
  uh.catalog_id,
  uh.created_at                  AS horse_created_at,
  uh.deleted_at                  AS horse_deleted_at,
  cl.id                          AS log_id,
  ap.user_id                     AS artist_user_id,
  cl.commission_id,
  'Prep work'::TEXT              AS work_type,
  cl.date_completed,
  cl.recorded_by,
  cl.owner_confirmed_at,
  cl.disavowed_at,
  (ap.user_id = uh.owner_id)     AS credit_verified,
  COALESCE(photo.urls, '{}'::TEXT[]) AS image_urls,
  COALESCE(sr.show_count, 0)     AS show_count,
  COALESCE(sr.nan_qualifying, 0) AS nan_qualifying_count,
  sr.best_placing,
  sr.latest_show_date,
  COALESCE(ht.titles, ARRAY[]::TEXT[]) AS titles
FROM public.user_horses uh
JOIN public.artist_profiles ap
  ON ap.portfolio_visible = true
 AND (
       lower(btrim(uh.prep_artist)) = lower(btrim(ap.studio_name))
    OR lower(btrim(uh.prep_artist)) = ANY (SELECT lower(btrim(n)) FROM unnest(ap.also_known_as) AS n)
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = ap.user_id
           AND lower(btrim(uh.prep_artist)) = lower(btrim(u.alias_name))
       )
 )
LEFT JOIN public.customization_logs cl ON false
LEFT JOIN LATERAL (
  SELECT ARRAY[hi.image_url] AS urls
  FROM public.horse_images hi
  WHERE hi.horse_id = uh.id
  ORDER BY hi.uploaded_at
  LIMIT 1
) photo ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                   AS show_count,
    COUNT(*) FILTER (WHERE r.is_nan_qualifying)                AS nan_qualifying,
    MIN(NULLIF(regexp_replace(r."placing", '\D', '', 'g'), '')::INT) AS best_placing,
    MAX(r.show_date)                                           AS latest_show_date
  FROM public.show_records r
  WHERE r.horse_id = uh.id
) sr ON true
LEFT JOIN LATERAL (
  SELECT array_agg(t.title_code ORDER BY t.title_code) AS titles
  FROM public.horse_titles t
  WHERE t.horse_id = uh.id
) ht ON true
WHERE uh.prep_artist IS NOT NULL
  AND btrim(uh.prep_artist) <> ''
  AND NOT (
       lower(btrim(COALESCE(uh.finishing_artist, ''))) = lower(btrim(ap.studio_name))
    OR lower(btrim(COALESCE(uh.finishing_artist, ''))) = ANY (SELECT lower(btrim(n)) FROM unnest(ap.also_known_as) AS n)
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = ap.user_id
           AND lower(btrim(COALESCE(uh.finishing_artist, ''))) = lower(btrim(u.alias_name))
       )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.customization_logs x
    WHERE x.horse_id = uh.id AND x.artist_user_id = ap.user_id
  );

COMMENT ON VIEW public.v_artist_finished_horses IS
  'An artist''s finished work with the competitive record each horse went on to earn. Branch 1: work records (log_id set). Branch 2 (216): older passport credits whose finishing_artist text matches the artist''s studio name, alias or also_known_as, with no work record yet (log_id NULL). Branch 3 (217): prep credits by the same name match on prep_artist, work_type ''Prep work''. security_invoker: the viewer''s own RLS on user_horses gates visibility.';

GRANT SELECT ON public.v_artist_finished_horses TO authenticated;
