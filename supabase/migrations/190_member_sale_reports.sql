-- ============================================================
-- 190: Member-reported sales — "what did this horse actually go for?"
--
-- Automated matching against eBay reaches about a quarter of the catalog
-- and only ever sees ASKING prices. Members can do what a matcher cannot:
-- look at a listing and know it is an Alborozo. This is the only route to
-- SOLD prices that depends on nobody's API approval.
--
-- THE THREAT IS NOT SPAM, IT IS QUIET PRICE MANIPULATION. Once the
-- Registry's prices carry weight, a seller has a reason to report
-- inflated sales for models they hold, and that contribution looks
-- helpful. The aggregation rules live in src/lib/market/saleReports.ts
-- (several sales, from several members, outliers dropped, self-reported
-- sales never priced from). The constraints here are the half that must
-- hold even if a caller forgets to use that module:
--
--   * one member may report a given listing ONCE (unique reporter+url),
--     so a single account cannot manufacture corroboration
--   * a report must name a real catalog entry and a real member
--   * the price must be sane and the sale must not be in the future
--
-- PROVENANCE STAYS SEPARATE. This table holds SOLD prices reported by
-- people. catalog_price_signals (189) holds ASKING prices observed by
-- machine. catalog_items.attributes.retail_price holds original MSRP.
-- Three different kinds of claim; never merge them into one number.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.catalog_sale_reports (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    reporter_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Identifies the SALE. Two members reporting this URL are two
    -- witnesses to one transaction, not two transactions.
    source_url     TEXT NOT NULL CHECK (source_url ~* '^https?://'),
    source_host    TEXT NOT NULL,
    price          NUMERIC(10,2) NOT NULL CHECK (price >= 1 AND price <= 100000),
    currency       TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
    sold_on        DATE NOT NULL CHECK (sold_on <= (now() AT TIME ZONE 'utc')::date + 1),
    -- Declared, not detected. A seller reporting their own sale is
    -- allowed and useful as a record; it is simply never priced from.
    self_reported  BOOLEAN NOT NULL DEFAULT false,
    note           TEXT CHECK (note IS NULL OR char_length(note) <= 500),
    -- Moderation: reports are visible immediately but can be struck.
    status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'disputed', 'removed')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One member, one report per listing. This is the constraint that
    -- stops a single account manufacturing its own corroboration.
    CONSTRAINT one_report_per_member_per_listing UNIQUE (reporter_id, source_url)
);

COMMENT ON TABLE public.catalog_sale_reports IS
  'Member-reported SOLD prices with a public source link. Aggregate only via src/lib/market/saleReports.ts — never average these raw, and never merge with catalog_price_signals (asking) or attributes.retail_price (MSRP).';
COMMENT ON COLUMN public.catalog_sale_reports.self_reported IS
  'Reporter sold the item. Kept as a record, excluded from any priced summary.';

CREATE INDEX IF NOT EXISTS idx_sale_reports_item
    ON public.catalog_sale_reports(catalog_item_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sale_reports_reporter
    ON public.catalog_sale_reports(reporter_id);

ALTER TABLE public.catalog_sale_reports ENABLE ROW LEVEL SECURITY;

-- Anyone may read active reports: this is reference data, and the
-- Registry's trust features are not paywalled.
DROP POLICY IF EXISTS "active sale reports are public" ON public.catalog_sale_reports;
CREATE POLICY "active sale reports are public"
    ON public.catalog_sale_reports FOR SELECT
    USING (status = 'active');

-- A signed-in member may file a report AS THEMSELVES. The reporter_id
-- check is what stops one account filing under another's name to fake
-- the several-members rule.
DROP POLICY IF EXISTS "members file their own reports" ON public.catalog_sale_reports;
CREATE POLICY "members file their own reports"
    ON public.catalog_sale_reports FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = reporter_id);

-- A member may withdraw their own report. Deliberately DELETE-only:
-- allowing UPDATE would let a price be edited after others corroborated
-- it, which is the same manipulation by a slower route.
DROP POLICY IF EXISTS "members withdraw their own reports" ON public.catalog_sale_reports;
CREATE POLICY "members withdraw their own reports"
    ON public.catalog_sale_reports FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = reporter_id);

GRANT SELECT, INSERT, DELETE ON public.catalog_sale_reports TO authenticated;
GRANT SELECT ON public.catalog_sale_reports TO anon;

-- Verify (with a CLIENT key, not the SQL editor — postgres bypasses RLS
-- and hides exactly this class of bug):
--   1. Signed out: SELECT works, INSERT is denied.
--   2. Signed in: INSERT with your own uid works; INSERT with someone
--      else's reporter_id is denied.
--   3. The same member inserting the same source_url twice is rejected by
--      one_report_per_member_per_listing.
--   4. UPDATE of an existing report is denied for everyone.
