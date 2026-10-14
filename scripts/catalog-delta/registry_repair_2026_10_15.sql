-- Registry repair 2026-10-15 (owner's rulings on the catalog review).
--
-- Run registry_repair_2026_10_15_dryrun.sql first and read its table.
-- This file does the same steps in one transaction: if any statement
-- fails, nothing is changed. Paste migration 232 first so that future
-- maker corrections move their page; this repair does not depend on it.
--
--  1. Merge duplicate molds (same maker, scale and name, generation
--     ignored) into the copy with the most releases, then the most horses,
--     then the one carrying the generation, then the oldest; and fold
--     releases that are identical in every field. Every link moves to the
--     kept entry first: horses, want lists, ID help, suggestions,
--     changelog, child releases, member sale reports, price data.
--  2. The 22 releases filed under the release "Clooney 51" move to its
--     mold, Bristol.
--  3. A release filed under a mold of another scale moves to the
--     same-name mold at its own scale when exactly one exists. The rest
--     are left for review (the last query lists them).
--  4. Titles that start with a year put the year at the end; the two
--     run-on volunteer titles get a clean name and their text moves to
--     the registry notes.
--  5. Free-text run types map onto the list; the original is kept as
--     "run_detail".
--  6. Maker and artist spellings: capitalised, no trailing punctuation,
--     one spelling per person; "X for EquinArt Creations Inc." splits
--     into the artist and the company; "?" becomes "Unknown".
--  7. Page addresses whose maker part is out of date move to the right
--     maker (taking a -N suffix only on a clash).
--  8. Two impossible years.
--  (0. comes first: the one set colour the 2026-10-14 restore skipped.)

BEGIN;

-- ── 0. The one set colour the 2026-10-14 restore skipped ──────────────
-- Its two linker corrections were applied in the reverse of the order
-- they were filed, so the restore's guard (current = last filed) did not
-- match. Put back the colour it held before either of them.
UPDATE public.catalog_items ci
SET attributes = ci.attributes || jsonb_build_object('color_description', first_fix.was)
FROM (
  SELECT DISTINCT ON (s.catalog_item_id) s.catalog_item_id, s.field_changes -> 'color_description' ->> 'from' AS was
  FROM public.catalog_suggestions s
  WHERE s.reason LIKE 'Filled in from the reference linker%' AND s.field_changes ? 'color_description'
  ORDER BY s.catalog_item_id, s.created_at ASC
) first_fix
WHERE ci.id = first_fix.catalog_item_id
  AND ci.attributes ->> 'color_description' IN (
    SELECT s2.field_changes -> 'color_description' ->> 'to' FROM public.catalog_suggestions s2
    WHERE s2.catalog_item_id = ci.id AND s2.reason LIKE 'Filled in from the reference linker%')
  AND first_fix.was IS NOT NULL;


CREATE OR REPLACE FUNCTION pg_temp.mold_key(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(coalesce(t, '')), '\(\s*g[1-6]\s*\)|^\s*g[1-6]\s+|\s+g[1-6]\s*$', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- ── 1. Merges ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS _molds;
CREATE TEMP TABLE _molds ON COMMIT DROP AS
SELECT m.id, m.created_at,
       lower(coalesce(m.maker, '')) || '|' || coalesce(m.scale, '') || '|' || pg_temp.mold_key(m.title) AS k,
       (SELECT count(*) FROM public.catalog_items c WHERE c.parent_id = m.id) AS releases,
       (SELECT count(*) FROM public.user_horses h WHERE h.catalog_id = m.id) AS horses,
       (m.title ~* '\(\s*g[1-6]\s*\)|^\s*g[1-6]\s|\sg[1-6]\s*$') AS has_gen
FROM public.catalog_items m
WHERE m.item_type = 'plastic_mold';

DROP TABLE IF EXISTS _merge;
CREATE TEMP TABLE _merge ON COMMIT DROP AS
SELECT dup, canon FROM (
  SELECT id AS dup,
         first_value(id) OVER (PARTITION BY k ORDER BY releases DESC, horses DESC, has_gen DESC, created_at ASC, id) AS canon
  FROM _molds
) x WHERE dup <> canon
UNION ALL
SELECT dup, canon FROM (
  SELECT id AS dup,
         first_value(id) OVER (
           PARTITION BY parent_id, title, maker, scale, item_type, coalesce(artist, ''), coalesce(manufacturer, ''), attributes::text
           ORDER BY created_at ASC, id) AS canon
  FROM public.catalog_items
  WHERE item_type = 'plastic_release' AND parent_id IS NOT NULL
) y WHERE dup <> canon;

UPDATE public.user_horses t        SET catalog_id      = m.canon FROM _merge m WHERE t.catalog_id      = m.dup;
UPDATE public.user_wishlists t     SET catalog_id      = m.canon FROM _merge m WHERE t.catalog_id      = m.dup;
UPDATE public.id_suggestions t     SET catalog_id      = m.canon FROM _merge m WHERE t.catalog_id      = m.dup;
UPDATE public.catalog_suggestions t SET catalog_item_id = m.canon FROM _merge m WHERE t.catalog_item_id = m.dup;
UPDATE public.catalog_changelog t  SET catalog_item_id = m.canon FROM _merge m WHERE t.catalog_item_id = m.dup;
UPDATE public.catalog_items t      SET parent_id       = m.canon FROM _merge m WHERE t.parent_id       = m.dup;
UPDATE public.catalog_sale_reports t SET catalog_item_id = m.canon FROM _merge m WHERE t.catalog_item_id = m.dup;
UPDATE public.catalog_price_signal_flags t SET catalog_item_id = m.canon FROM _merge m
  WHERE t.catalog_item_id = m.dup
    AND NOT EXISTS (SELECT 1 FROM public.catalog_price_signal_flags f WHERE f.catalog_item_id = m.canon AND f.reporter_id = t.reporter_id);
UPDATE public.catalog_price_history t SET catalog_item_id = m.canon FROM _merge m
  WHERE t.catalog_item_id = m.dup
    AND NOT EXISTS (SELECT 1 FROM public.catalog_price_history h WHERE h.catalog_item_id = m.canon AND h.source = t.source AND h.observed_on = t.observed_on);
UPDATE public.catalog_price_signals t SET catalog_item_id = m.canon FROM _merge m
  WHERE t.catalog_item_id = m.dup
    AND NOT EXISTS (SELECT 1 FROM public.catalog_price_signals s WHERE s.catalog_item_id = m.canon);
UPDATE public.catalog_price_sweeps t SET catalog_item_id = m.canon FROM _merge m
  WHERE t.catalog_item_id = m.dup
    AND NOT EXISTS (SELECT 1 FROM public.catalog_price_sweeps s WHERE s.catalog_item_id = m.canon);
-- Whatever price data could not move (the kept entry already had its own) cascades away here.
DELETE FROM public.catalog_items c USING _merge m WHERE c.id = m.dup;

-- ── 2. Clooney 51 ──────────────────────────────────────────────────────
UPDATE public.catalog_items c
SET parent_id = cl.parent_id
FROM public.catalog_items cl
WHERE cl.title = 'Clooney 51' AND cl.item_type = 'plastic_release' AND cl.parent_id IS NOT NULL
  AND c.parent_id = cl.id;

-- ── 3. Releases filed under a mold of another scale ────────────────────
WITH misfiled AS (
  SELECT r.id AS release_id, r.scale, p.maker, pg_temp.mold_key(p.title) AS pk
  FROM public.catalog_items r
  JOIN public.catalog_items p ON p.id = r.parent_id AND p.item_type = 'plastic_mold'
  WHERE r.item_type = 'plastic_release' AND r.scale IS NOT NULL AND p.scale IS NOT NULL AND r.scale <> p.scale
),
twin AS (
  SELECT mf.release_id, (array_agg(t.id))[1] AS mold_id, count(t.id) AS n
  FROM misfiled mf
  JOIN public.catalog_items t ON t.item_type = 'plastic_mold' AND lower(t.maker) = lower(mf.maker)
                             AND t.scale = mf.scale AND pg_temp.mold_key(t.title) = mf.pk
  GROUP BY mf.release_id
)
UPDATE public.catalog_items c SET parent_id = twin.mold_id
FROM twin WHERE c.id = twin.release_id AND twin.n = 1;

-- ── 4. Titles that start with a year ───────────────────────────────────
UPDATE public.catalog_items c
SET title = v.new_title,
    attributes = c.attributes || jsonb_strip_nulls(jsonb_build_object(
      'release_year_start', CASE WHEN c.attributes->>'release_year_start' IS NULL THEN v.y END,
      'registry_notes', CASE WHEN coalesce(c.attributes->>'registry_notes', '') = '' THEN v.note END))
FROM (VALUES
  ('2010 cookeville classic live medallion', 'Cookeville Classic Live Medallion (2010)', 2010, NULL),
  ('2019 Anniversary Gift Medallion Club', 'Anniversary Gift Medallion Club (2019)', 2019, NULL),
  ('1993 Grayingham Lucky Lad', 'Grayingham Lucky Lad (1993)', NULL, NULL),
  ('1994 Bright Zip', 'Bright Zip (1994)', NULL, NULL),
  ('1991 Mustang Lady', 'Mustang Lady (1991)', NULL, NULL),
  ('2010 Games Autograph Horse', 'Games Autograph Horse (2010)', NULL, NULL),
  ('2010 Games Commemorative Horse', 'Games Commemorative Horse (2010)', NULL, NULL),
  ('2010 Games Collector_s Edition', 'Games Collector''s Edition (2010)', NULL, NULL),
  ('2012 Pink Ribbon Horse', 'Pink Ribbon Horse (2012)', NULL, NULL),
  ('2012 Year of the Dragon Horse', 'Year of the Dragon Horse (2012)', NULL, NULL),
  ('2025 BreyerFest Manager Model', 'BreyerFest Manager Model (2025)', NULL, NULL),
  ('2025 Volunteer ModelBreyerWest%', 'BreyerWest Volunteer Model (2025)', NULL,
     'A split run of three colours with the same pattern, given out at random to volunteers in an opaque bag.'),
  ('2025 Volunteer ModelBreyerFest%', 'BreyerFest Volunteer Model (2025)', NULL,
     'A split run of three colours with the same pattern, given out at random to volunteers in an opaque bag.'),
  ('1997 Dakotah Indian Horse - Lightning%', NULL, NULL, NULL),
  ('1997 Dakotah Indian Horse - Thunder%', NULL, NULL, NULL),
  ('2020 Customer Appreciation Event (~200-250 made)', 'Customer Appreciation Event, ~200-250 made (2020)', NULL, NULL),
  ('1995 Mego', 'Mego (1995)', NULL, NULL),
  ('1996 Tseminole Wind', 'Tseminole Wind (1996)', NULL, NULL),
  ('1997 Bold', 'Bold (1997)', NULL, NULL),
  ('2000 Leah_s Fancy Chick', 'Leah''s Fancy Chick (2000)', NULL, NULL),
  ('2001 Atlantis Bey V', 'Atlantis Bey V (2001)', NULL, NULL),
  ('2007 Rugged Painted Lark', 'Rugged Painted Lark (2007)', NULL, NULL),
  ('2008 Alborozo', 'Alborozo (2008)', NULL, NULL),
  ('1985 Toy Fair (500 made) - With hang tag%', 'Toy Fair, with hang tag, 500 made (1985)', NULL, NULL),
  ('2015 Christmas ornament', 'Christmas Ornament (2015)', 2015, NULL)
) AS v(pat, new_title, y, note)
WHERE c.title LIKE v.pat AND v.new_title IS NOT NULL;

-- The two Dakotah titles keep their quoted names: year to the end by rule.
UPDATE public.catalog_items
SET title = regexp_replace(title, '^(19|20)(\d\d) (.*)$', '\3 (\1\2)')
WHERE title ~ '^1997 Dakotah Indian Horse - ';

-- ── 5. Run types ───────────────────────────────────────────────────────
UPDATE public.catalog_items
SET attributes = attributes || jsonb_build_object(
      'run_detail', attributes->>'run_type',
      'run_type', CASE
        WHEN attributes->>'run_type' ILIKE 'Benefit Live Auction%' OR attributes->>'run_type' ILIKE '%Raffle%' THEN 'One of a Kind'
        WHEN attributes->>'run_type' ILIKE '%Prize%' OR attributes->>'run_type' ILIKE '%BreyerFest%'
          OR attributes->>'run_type' IN ('Single Day Stablemate', 'Tent/Store Special/Ltd Edition', 'Celebration Horse', 'Surprise Model') THEN 'BreyerFest'
        WHEN attributes->>'run_type' = 'Limited Edition' THEN 'Special Run'
        WHEN attributes->>'run_type' ILIKE 'Annual bonus model' THEN 'Collector''s Club'
        ELSE 'Other' END)
WHERE attributes ? 'run_type'
  AND attributes->>'run_type' NOT IN ('Regular Run','Special Run','BreyerFest','Collector''s Club','Web Special','Store Special','Test Run','One of a Kind','Other');

-- ── 6. Maker and artist spellings ──────────────────────────────────────
UPDATE public.catalog_items c SET maker = v.new_name
FROM (VALUES
  ('grace newhouse', 'Grace Newhouse'), ('claire baker', 'Claire Baker'), ('cynthia kuerth', 'Cynthia Kuerth'),
  ('Nanse  Czipri  Browne', 'Nanse Czipri Browne'), ('Maggie Bennett.', 'Maggie Bennett'),
  ('D''arry Jone Frank', 'D''Arry Jone Frank'), ('Dee Ann Kjelshus', 'DeeAnn Kjelshus'), ('?', 'Unknown')
) AS v(old_name, new_name) WHERE c.maker = v.old_name;
UPDATE public.catalog_items c SET artist = v.new_name
FROM (VALUES
  ('grace newhouse', 'Grace Newhouse'), ('claire baker', 'Claire Baker'), ('cynthia kuerth', 'Cynthia Kuerth'),
  ('Nanse  Czipri  Browne', 'Nanse Czipri Browne'), ('Maggie Bennett.', 'Maggie Bennett'),
  ('D''arry Jone Frank', 'D''Arry Jone Frank'), ('Dee Ann Kjelshus', 'DeeAnn Kjelshus')
) AS v(old_name, new_name) WHERE c.artist = v.old_name;
UPDATE public.catalog_items
SET maker = regexp_replace(maker, ' for EquinArt Creations Inc\.$', ''),
    artist = regexp_replace(coalesce(artist, maker), ' for EquinArt Creations Inc\.$', ''),
    manufacturer = coalesce(NULLIF(manufacturer, ''), 'EquinArt Creations')
WHERE maker LIKE '% for EquinArt Creations Inc.';

-- ── 7. Page addresses under the wrong maker ────────────────────────────
DO $$
DECLARE r record; target text; cand text; n int;
BEGIN
  FOR r IN
    SELECT id, maker, slug FROM public.catalog_items
    WHERE maker_slug IS DISTINCT FROM public.catalog_slugify(maker) AND public.catalog_slugify(maker) <> ''
  LOOP
    target := public.catalog_slugify(r.maker);
    cand := coalesce(NULLIF(r.slug, ''), 'item-' || left(r.id::text, 8));
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.catalog_items WHERE maker_slug = target AND slug = cand AND id <> r.id) LOOP
      n := n + 1;
      cand := coalesce(NULLIF(r.slug, ''), 'item-' || left(r.id::text, 8)) || '-' || n;
    END LOOP;
    UPDATE public.catalog_items SET maker_slug = target, slug = cand WHERE id = r.id;
  END LOOP;
END $$;

-- ── 8. Impossible years ────────────────────────────────────────────────
UPDATE public.catalog_items SET attributes = attributes - 'release_year_start'
WHERE title = 'Mystery Horse Surprise Series 8 - Warmblood' AND attributes->>'release_year_start' = '6';
UPDATE public.catalog_items SET attributes = attributes || '{"release_year_end": 2026}'::jsonb
WHERE title = 'END Fala' AND attributes->>'release_year_end' = '2025' AND attributes->>'release_year_start' = '2026';

COMMIT;

-- ── Left for review: releases still under a mold of another scale ──────
SELECT p.maker, p.title AS filed_under, p.scale AS mold_scale, r.scale AS release_scale, count(*) AS releases
FROM public.catalog_items r
JOIN public.catalog_items p ON p.id = r.parent_id AND p.item_type = 'plastic_mold'
WHERE r.item_type = 'plastic_release' AND r.scale IS NOT NULL AND p.scale IS NOT NULL AND r.scale <> p.scale
GROUP BY 1, 2, 3, 4 ORDER BY releases DESC;
