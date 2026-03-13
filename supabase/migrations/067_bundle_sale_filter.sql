-- ============================================================
-- Migration 067: Blue Book — Exclude Bundle Sales
-- Bundle sales inflate individual model prices unfairly
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_market_prices;

CREATE MATERIALIZED VIEW mv_market_prices AS
SELECT
    h.catalog_id,
    h.finish_type,
    h.life_stage,
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
  AND (t.metadata->>'is_bundle_sale') IS DISTINCT FROM 'true'
GROUP BY h.catalog_id, h.finish_type, h.life_stage;

CREATE UNIQUE INDEX idx_mv_market_prices_composite
    ON mv_market_prices (catalog_id, finish_type, life_stage);

CREATE OR REPLACE FUNCTION refresh_market_prices()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_prices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON mv_market_prices TO anon, authenticated;
