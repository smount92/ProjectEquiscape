-- ══════════════════════════════════════════════════════════════
-- Migration 125: Catalog facet options RPC
-- ══════════════════════════════════════════════════════════════
-- Perf (Batch E5): /catalog previously ran TWO full-table scans of
-- catalog_items (~10.5k rows each) per page load — one pulling every
-- `maker`, one pulling every `scale` — then de-duplicated in JS just to
-- build the filter dropdowns. This returns the distinct maker/scale sets
-- in ONE round-trip (arrays only), mirroring get_stable_facets from
-- migration 123.
--
-- SECURITY INVOKER: catalog_items is public reference data readable by
-- anon after migration 124, so anon callers get the same facets. Read-only.
-- Depends on 124 (anon SELECT policy) for the anon path.
-- ══════════════════════════════════════════════════════════════

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
            '[]'::jsonb)
    );
$$;

GRANT EXECUTE ON FUNCTION get_catalog_facets() TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 125 Complete — get_catalog_facets() JSONB { makers, scales }
-- After apply: npm run gen-types (replaces the interim entry in
-- src/lib/types/database.generated.ts).
-- ══════════════════════════════════════════════════════════════
