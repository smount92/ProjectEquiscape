-- 208: The studio wall takes its covers from the reel (2026-09-03).
--
-- Amanda back-filled 15 work records with 142 photos and her wall
-- came up blank. Cause: the wall reads customization_logs.image_urls,
-- which ONLY the commission-delivery hook fills (it flattens the WIP
-- thread into the log). Artist-recorded work records (202) keep their
-- photos in work_moments — the reel — and leave image_urls empty, so
-- every card had a cover of nothing.
--
-- The fix belongs in the view, not the app: image_urls falls back to
-- the reel's LAST public moment (the finished shot — the right cover
-- for a wall called "finished work"). get_studio_wall (203) selects
-- from this view, so the anon storefront inherits the fix for free,
-- and no photo is duplicated into a second column to drift.
CREATE OR REPLACE VIEW v_artist_finished_horses
WITH (security_invoker = true) AS
SELECT
  uh.id                          AS horse_id,
  uh.owner_id,
  uh.custom_name                 AS horse_name,
  uh.finishing_artist,
  uh.finishing_artist_verified,
  uh.is_public,
  uh.catalog_id,
  uh.created_at                  AS horse_created_at,
  cl.id                          AS log_id,
  cl.artist_user_id,
  cl.commission_id,
  cl.work_type,
  cl.date_completed,
  -- Commission logs carry their own images; work records carry a reel.
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
FROM customization_logs cl
JOIN user_horses uh ON uh.id = cl.horse_id
-- The finished shot: last public moment of the reel, its last photo.
LEFT JOIN LATERAL (
  SELECT ARRAY[wm.image_urls[array_upper(wm.image_urls, 1)]] AS urls
  FROM work_moments wm
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
  FROM show_records r
  WHERE r.horse_id = uh.id
) sr ON true
LEFT JOIN LATERAL (
  SELECT array_agg(t.title_code ORDER BY t.title_code) AS titles
  FROM horse_titles t
  WHERE t.horse_id = uh.id
) ht ON true
WHERE cl.artist_user_id IS NOT NULL;

COMMENT ON VIEW v_artist_finished_horses IS
  'An artist''s finished work with the competitive record each horse went on to earn. image_urls prefers the commission log''s own photos and falls back to the work record''s reel (208). security_invoker: the viewer''s own RLS on user_horses gates visibility.';

GRANT SELECT ON v_artist_finished_horses TO authenticated;

-- ✅ Migration 208 Complete — wall covers fall back to the reel
