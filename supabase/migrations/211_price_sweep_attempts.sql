-- 211: The eBay sweep remembers what it TRIED, not just what it found
-- (2026-09-17).
--
-- The weekly cron was firing every Monday and writing 5, 7, then 1
-- signals from a 150-model slice. Cause: the slice was ordered by the
-- signals table's observed_at, and a model that was swept but produced
-- no signal (fewer than three matching listings) leaves no row there —
-- so it still sorted as "never read" and came up again the next week.
-- The same ~150 unproductive models were swept every Monday while
-- ~2,480 reachable models never got their first look.
--
-- This table is the attempt ledger: one row per model, refreshed each
-- time the sweep asks eBay about it, whatever the answer. The cron
-- orders never-attempted first, then stalest attempt, so the front of
-- the queue always moves. Aggregate bookkeeping only — no listing
-- content, nothing of eBay's is kept here.
CREATE TABLE IF NOT EXISTS public.catalog_price_sweeps (
    catalog_item_id UUID PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    swept_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- signal   = a reading was written
    -- no-match = eBay answered, but fewer than three listings matched
    -- error    = the request failed (logged; retried like any other)
    -- skipped  = nothing to ask (no usable model number)
    outcome         TEXT NOT NULL CHECK (outcome IN ('signal', 'no-match', 'error', 'skipped')),
    -- Listings behind the reading when there was one; 0 otherwise.
    sample_size     INT NOT NULL DEFAULT 0 CHECK (sample_size >= 0)
);

COMMENT ON TABLE public.catalog_price_sweeps IS
  'When the eBay price sweep last asked about each catalog entry, and what came back. Drives sweep ordering; lets a page say "checked, nothing listed" instead of nothing at all.';

CREATE INDEX IF NOT EXISTS idx_price_sweeps_swept_at
    ON public.catalog_price_sweeps(swept_at ASC);

ALTER TABLE public.catalog_price_sweeps ENABLE ROW LEVEL SECURITY;

-- Readable like the signals themselves (a date and a word per model);
-- only the service role writes.
DROP POLICY IF EXISTS "price sweeps are public" ON public.catalog_price_sweeps;
CREATE POLICY "price sweeps are public"
    ON public.catalog_price_sweeps FOR SELECT
    USING (true);
GRANT SELECT ON public.catalog_price_sweeps TO anon, authenticated;

-- Every model that already has a reading was, by definition, attempted.
INSERT INTO public.catalog_price_sweeps (catalog_item_id, swept_at, outcome, sample_size)
SELECT catalog_item_id, observed_at, 'signal', sample_size
FROM public.catalog_price_signals
ON CONFLICT (catalog_item_id) DO NOTHING;

-- ✅ Migration 211 Complete — the sweep remembers its attempts
