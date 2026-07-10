-- ══════════════════════════════════════════════════════════════
-- Migration 123: Digital Stable filter rebuild
-- Additive only. Saved views for the filter ledger, plus two
-- read functions that replace the dashboard's three unbounded
-- owner-wide fetches (all-horses summary, vault, junction) with
-- one aggregate round-trip (NEXT_PUBLIC_STABLE_V2).
-- ══════════════════════════════════════════════════════════════

-- ── 1. Saved views ──
-- A collector's favorite filter slices, one click away. params holds
-- the URL-param form of the filters ({"finish":"OF","maker":"Breyer"});
-- the app validates keys with zod before writing.
CREATE TABLE IF NOT EXISTS stable_saved_views (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    params     JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

ALTER TABLE stable_saved_views ENABLE ROW LEVEL SECURITY;

-- Users see and manage ONLY their own saved views.
CREATE POLICY "stable_saved_views_select" ON stable_saved_views
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "stable_saved_views_insert" ON stable_saved_views
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "stable_saved_views_update" ON stable_saved_views
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "stable_saved_views_delete" ON stable_saved_views
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- ── 2. Stable summary ──
-- One row of sidebar aggregates. Encodes the legacy-FK + junction
-- dual-source collection merge in SQL ONCE (the app previously
-- re-derived it in JS from three unbounded fetches per page load).
-- SECURITY INVOKER: RLS applies — an owner querying their own rows
-- sees them; anyone else's p_owner yields empty aggregates.
CREATE OR REPLACE FUNCTION get_stable_summary(p_owner UUID)
RETURNS TABLE (
    total_horses   INTEGER,
    vault_total    NUMERIC,
    for_sale_count INTEGER,
    collections    JSONB
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
WITH horses AS (
    SELECT id, collection_id, trade_status
    FROM public.user_horses
    WHERE owner_id = p_owner AND deleted_at IS NULL
),
-- Dual-source collection membership: legacy FK ∪ junction, deduped.
memberships AS (
    SELECT h.id AS horse_id, h.collection_id
    FROM horses h
    WHERE h.collection_id IS NOT NULL
    UNION
    SELECT hc.horse_id, hc.collection_id
    FROM public.horse_collections hc
    JOIN horses h ON h.id = hc.horse_id
),
vault AS (
    SELECT fv.horse_id,
           COALESCE(fv.estimated_current_value, fv.purchase_price, 0) AS value
    FROM public.financial_vault fv
    JOIN horses h ON h.id = fv.horse_id
),
per_collection AS (
    SELECT c.id,
           c.name,
           COUNT(DISTINCT m.horse_id)  AS horse_count,
           COALESCE(SUM(v.value), 0)   AS vault_value
    FROM public.user_collections c
    LEFT JOIN memberships m ON m.collection_id = c.id
    LEFT JOIN vault v       ON v.horse_id = m.horse_id
    WHERE c.user_id = p_owner
    GROUP BY c.id, c.name
)
SELECT
    (SELECT COUNT(*) FROM horses)::INTEGER                              AS total_horses,
    COALESCE((SELECT SUM(value) FROM vault), 0)                         AS vault_total,
    (SELECT COUNT(*) FROM horses WHERE trade_status = 'For Sale')::INTEGER AS for_sale_count,
    COALESCE(
        (SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', id, 'name', name,
                        'count', horse_count, 'value', vault_value
                    ) ORDER BY name)
         FROM per_collection),
        '[]'::jsonb
    ) AS collections;
$$;

-- ── 3. Facet options ──
-- Distinct dropdown values across the OWNER's whole collection (not
-- the loaded page). One round-trip, all arrays. SECURITY INVOKER —
-- same RLS posture as above.
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
                            FROM horses WHERE maker IS NOT NULL), '[]'::jsonb),
    'scales',     COALESCE((SELECT jsonb_agg(DISTINCT scale ORDER BY scale)
                            FROM horses WHERE scale IS NOT NULL), '[]'::jsonb),
    'finishes',   COALESCE((SELECT jsonb_agg(DISTINCT finish_type ORDER BY finish_type)
                            FROM horses WHERE finish_type IS NOT NULL), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(DISTINCT asset_category ORDER BY asset_category)
                            FROM horses WHERE asset_category IS NOT NULL), '[]'::jsonb)
);
$$;
