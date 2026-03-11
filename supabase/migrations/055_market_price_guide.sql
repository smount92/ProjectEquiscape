-- ============================================================
-- Migration 055: Market Price Guide (Epic 4 - "The Blue Book")
-- Materialized view aggregating transaction sale prices per catalog item
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE MATERIALIZED VIEW
-- ══════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_market_prices AS
SELECT
    h.catalog_id,
    MIN(CAST(t.metadata->>'sale_price' AS DECIMAL)) AS lowest_price,
    MAX(CAST(t.metadata->>'sale_price' AS DECIMAL)) AS highest_price,
    AVG(CAST(t.metadata->>'sale_price' AS DECIMAL))::DECIMAL(10,2) AS average_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY CAST(t.metadata->>'sale_price' AS DECIMAL)
    )::DECIMAL(10,2) AS median_price,
    COUNT(t.id) AS transaction_volume,
    MAX(t.completed_at) AS last_sold_at
FROM transactions t
JOIN user_horses h ON t.horse_id = h.id
WHERE t.status = 'completed'
  AND t.metadata->>'sale_price' IS NOT NULL
  AND CAST(t.metadata->>'sale_price' AS DECIMAL) > 0
  AND h.catalog_id IS NOT NULL
GROUP BY h.catalog_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_market_prices_catalog
    ON mv_market_prices (catalog_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: FUNCTION TO REFRESH THE VIEW
-- Can be called by a cron job or manual trigger
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_market_prices()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_prices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: OPTIONAL - Schedule via pg_cron (if available)
-- Refresh nightly at 3am UTC
-- ══════════════════════════════════════════════════════════════
-- SELECT cron.schedule('refresh-market-prices', '0 3 * * *',
--     'SELECT refresh_market_prices()');

-- ══════════════════════════════════════════════════════════════
-- STEP 4: GRANT READ ACCESS
-- The view should be publicly readable (no RLS on materialized views)
-- ══════════════════════════════════════════════════════════════

GRANT SELECT ON mv_market_prices TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════
-- SELECT * FROM mv_market_prices LIMIT 10;
-- Expected: rows with catalog_id, lowest_price, average_price, etc.
-- (May be 0 rows if no completed transactions with sale_price exist yet)
