-- ══════════════════════════════════════════════════════════════
-- Migration 134: at-a-glance catalog stats (batch, anon-safe)
-- ══════════════════════════════════════════════════════════════
-- Powers a "Collectors / Wanted / For sale" column on the catalog browse
-- (/catalog). Anon can't read user_horses / user_wishlists (RLS), so this is a
-- SECURITY DEFINER, aggregate-only RPC — same pattern as count_catalog_collectors
-- (migration 130). Batched: one call resolves stats for a whole page of catalog
-- ids instead of N per-row calls. Returns counts only — never owner ids/rows or
-- vault values. Additive + idempotent. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_catalog_stats(p_ids UUID[])
RETURNS TABLE (
  catalog_id UUID,
  owner_count BIGINT,
  want_count BIGINT,
  for_sale_count BIGINT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    c.id AS catalog_id,
    (SELECT count(DISTINCT uh.owner_id)
       FROM public.user_horses uh
       WHERE uh.catalog_id = c.id AND uh.deleted_at IS NULL) AS owner_count,
    (SELECT count(DISTINCT uw.user_id)
       FROM public.user_wishlists uw
       WHERE uw.catalog_id = c.id) AS want_count,
    (SELECT count(*)
       FROM public.user_horses uh
       WHERE uh.catalog_id = c.id
         AND uh.deleted_at IS NULL
         AND uh.is_public = true
         AND uh.trade_status IN ('For Sale', 'Open to Offers')) AS for_sale_count
  FROM public.catalog_items c
  WHERE c.id = ANY(p_ids);
$$;

GRANT EXECUTE ON FUNCTION get_catalog_stats(UUID[]) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 134 Complete — get_catalog_stats(). After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
