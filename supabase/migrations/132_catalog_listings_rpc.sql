-- ══════════════════════════════════════════════════════════════
-- Migration 132: Anon-safe "for sale now" listings for reference pages
-- ══════════════════════════════════════════════════════════════
-- The reference page's "For sale now" section joined users!inner(alias_name),
-- but users is SELECT-only for `authenticated` (migration 022) — so anonymous
-- visitors (the whole SEO audience) got NO listings and no seller alias. This
-- SECURITY DEFINER RPC returns active for-sale horses of a catalog model plus
-- the seller's public alias, without exposing the users table. Public-safe
-- fields only (no email, no vault, no owner id). Additive + idempotent.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_catalog_listings(
  p_catalog_id UUID,
  p_limit INT DEFAULT 12
)
RETURNS TABLE (
  horse_id UUID,
  custom_name TEXT,
  trade_status TEXT,
  listing_price NUMERIC,
  marketplace_notes TEXT,
  owner_alias TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT uh.id, uh.custom_name, uh.trade_status, uh.listing_price,
         uh.marketplace_notes, u.alias_name
  FROM public.user_horses uh
  JOIN public.users u ON u.id = uh.owner_id
  WHERE uh.catalog_id = p_catalog_id
    AND uh.is_public = true
    AND uh.deleted_at IS NULL
    AND uh.trade_status IN ('For Sale', 'Open to Offers')
  ORDER BY uh.listing_price ASC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_catalog_listings(UUID, INT) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 132 Complete — get_catalog_listings() (anon-safe seller alias).
-- After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
