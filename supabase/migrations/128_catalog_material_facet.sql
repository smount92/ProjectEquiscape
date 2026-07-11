-- ══════════════════════════════════════════════════════════════
-- Migration 128: Catalog `material` facet
-- ══════════════════════════════════════════════════════════════
-- Design-lead request: make Material (Plastic / Resin / Pewter / China …)
-- a first-class filter and a field on new-entry suggestions. Material lives
-- in catalog_items.attributes->>'material' (the table is polymorphic — no
-- dedicated columns; see migration 048).
--
-- Two parts:
--   1. Backfill the obvious materials so the facet isn't empty on day one:
--      plastic molds/releases → 'Plastic', artist resins → 'Resin'. Only
--      fills rows that don't already carry a material (micro_minis imported
--      from Maggie Bennett already set pewter/resin, and are left untouched).
--   2. Extend get_catalog_facets() (migration 125) to also return the
--      distinct `materials` array, so the filter dropdown self-populates.
--
-- Idempotent: the backfill is guarded on material IS NULL, and the function
-- is CREATE OR REPLACE. Safe to re-run.
-- ══════════════════════════════════════════════════════════════

-- 1) Backfill ───────────────────────────────────────────────────
UPDATE public.catalog_items
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object('material', 'Plastic')
WHERE item_type IN ('plastic_mold', 'plastic_release')
  AND (attributes->>'material') IS NULL;

UPDATE public.catalog_items
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object('material', 'Resin')
WHERE item_type = 'artist_resin'
  AND (attributes->>'material') IS NULL;

-- 2) Facets RPC now returns `materials` too ─────────────────────
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
            '[]'::jsonb)
    );
$$;

GRANT EXECUTE ON FUNCTION get_catalog_facets() TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 128 Complete — material backfilled + get_catalog_facets()
-- now returns { makers, scales, materials }.
-- After apply: npm run gen-types (get_catalog_facets Return type is opaque
-- Json, so no app type change is strictly required).
-- ══════════════════════════════════════════════════════════════
