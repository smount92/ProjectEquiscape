-- Registry repair 2026-10-15: DRY RUN. Changes nothing.
-- Paste and run; it returns one table with what the repair would do.
-- Then run registry_repair_2026_10_15.sql, which does exactly this.

CREATE OR REPLACE FUNCTION pg_temp.mold_key(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(coalesce(t, '')), '\(\s*g[1-6]\s*\)|^\s*g[1-6]\s+|\s+g[1-6]\s*$', ' ', 'g'), '\s+', ' ', 'g'))
$$;

DROP TABLE IF EXISTS _molds;
CREATE TEMP TABLE _molds AS
SELECT m.id, m.title, m.maker, m.scale, m.created_at,
       lower(coalesce(m.maker, '')) || '|' || coalesce(m.scale, '') || '|' || pg_temp.mold_key(m.title) AS k,
       (SELECT count(*) FROM public.catalog_items c WHERE c.parent_id = m.id) AS releases,
       (SELECT count(*) FROM public.user_horses h WHERE h.catalog_id = m.id) AS horses,
       (m.title ~* '\(\s*g[1-6]\s*\)|^\s*g[1-6]\s|\sg[1-6]\s*$') AS has_gen
FROM public.catalog_items m
WHERE m.item_type = 'plastic_mold';

DROP TABLE IF EXISTS _merge;
CREATE TEMP TABLE _merge AS
SELECT dup, canon, 'duplicate mold' AS why FROM (
  SELECT id AS dup,
         first_value(id) OVER (PARTITION BY k ORDER BY releases DESC, horses DESC, has_gen DESC, created_at ASC, id) AS canon
  FROM _molds
) x WHERE dup <> canon
UNION ALL
SELECT dup, canon, 'identical release' FROM (
  SELECT id AS dup,
         first_value(id) OVER (
           PARTITION BY parent_id, title, maker, scale, item_type, coalesce(artist, ''), coalesce(manufacturer, ''), attributes::text
           ORDER BY created_at ASC, id) AS canon
  FROM public.catalog_items
  WHERE item_type = 'plastic_release' AND parent_id IS NOT NULL
) y WHERE dup <> canon;

SELECT step, detail, n FROM (
  SELECT 0 AS o, '0 colour' AS step, 'set colour still overwritten by a linker correction' AS detail, (
    SELECT count(*) FROM public.catalog_items ci
    WHERE ci.attributes ->> 'color_description' IN (
      SELECT s2.field_changes -> 'color_description' ->> 'to' FROM public.catalog_suggestions s2
      WHERE s2.catalog_item_id = ci.id AND s2.reason LIKE 'Filled in from the reference linker%')) AS n
  UNION ALL SELECT 1 AS o, '1 merge' AS step, 'duplicate molds folded into their twin' AS detail, (SELECT count(*) FROM _merge WHERE why = 'duplicate mold') AS n
  UNION ALL SELECT 2, '1 merge', 'identical releases folded', (SELECT count(*) FROM _merge WHERE why = 'identical release')
  UNION ALL SELECT 3, '1 merge', 'horses whose link moves to the kept entry', (SELECT count(*) FROM public.user_horses h JOIN _merge m ON h.catalog_id = m.dup)
  UNION ALL SELECT 4, '1 merge', 'want-list entries that move', (SELECT count(*) FROM public.user_wishlists w JOIN _merge m ON w.catalog_id = m.dup)
  UNION ALL SELECT 5, '2 Clooney 51', 'releases moved from the release Clooney 51 to the Bristol mold',
    (SELECT count(*) FROM public.catalog_items c JOIN public.catalog_items cl ON c.parent_id = cl.id WHERE cl.title = 'Clooney 51' AND cl.item_type = 'plastic_release')
  UNION ALL SELECT 6, '3 scale', 'releases re-filed under the same-name mold at their own scale', (
    SELECT count(*) FROM (
      SELECT r.id, count(t.id) AS twins
      FROM public.catalog_items r
      JOIN public.catalog_items p ON p.id = r.parent_id AND p.item_type = 'plastic_mold'
      LEFT JOIN public.catalog_items t ON t.item_type = 'plastic_mold' AND lower(t.maker) = lower(p.maker) AND t.scale = r.scale
                                       AND pg_temp.mold_key(t.title) = pg_temp.mold_key(p.title)
                                       AND t.id NOT IN (SELECT dup FROM _merge)
      WHERE r.item_type = 'plastic_release' AND r.scale IS NOT NULL AND p.scale IS NOT NULL AND r.scale <> p.scale
      GROUP BY r.id
    ) z WHERE twins = 1)
  UNION ALL SELECT 7, '3 scale', 'releases left as they are (no same-name mold at their scale): listed for review', (
    SELECT count(*) FROM (
      SELECT r.id, count(t.id) AS twins
      FROM public.catalog_items r
      JOIN public.catalog_items p ON p.id = r.parent_id AND p.item_type = 'plastic_mold'
      LEFT JOIN public.catalog_items t ON t.item_type = 'plastic_mold' AND lower(t.maker) = lower(p.maker) AND t.scale = r.scale
                                       AND pg_temp.mold_key(t.title) = pg_temp.mold_key(p.title)
                                       AND t.id NOT IN (SELECT dup FROM _merge)
      WHERE r.item_type = 'plastic_release' AND r.scale IS NOT NULL AND p.scale IS NOT NULL AND r.scale <> p.scale
      GROUP BY r.id
    ) z WHERE twins <> 1)
  UNION ALL SELECT 8, '4 titles', 'titles that start with a year: year moved to the end',
    (SELECT count(*) FROM public.catalog_items WHERE title ~ '^(19|20)\d\d ')
  UNION ALL SELECT 9, '5 run type', 'free-text run types mapped onto the list (original kept as Run detail)',
    (SELECT count(*) FROM public.catalog_items WHERE attributes ? 'run_type'
       AND attributes->>'run_type' NOT IN ('Regular Run','Special Run','BreyerFest','Collector''s Club','Web Special','Store Special','Test Run','One of a Kind','Other'))
  UNION ALL SELECT 10, '6 makers', 'rows whose maker or artist spelling is corrected',
    (SELECT count(*) FROM public.catalog_items WHERE maker IN ('grace newhouse','claire baker','cynthia kuerth','Nanse  Czipri  Browne','Maggie Bennett.','D''arry Jone Frank','Dee Ann Kjelshus','?')
       OR maker LIKE '% for EquinArt Creations Inc.')
  UNION ALL SELECT 11, '7 addresses', 'pages whose maker part of the address is out of date (they move to the right maker)',
    (SELECT count(*) FROM public.catalog_items WHERE maker_slug IS DISTINCT FROM public.catalog_slugify(maker) AND public.catalog_slugify(maker) <> '')
  UNION ALL SELECT 12, '8 years', 'impossible years corrected',
    (SELECT count(*) FROM public.catalog_items WHERE (title = 'Mystery Horse Surprise Series 8 - Warmblood' AND attributes->>'release_year_start' = '6')
       OR (title = 'END Fala' AND attributes->>'release_year_end' = '2025'))
) s ORDER BY o;
