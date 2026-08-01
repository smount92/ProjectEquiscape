-- ══════════════════════════════════════════════════════════════
-- Migration 145: collector counts respect stable privacy
-- ══════════════════════════════════════════════════════════════
-- NUMBERING NOTE: 144 (batch import v2) was the last migration on
-- disk when this was written. If another Wave 5a agent collides on a
-- number, the integration merger renumbers at merge (143's convention).
--
-- WHY: the public "N collectors have this" aggregates counted EVERY
-- owner of a model — including owners whose horses are private
-- (is_public = false). That leaks the existence of private collection
-- contents into public, anon-readable numbers. The sibling
-- for_sale_count in get_catalog_stats already filtered
-- is_public = true; this brings the owner counts in line with that
-- existing pattern.
--
--   * count_catalog_collectors (migration 130) — now counts distinct
--     owners of PUBLIC horses only.
--   * get_catalog_stats.owner_count (migration 134) — same filter.
--     want_count is untouched (wishlists have no public/private state)
--     and for_sale_count already filtered.
--
-- ⚠ EXPECTED BEHAVIOR CHANGE: public collector numbers on reference
-- pages / catalog browse go DOWN after apply (private stables no
-- longer counted). That is the point — the old, higher numbers were
-- leaking private data.
--
-- Note: notify_catalog_owners_of_demand (130) intentionally still
-- reaches private owners — it discloses nothing to the caller (the
-- notification goes TO the private owner), so it is not changed here.
--
-- Additive + idempotent (CREATE OR REPLACE, same signatures — no
-- gen-types delta required, but harmless to re-run).
-- ══════════════════════════════════════════════════════════════

-- "N collectors have this" — distinct owners of public horses only.
CREATE OR REPLACE FUNCTION count_catalog_collectors(p_catalog_id UUID)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT count(DISTINCT owner_id)
  FROM public.user_horses
  WHERE catalog_id = p_catalog_id
    AND deleted_at IS NULL
    AND is_public = true;
$$;
GRANT EXECUTE ON FUNCTION count_catalog_collectors(UUID) TO anon, authenticated;

-- Batched catalog stats — owner_count now public-only, matching
-- for_sale_count's existing is_public filter.
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
       WHERE uh.catalog_id = c.id
         AND uh.deleted_at IS NULL
         AND uh.is_public = true) AS owner_count,
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
-- ✅ Migration 145 Complete — count_catalog_collectors +
-- get_catalog_stats.owner_count now count public horses only.
-- Public numbers drop after apply (see header). No gen-types delta.
-- ══════════════════════════════════════════════════════════════
