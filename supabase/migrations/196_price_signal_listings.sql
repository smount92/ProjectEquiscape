-- ============================================================
-- 196: Price signals carry their receipts, and can be challenged
--
-- Two owner requests from the first live sweep:
--
-- LISTINGS. A price line nobody can check is an assertion; one that
-- links to the actual eBay listings is evidence. The signal row now
-- keeps its sample listings (title, price, url — cheapest first, the
-- same ones the aggregate was computed from), so the reference page can
-- link out. Links go THROUGH eBay's affiliate tracking, which also
-- means showing them earns the site money without hosting anything.
--
-- FLAGS. Matching is automated and will sometimes be wrong. A member
-- who knows the models better than a regex must be able to say so:
-- "this is the wrong model" files a flag, admins get notified, the
-- page STOPS SHOWING the signal immediately, and the sweep stops
-- refreshing that model until the flag is resolved. A wrong price that
-- keeps coming back after being reported would be worse than no
-- feature.
-- ============================================================

ALTER TABLE public.catalog_price_signals
    ADD COLUMN IF NOT EXISTS listings JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.catalog_price_signals.listings IS
  'Sample of the listings the aggregate was computed from: [{title, price, url}], cheapest first, max 3. URLs carry eBay Partner Network tracking.';

CREATE TABLE IF NOT EXISTS public.catalog_price_signal_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    reporter_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note            TEXT CHECK (note IS NULL OR char_length(note) <= 500),
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'resolved')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    -- One active flag per member per model is enough; repeat reports
    -- add nothing a moderator can use.
    CONSTRAINT one_flag_per_member_per_model UNIQUE (catalog_item_id, reporter_id)
);

COMMENT ON TABLE public.catalog_price_signal_flags IS
  'Member reports that an eBay price signal matched the wrong model. An ACTIVE flag hides the signal from the reference page and excludes the model from the sweep until resolved.';

CREATE INDEX IF NOT EXISTS idx_signal_flags_active
    ON public.catalog_price_signal_flags(catalog_item_id) WHERE status = 'active';

ALTER TABLE public.catalog_price_signal_flags ENABLE ROW LEVEL SECURITY;

-- Anyone may see THAT a signal is disputed (the render gate runs on the
-- anon client), but the note and reporter stay off the public read via
-- column grants below.
DROP POLICY IF EXISTS "signal flags are readable" ON public.catalog_price_signal_flags;
CREATE POLICY "signal flags are readable"
    ON public.catalog_price_signal_flags FOR SELECT
    USING (true);

-- A signed-in member files a flag as themselves.
DROP POLICY IF EXISTS "members flag as themselves" ON public.catalog_price_signal_flags;
CREATE POLICY "members flag as themselves"
    ON public.catalog_price_signal_flags FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = reporter_id);

-- Resolution is service-role only (admin action) — no UPDATE policy for
-- members, and per the posts_update lesson (195): the resolving action
-- must demand the updated row back rather than trust a silent 0-row
-- update.
GRANT SELECT (id, catalog_item_id, status, created_at)
    ON public.catalog_price_signal_flags TO anon;
GRANT SELECT, INSERT ON public.catalog_price_signal_flags TO authenticated;

-- Verify (client keys):
--   1. anon: SELECT id, catalog_item_id, status works; SELECT note fails.
--   2. member: INSERT with own reporter_id works; with another's, denied.
--   3. member: second INSERT for the same model rejected by the unique.
