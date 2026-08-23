-- ============================================================
-- 189: eBay price signals for catalog entries
--
-- The Registry's Blue Book has one row in it, because nothing has sold
-- through the site yet — a chicken-and-egg it cannot solve on its own.
-- Pulling price signals in from eBay breaks that: the catalog can say
-- what a model is going for before the marketplace has any volume.
--
-- ASKING, NOT SOLD. Every row here comes from eBay's Browse API, which
-- returns ACTIVE listings. Sold prices live behind the Marketplace
-- Insights API (restricted access, granted by application) and are not
-- what this table holds. The column is named `asking_*` deliberately so
-- that a future query cannot quietly average asking prices into
-- something a member reads as "sold for". If sold data is granted later
-- it belongs in its own columns, side by side, never merged into these.
--
-- ONE ROW PER CATALOG ENTRY. This is a rolling signal, not a ledger —
-- each sweep replaces the previous reading for that model. The sample
-- that produced it is kept (count, low, high) so a member can judge how
-- much to trust a number drawn from three listings versus thirty.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.catalog_price_signals (
    catalog_item_id UUID PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    -- Asking prices, in whole currency units.
    asking_low       NUMERIC(10,2) NOT NULL CHECK (asking_low   >= 0),
    asking_median    NUMERIC(10,2) NOT NULL CHECK (asking_median >= 0),
    asking_high      NUMERIC(10,2) NOT NULL CHECK (asking_high  >= 0),
    currency         TEXT NOT NULL DEFAULT 'USD',
    -- How many listings the reading is drawn from. A one-listing signal
    -- is worth showing differently from a thirty-listing one.
    sample_size      INT NOT NULL CHECK (sample_size > 0),
    -- Which rule matched, so a bad signal can be traced to its cause
    -- rather than argued about.
    match_basis      TEXT NOT NULL,
    source           TEXT NOT NULL DEFAULT 'ebay-browse',
    observed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT price_signal_range CHECK (asking_low <= asking_median AND asking_median <= asking_high)
);

COMMENT ON TABLE public.catalog_price_signals IS
  'Rolling ASKING-price signal per catalog entry, from eBay active listings. Not sold prices. One row per model; each sweep replaces the previous reading.';
COMMENT ON COLUMN public.catalog_price_signals.asking_median IS
  'Median of currently-listed asking prices. NEVER present this as a sale price.';

CREATE INDEX IF NOT EXISTS idx_price_signals_observed
    ON public.catalog_price_signals(observed_at DESC);

ALTER TABLE public.catalog_price_signals ENABLE ROW LEVEL SECURITY;

-- Readable by everyone: this is reference data, and the Registry's trust
-- features are not paywalled.
DROP POLICY IF EXISTS "price signals are public" ON public.catalog_price_signals;
CREATE POLICY "price signals are public"
    ON public.catalog_price_signals FOR SELECT
    USING (true);

-- Writes come only from the cron job via the service role. No policy is
-- granted to anon or authenticated, so RLS denies them by default.
GRANT SELECT ON public.catalog_price_signals TO anon, authenticated;

-- Verify:
--   1. As an anon client key (NOT the SQL editor, which runs as postgres
--      and hides exactly this class of bug):
--        SELECT count(*) FROM catalog_price_signals;   -- should succeed
--        INSERT INTO catalog_price_signals ...;        -- should be denied
--   2. The range constraint holds:
--        INSERT ... (asking_low, asking_median, asking_high) = (10, 5, 20)
--        -- should be rejected by price_signal_range
