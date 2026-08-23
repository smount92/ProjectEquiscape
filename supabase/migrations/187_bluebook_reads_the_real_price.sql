-- ============================================================
-- 187: The Blue Book has never had a single row
--
-- mv_market_prices (067) aggregates `transactions.metadata->>'sale_price'`.
-- NOTHING IN THE CODEBASE HAS EVER WRITTEN THAT KEY. Verified two ways:
--   · grep across src/ finds no writer of metadata.sale_price
--   · of 16 completed transactions in production, 0 carry a non-null
--     metadata.sale_price; the agreed figure lives in the
--     `offer_amount` COLUMN (added later, by the offer flow)
-- So the view has aggregated an empty set since the day it shipped, and
-- would have kept doing so for every future sale. This is not "no sales
-- yet" — the pipe was never connected.
--
-- Why it matters: the Blue Book is a headline trust feature ("priced by
-- the record"), it is free for everyone by deliberate policy, and
-- Blue Book PRO (sales-history charts) is sold as an MHH Pro benefit.
-- All three read this view.
--
-- THE FIX: read the price from where it actually is, preferring the
-- explicit metadata key if a future writer ever sets it (so this stays
-- correct either way), and falling back to offer_amount.
--
-- Everything else about the view is deliberately unchanged: completed
-- only, positive prices, catalog-linked horses only, bundle sales still
-- excluded (067's whole point — a bundle price is not one model's price).
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_market_prices;

CREATE MATERIALIZED VIEW mv_market_prices AS
WITH priced AS (
    SELECT
        t.id,
        t.horse_id,
        t.completed_at,
        -- The agreed figure, wherever it lives. offer_amount is the
        -- column the offer/deal flow actually fills.
        COALESCE(
            NULLIF(t.metadata->>'sale_price', '')::DECIMAL,
            t.offer_amount::DECIMAL
        ) AS sale_price
    FROM transactions t
    WHERE t.status = 'completed'
      AND (t.metadata->>'is_bundle_sale') IS DISTINCT FROM 'true'
)
SELECT
    h.catalog_id,
    h.finish_type,
    h.life_stage,
    MIN(p.sale_price) AS lowest_price,
    MAX(p.sale_price) AS highest_price,
    AVG(p.sale_price)::DECIMAL(10,2) AS average_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.sale_price)::DECIMAL(10,2) AS median_price,
    COUNT(p.id) AS transaction_volume,
    MAX(p.completed_at) AS last_sold_at
FROM priced p
JOIN user_horses h ON p.horse_id = h.id
WHERE p.sale_price IS NOT NULL
  AND p.sale_price > 0
  AND h.catalog_id IS NOT NULL
GROUP BY h.catalog_id, h.finish_type, h.life_stage;

CREATE UNIQUE INDEX idx_mv_market_prices_composite
    ON mv_market_prices (catalog_id, finish_type, life_stage);

GRANT SELECT ON mv_market_prices TO anon, authenticated;

-- CONCURRENTLY needs a populated view; the first refresh after a rebuild
-- must be plain. refresh_market_prices() (067) uses CONCURRENTLY, so seed
-- it here.
REFRESH MATERIALIZED VIEW mv_market_prices;

-- Verify:
--   SELECT count(*) FROM mv_market_prices;   -- expect > 0 now
--   SELECT catalog_id, average_price, median_price, transaction_volume
--     FROM mv_market_prices ORDER BY transaction_volume DESC LIMIT 5;
