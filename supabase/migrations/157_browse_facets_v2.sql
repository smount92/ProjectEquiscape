-- ============================================================
-- 157: Browse facets v2 — Manufacturer/Artist facets + the
-- Stone/Peter Stone unification.
--
-- 1. "Stone" and "Peter Stone" are the same company recorded two
--    ways; the duplicate made the quick-chip row read as noise.
--    Unify DISPLAY strings to "Peter Stone". maker_slug (the URL
--    identity) is untouched — no links change.
-- 2. get_catalog_facets grows manufacturers + artists lists (from
--    the 156 columns) so the browse bar can offer real
--    Manufacturer and Artist dropdowns instead of the mixed
--    legacy "Maker" list. makers/scales/materials keep their
--    shape for back-compat.
-- ============================================================

UPDATE catalog_items SET maker = 'Peter Stone'
WHERE lower(trim(maker)) = 'stone';

UPDATE catalog_items SET manufacturer = 'Peter Stone'
WHERE lower(trim(manufacturer)) = 'stone';

-- Same INVOKER/search_path style as 128 (catalog_items is publicly
-- readable — no DEFINER needed).
CREATE OR REPLACE FUNCTION get_catalog_facets()
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'makers', COALESCE(
            (SELECT jsonb_agg(DISTINCT maker ORDER BY maker)
             FROM public.catalog_items
             WHERE maker IS NOT NULL AND maker <> ''),
            '[]'::jsonb),
        'scales', COALESCE(
            (SELECT jsonb_agg(DISTINCT scale ORDER BY scale)
             FROM public.catalog_items
             WHERE scale IS NOT NULL AND scale <> ''),
            '[]'::jsonb),
        'materials', COALESCE(
            (SELECT jsonb_agg(DISTINCT attributes->>'material' ORDER BY attributes->>'material')
             FROM public.catalog_items
             WHERE attributes->>'material' IS NOT NULL AND attributes->>'material' <> ''),
            '[]'::jsonb),
        'manufacturers', COALESCE(
            (SELECT jsonb_agg(DISTINCT manufacturer ORDER BY manufacturer)
             FROM public.catalog_items
             WHERE manufacturer IS NOT NULL AND manufacturer <> ''),
            '[]'::jsonb),
        'artists', COALESCE(
            (SELECT jsonb_agg(DISTINCT artist ORDER BY artist)
             FROM public.catalog_items
             WHERE artist IS NOT NULL AND artist <> ''),
            '[]'::jsonb)
    );
$$;
