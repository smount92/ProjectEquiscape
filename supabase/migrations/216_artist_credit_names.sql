-- 216 — older credits find their artist.
--
-- Before work records existed, a horse's passport credited its artist as
-- text: user_horses.finishing_artist = 'Amanda Mount', 'Sarah Tregay',
-- 'Madison Breen'. The receipts wall is built from customization_logs,
-- so none of those horses ever reached the artist's wall — 15 public
-- horses credit Amanda by name and her studio showed none of them
-- (2026-09-19). The alias fallback in the app only ran when the view
-- was absent, i.e. never in production.
--
-- Two pieces:
--   1. artist_profiles.also_known_as — the names an artist's older
--      credits carry ("Amanda Mount", "Black Fox Farm"). Their studio
--      name and alias always count too.
--   2. v_artist_finished_horses gains a second branch: horses whose
--      finishing_artist matches one of those names and that have no
--      work record by this artist yet. log_id is NULL for those rows;
--      credit_verified is the owner's stamp (or the artist owning the
--      horse). get_studio_wall reads the view, so the public wall and
--      the signed-in wall pick them up together.
--
-- The app tolerates the column being absent (saves retry without it).

ALTER TABLE public.artist_profiles
    ADD COLUMN IF NOT EXISTS also_known_as TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.artist_profiles
    DROP CONSTRAINT IF EXISTS artist_profiles_also_known_as_len;
ALTER TABLE public.artist_profiles
    ADD CONSTRAINT artist_profiles_also_known_as_len
    CHECK (cardinality(also_known_as) <= 10);

COMMENT ON COLUMN public.artist_profiles.also_known_as IS
    'Names this artist''s older passport credits carry (finishing_artist text). Up to 10; matched case-insensitively with the studio name and alias.';

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
  );

COMMENT ON VIEW public.v_artist_finished_horses IS
  'An artist''s finished work with the competitive record each horse went on to earn. Branch 1: work records (log_id set). Branch 2 (216): older passport credits whose finishing_artist text matches the artist''s studio name, alias or also_known_as, with no work record yet (log_id NULL). security_invoker: the viewer''s own RLS on user_horses gates visibility.';

GRANT SELECT ON public.v_artist_finished_horses TO authenticated;

-- get_studio_wall (212) reads the view by name; nothing to change there.
