-- ============================================================
-- 197: asking-price history — the ledger behind the rolling signal
--
-- 189 is deliberately a rolling signal: one row per model, each sweep
-- replaces the last reading. That is right for "what is it going for
-- NOW", and it throws away a data point every week. This table is the
-- ledger: every sweep appends its aggregates here, so a year from now a
-- model's page can show where asking prices have been, not just where
-- they are. Nobody else in the hobby has this series — it only exists
-- if we start writing it down, which is why this lands now rather than
-- when the chart is designed.
--
-- ASKING, NOT SOLD — same contract as 189, same column names, so the
-- two tables can never be joined into an accidental "sold for".
--
-- AGGREGATES ONLY, NO LISTINGS. The signal row carries its 3 receipt
-- listings because they are live right now; a history row must not —
-- eBay listings expire, stale eBay content is not ours to republish,
-- and the numbers (low/median/high/sample) are our own computed work
-- product. Facts, in our own words — same line the catalog walks.
--
-- ONE ROW PER MODEL PER DAY PER SOURCE. The weekly cron gives one row a
-- week; a manual catch-up on the same day refreshes that day's row
-- instead of stacking duplicates that would bend a future trend line.
-- `source` is in the key so a second feed (MH$P, our own sales) can
-- share this spine later without colliding with eBay's series.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.catalog_price_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_item_id  UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    asking_low       NUMERIC(10,2) NOT NULL CHECK (asking_low   >= 0),
    asking_median    NUMERIC(10,2) NOT NULL CHECK (asking_median >= 0),
    asking_high      NUMERIC(10,2) NOT NULL CHECK (asking_high  >= 0),
    currency         TEXT NOT NULL DEFAULT 'USD',
    sample_size      INT NOT NULL CHECK (sample_size > 0),
    source           TEXT NOT NULL DEFAULT 'ebay-browse',
    -- The day this reading was taken. DATE, not timestamptz: the series
    -- is daily-grained by design, and the unique key hangs off it.
    observed_on      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT price_history_range CHECK (asking_low <= asking_median AND asking_median <= asking_high),
    CONSTRAINT price_history_one_per_day UNIQUE (catalog_item_id, source, observed_on)
);

COMMENT ON TABLE public.catalog_price_history IS
  'Append-only daily ledger of ASKING-price aggregates per catalog entry. Not sold prices. Aggregates only — never store listing titles/URLs here.';
COMMENT ON COLUMN public.catalog_price_history.asking_median IS
  'Median of asking prices observed that day. NEVER present this as a sale price.';

-- The one read pattern: a model page pulling its series in date order.
CREATE INDEX IF NOT EXISTS idx_price_history_item_date
    ON public.catalog_price_history(catalog_item_id, observed_on DESC);

ALTER TABLE public.catalog_price_history ENABLE ROW LEVEL SECURITY;

-- Readable by everyone — reference data, and trust features are not
-- paywalled. Writes come only from the cron via the service role; no
-- INSERT/UPDATE/DELETE policy exists, so RLS denies them by default.
DROP POLICY IF EXISTS "price history is public" ON public.catalog_price_history;
CREATE POLICY "price history is public"
    ON public.catalog_price_history FOR SELECT
    USING (true);

GRANT SELECT ON public.catalog_price_history TO anon, authenticated;

-- Day-one backfill: every current signal becomes that model's first
-- history row, dated the day the sweep observed it. "Starting from
-- today" means today's sweep is already in the ledger the moment this
-- runs — paste this AFTER the current catch-up sweep finishes so the
-- whole expanded set is captured, not just the models swept so far.
-- A model a member has flagged as wrongly matched does not enter the
-- ledger — a wrong price is bad enough live; fossilized it would keep
-- misleading long after the flag was resolved.
INSERT INTO public.catalog_price_history
    (catalog_item_id, asking_low, asking_median, asking_high, currency, sample_size, source, observed_on)
SELECT s.catalog_item_id, s.asking_low, s.asking_median, s.asking_high, s.currency, s.sample_size, s.source, s.observed_at::date
FROM public.catalog_price_signals s
WHERE NOT EXISTS (
    SELECT 1 FROM public.catalog_price_signal_flags f
    WHERE f.catalog_item_id = s.catalog_item_id AND f.status = 'active'
)
ON CONFLICT (catalog_item_id, source, observed_on) DO NOTHING;

-- Verify:
--   1. As an anon client key (NOT the SQL editor):
--        SELECT count(*) FROM catalog_price_history;  -- succeeds, = signal count
--        INSERT INTO catalog_price_history ...;       -- denied
--   2. Same-day dedup:
--        run the backfill INSERT above twice — count must not change.
