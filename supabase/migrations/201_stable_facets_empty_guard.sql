-- 201: get_stable_facets must never emit '' (2026-08-29).
--
-- WHY. A new-entry approval wrote maker '' (the form's unselected
-- "— Select —"; `??` in the insert path caught only null). One member
-- owned horses linked to two such rows, the '' reached their facet
-- dropdown, and Radix Select throws on empty item values — their
-- /dashboard crashed outright (Sentry JAVASCRIPT-NEXTJS-K, 16 events).
--
-- get_catalog_facets (125) already guards `<> ''`; this brings the
-- older stable RPC (123) up to the same contract: facet values are
-- dropdown options, and '' is never one. The write path and the
-- reader are fixed in code alongside; this is the belt at the source.
CREATE OR REPLACE FUNCTION get_stable_facets(p_owner UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
WITH horses AS (
    SELECT h.finish_type::TEXT AS finish_type,
           h.asset_category,
           ci.maker,
           ci.scale
    FROM public.user_horses h
    LEFT JOIN public.catalog_items ci ON ci.id = h.catalog_id
    WHERE h.owner_id = p_owner AND h.deleted_at IS NULL
)
SELECT jsonb_build_object(
    'makers',     COALESCE((SELECT jsonb_agg(DISTINCT maker ORDER BY maker)
                            FROM horses WHERE maker IS NOT NULL AND maker <> ''), '[]'::jsonb),
    'scales',     COALESCE((SELECT jsonb_agg(DISTINCT scale ORDER BY scale)
                            FROM horses WHERE scale IS NOT NULL AND scale <> ''), '[]'::jsonb),
    'finishes',   COALESCE((SELECT jsonb_agg(DISTINCT finish_type ORDER BY finish_type)
                            FROM horses WHERE finish_type IS NOT NULL AND finish_type <> ''), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(DISTINCT asset_category ORDER BY asset_category)
                            FROM horses WHERE asset_category IS NOT NULL AND asset_category <> ''), '[]'::jsonb)
);
$$;

-- ✅ Migration 201 Complete — get_stable_facets excludes '' everywhere
