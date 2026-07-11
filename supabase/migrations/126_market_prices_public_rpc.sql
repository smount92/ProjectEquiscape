-- ══════════════════════════════════════════════════════════════
-- Migration 126: Public read path for mv_market_prices (anon-safe)
-- ══════════════════════════════════════════════════════════════
-- Live bug: /market is a public path in src/proxy.ts, but market.ts
-- (searchMarketPrices / getMarketPrice / getTopTraded) reads the
-- mv_market_prices materialized view directly, and anon SELECT on that MV
-- was REVOKED in 092_supabase_linter_fixes.sql (Fix 4,
-- materialized_view_in_api). So logged-out visitors to /market got ZERO
-- rows — the whole Blue Book looked empty to anyone not signed in.
--
-- Fix: a SECURITY DEFINER, aggregate-only reader that returns the MV's
-- already-aggregated rows (grouped by catalog_id/finish/life_stage — never
-- per-user data) through a controlled function, WITHOUT re-granting anon
-- SELECT on the MV itself. This keeps the MV out of the anon PostgREST
-- surface (no ad-hoc crawling, preserves the 092 linter fix) while letting
-- the public price guide work. It also gives Batch I's reference-page
-- price teaser a ready anon-safe source: call with p_catalog_id set.
--
-- Aggregate-only guarantee: the MV exposes MIN/MAX/AVG/median/COUNT/last-
-- sold per (catalog_id, finish_type, life_stage). No owner, no horse id, no
-- transaction id — so publishing it to anon leaks nothing about who sold
-- what. authenticated paths (Pro insurance report, the stablemaster cron)
-- keep their existing direct/service-role access and are unaffected.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_market_rows(
    p_catalog_id UUID DEFAULT NULL,
    p_finish_type TEXT DEFAULT NULL,
    p_life_stage TEXT DEFAULT NULL
)
RETURNS TABLE (
    catalog_id UUID,
    finish_type TEXT,
    life_stage TEXT,
    lowest_price NUMERIC,
    highest_price NUMERIC,
    average_price NUMERIC,
    median_price NUMERIC,
    transaction_volume BIGINT,
    last_sold_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT
        m.catalog_id,
        m.finish_type::TEXT,
        m.life_stage::TEXT,
        m.lowest_price,
        m.highest_price,
        m.average_price,
        m.median_price,
        m.transaction_volume,
        m.last_sold_at
    FROM public.mv_market_prices m
    WHERE (p_catalog_id  IS NULL OR m.catalog_id = p_catalog_id)
      AND (p_finish_type IS NULL OR m.finish_type::TEXT = p_finish_type)
      AND (p_life_stage  IS NULL OR m.life_stage::TEXT = p_life_stage);
$$;

GRANT EXECUTE ON FUNCTION get_market_rows(UUID, TEXT, TEXT) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 126 Complete — get_market_rows() aggregate reader.
-- After apply: npm run gen-types (replaces the interim entry in
-- src/lib/types/database.generated.ts).
-- ══════════════════════════════════════════════════════════════
