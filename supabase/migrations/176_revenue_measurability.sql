-- ══════════════════════════════════════════════════════════════
-- Migration 176: Revenue measurability — MAU, subscription state
--
-- ADDITIVE ONLY. One new column on users, one new table, one new
-- guard trigger, four new functions. Nothing existing is dropped,
-- rewritten or backfilled. Application code feature-detects every
-- object below (src/lib/metrics/revenue.ts) and renders "—" until
-- this is pasted; the beacon route and the Stripe webhook both keep
-- working unchanged in the meantime.
--
-- WHY THIS EXISTS. docs/BUSINESS_MODEL_2026.md opens with the finding
-- that the site cannot answer its own commercial questions:
--
--   · There is no last_seen column, so MONTHLY actives — the
--     denominator of every conversion rate in that report — can only
--     be estimated. site_activity_daily (175) records DAILY actives
--     and deliberately cannot be rolled up into a month, because the
--     only per-viewer structure is a salted hash purged nightly.
--   · Tier lives ONLY in auth.users.app_metadata, written by the
--     Stripe webhook. There is no subscriptions table, so MRR,
--     churn, conversion and cohort retention are questions the
--     schema cannot answer without exporting from Stripe.
--
-- WHAT THIS DOES NOT DO, deliberately:
--
--   · last_seen_on is ONE DATE, not a trail. It records that someone
--     was here on a day, never what they looked at. Yesterday's value
--     is overwritten, so there is no history to mine and no way to
--     reconstruct a session. The "metrics track objects, never
--     people" guardrail (175) is about what people LOOKED AT; a
--     single presence date engages none of it, and the business
--     report says so explicitly.
--   · subscription_state MIRRORS the Stripe webhook's existing
--     app_metadata.tier write. It is a reporting record, never a
--     gate: nothing on the site reads it to decide what a member may
--     do. If the two ever disagree, app_metadata wins for access and
--     this table is the one that is wrong.
--   · Neither object is readable by anon or authenticated. The admin
--     console reads AGGREGATES through service_role-only functions —
--     there is no query anywhere that returns a list of who pays.
--
-- After applying: run `npm run gen-types`.
-- ══════════════════════════════════════════════════════════════

-- ── 1. The presence date ──────────────────────────────────────
--
-- Two statements, not one, on purpose. ADD COLUMN with no default
-- leaves every EXISTING row NULL — those members have not been seen
-- since this column existed, and claiming otherwise would make the
-- first month's MAU a fiction. SET DEFAULT afterwards applies only
-- to rows inserted from here on, so a signup counts as activity the
-- day it happens (handle_new_user, migration 001, runs SECURITY
-- DEFINER and inserts without naming this column).

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_on DATE;

ALTER TABLE public.users
  ALTER COLUMN last_seen_on SET DEFAULT (now() AT TIME ZONE 'utc')::date;

COMMENT ON COLUMN public.users.last_seen_on IS
  'The last UTC day this member was seen on a tracked page. ONE date, overwritten in place — not a trail, not a history, and never joined to anything that says what they looked at. Written at most once per member per day by touch_last_seen(), called from the view-beacon route. NULL means "not seen since migration 176 was applied", which is the honest answer for every member who predates it. Its only consumer is the MAU count in the admin console.';

-- Partial: the only query is "seen inside the last N days", so rows
-- that have never been seen are dead weight in the index.
CREATE INDEX IF NOT EXISTS idx_users_last_seen_on
  ON public.users (last_seen_on DESC)
  WHERE last_seen_on IS NOT NULL;

-- ── 2. The write guard ────────────────────────────────────────
--
-- users_update_own (022) lets a member update their own row, which
-- would let a crafted request set any date it liked and quietly
-- inflate MAU. Same stance and same shape as
-- users_guard_supporter_cols (142): the protected column is PINNED
-- to its server value rather than raising, so an ordinary settings
-- save that happens to include the whole row never 500s.
--
-- Two bypasses, in this order:
--   1. auth.uid() IS NULL — service contexts (SQL editor, service
--      role, crons, migration backfills). House lesson: a guard
--      trigger without this line breaks the very migration that
--      installs it. RLS is what keeps clients out of those paths.
--   2. current_user not in (anon, authenticated) — this is what lets
--      touch_last_seen() through: inside a SECURITY DEFINER function
--      current_user is the function's owner, while auth.uid() still
--      returns the calling member. Only the direct client UPDATE is
--      caught here.

CREATE OR REPLACE FUNCTION public.users_guard_activity_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN NEW;
    END IF;

    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.last_seen_on := (now() AT TIME ZONE 'utc')::date;
        ELSE
            NEW.last_seen_on := OLD.last_seen_on;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.users_guard_activity_cols() IS
  'Makes last_seen_on server-managed. A member may update their own users row; they may not choose when they were last here. Pins rather than raises, so unrelated profile saves are unaffected. Runs alongside trg_users_guard_supporter_cols — both are BEFORE row triggers returning NEW, so they chain.';

DROP TRIGGER IF EXISTS trg_users_guard_activity_cols ON public.users;
CREATE TRIGGER trg_users_guard_activity_cols
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.users_guard_activity_cols();

-- ── 3. The only writer ────────────────────────────────────────
--
-- Called from /api/beacon/view, which already resolves the session
-- for the view counter — so this adds no auth round trip anywhere.
-- The WHERE clause is the whole cost story: after the first call of
-- a member's day the UPDATE matches zero rows and the statement is
-- a cheap index probe. No date ever crosses the wire; the server
-- decides what "today" is.

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid   UUID := (SELECT auth.uid());
    v_today DATE := (now() AT TIME ZONE 'utc')::date;
BEGIN
    -- Signed out: nothing to record. Anonymous presence is already
    -- counted, without identity, by site_activity_daily.anon_dau.
    IF v_uid IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.users
       SET last_seen_on = v_today
     WHERE id = v_uid
       AND last_seen_on IS DISTINCT FROM v_today;
END;
$$;

COMMENT ON FUNCTION public.touch_last_seen() IS
  'Stamps today''s UTC date on the caller''s own users row, at most once per day, and only ever on their own row — the id comes from auth.uid(), never from an argument. SECURITY DEFINER so it passes the write guard above; the guard is what stops a member writing the column directly. Returns nothing and raises nothing: the caller is a fire-and-forget beacon.';

REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- ── 4. Where a subscription lives in the database ─────────────
--
-- One row per member who has ever been a paying subscriber. Written
-- ONLY by the Stripe webhook, through record_subscription_state()
-- below, in the same breath as the existing app_metadata.tier write.
--
-- Supporter is deliberately absent. It is not a tier — it is a
-- cosmetic flag on users.is_supporter (142) that grants nothing, its
-- price is not in the repo (it is read live from Stripe), and the
-- webhook intercepts supporter subscriptions before the tier logic
-- precisely so the two can never interact. Supporter revenue is a
-- Stripe-dashboard question and the admin console says so.

CREATE TABLE IF NOT EXISTS subscription_state (
  user_id                UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  -- What they are paying for right now. 'free' is a real state here:
  -- it is what a lapsed or cancelled subscriber becomes, and keeping
  -- the row is what makes churn countable at all.
  tier                   TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'studio')),
  -- Stripe's own vocabulary, stored verbatim. 'canceled' keeps
  -- Stripe's spelling on purpose so a value never has to be
  -- translated in two directions.
  status                 TEXT NOT NULL CHECK (status IN (
                           'active', 'trialing', 'past_due', 'canceled',
                           'unpaid', 'incomplete', 'incomplete_expired', 'paused'
                         )),
  -- When the paid-for period runs out. What "cancel at period end"
  -- looks like in a report: status still active, this date in view.
  current_period_end     TIMESTAMPTZ,
  -- For reconciliation against the Stripe dashboard when a number
  -- looks wrong. Not identity: these ids are meaningless off Stripe.
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  -- First time this member ever became paid. Preserved across lapse
  -- and resubscribe (same stance as users.supporter_since), because
  -- it is the only thing that makes a cohort question answerable.
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE subscription_state IS
  'The reporting mirror of a Stripe subscription — MRR, subscriber counts, churn and cohort questions all read from here. NOT a gate: every access decision on the site reads auth.users.app_metadata.tier, which the same webhook branch writes. If the two disagree, app_metadata is right about access and this row is the one to fix. Service-role writes only; nothing client-side may read it, because a list of who pays is not a thing this site needs to be able to produce.';
COMMENT ON COLUMN subscription_state.tier IS
  'free | pro | studio. Mirrors app_metadata.tier. Supporter is not a tier and never appears here — see the table header.';
COMMENT ON COLUMN subscription_state.started_at IS
  'First paid moment, preserved across cancel + resubscribe. Churn and cohort retention need a start date that does not reset.';

CREATE INDEX IF NOT EXISTS idx_subscription_state_tier_status
  ON subscription_state (tier, status);

ALTER TABLE subscription_state ENABLE ROW LEVEL SECURITY;

-- No policy is defined, deliberately — same stance as
-- object_view_daily (175). The service role bypasses RLS; every other
-- role sees zero rows and can write nothing. The admin console reads
-- the aggregate functions below, never the table.
REVOKE ALL ON TABLE subscription_state FROM anon, authenticated;

-- ── 5. The webhook's write ────────────────────────────────────
--
-- A function rather than a client-side upsert so that started_at
-- preservation and the updated_at bump live in ONE place and cannot
-- drift between the four webhook branches that call it. Idempotent:
-- Stripe retries deliver the same event more than once and must land
-- on the same row with the same values.

CREATE OR REPLACE FUNCTION public.record_subscription_state(
    p_user_id                UUID,
    p_tier                   TEXT,
    p_status                 TEXT,
    p_current_period_end     TIMESTAMPTZ DEFAULT NULL,
    p_stripe_customer_id     TEXT DEFAULT NULL,
    p_stripe_subscription_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_user_id IS NULL OR p_tier IS NULL OR p_status IS NULL THEN
        RETURN;
    END IF;

    -- A member deleted between the Stripe event and its retry would
    -- otherwise raise a foreign-key error and make Stripe retry
    -- forever. Nothing to record, so record nothing.
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN
        RETURN;
    END IF;

    INSERT INTO public.subscription_state AS s (
        user_id, tier, status, current_period_end,
        stripe_customer_id, stripe_subscription_id, started_at, updated_at
    )
    VALUES (
        p_user_id, p_tier, p_status, p_current_period_end,
        p_stripe_customer_id, p_stripe_subscription_id, now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE
       SET tier                   = EXCLUDED.tier,
           status                 = EXCLUDED.status,
           current_period_end     = COALESCE(EXCLUDED.current_period_end, s.current_period_end),
           stripe_customer_id     = COALESCE(EXCLUDED.stripe_customer_id, s.stripe_customer_id),
           stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, s.stripe_subscription_id),
           -- Never moves. The first paid date is the cohort.
           started_at             = s.started_at,
           updated_at             = now();
END;
$$;

COMMENT ON FUNCTION public.record_subscription_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) IS
  'The only writer of subscription_state. Called by the Stripe webhook alongside — never instead of — the app_metadata.tier write the site''s gates read. Preserves started_at across resubscribe and treats a NULL argument as "unchanged" so a thin event cannot erase what a fat one recorded. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.record_subscription_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_subscription_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO service_role;

-- ── 6. The admin's reads: aggregates, service role only ───────
--
-- Both functions return COUNTS. Neither returns a user_id, an alias
-- or an email, so there is no drill-down from the revenue cards to a
-- person even for an admin — the same posture metrics_top_objects
-- takes in 175.

CREATE OR REPLACE FUNCTION public.metrics_subscription_summary()
RETURNS TABLE (tier TEXT, status TEXT, subscribers BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.tier, s.status, count(*)::BIGINT
  FROM public.subscription_state s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.deleted_at IS NULL
    AND u.account_status <> 'deleted'
    AND u.is_test_account = false
  GROUP BY s.tier, s.status
  ORDER BY s.tier, s.status;
$$;

COMMENT ON FUNCTION public.metrics_subscription_summary() IS
  'Subscriber counts by tier and status for the admin console, which multiplies them by the net prices to get MRR. Test and deleted accounts are excluded — a comped test subscription must never show up as revenue. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.metrics_subscription_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.metrics_subscription_summary() TO service_role;

CREATE OR REPLACE FUNCTION public.metrics_active_members(p_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::INTEGER
  FROM public.users u
  WHERE u.last_seen_on >= (now() AT TIME ZONE 'utc')::date
                          - (GREATEST(COALESCE(p_days, 30), 1) - 1)
    AND u.deleted_at IS NULL
    AND u.account_status <> 'deleted'
    AND u.is_test_account = false;
$$;

COMMENT ON FUNCTION public.metrics_active_members(INTEGER) IS
  'Exact monthly actives: how many members have a last_seen_on inside the window. This is the number the business model could previously only estimate at 5–10x daily actives. One integer out — the rows behind it are never returned. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.metrics_active_members(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.metrics_active_members(INTEGER) TO service_role;

-- ══════════════════════════════════════════════════════════════
-- Migration 176 complete.
--
-- users.last_seen_on            one DATE, server-managed, no history
-- trg_users_guard_activity_cols pins it against client writes
-- touch_last_seen               the only writer; authenticated EXECUTE
-- subscription_state            reporting mirror; no client grants
-- record_subscription_state     the only writer; service_role EXECUTE
-- metrics_subscription_summary  \ admin aggregates; service_role
-- metrics_active_members        /  EXECUTE only
--
-- No table dropped, no row rewritten, nothing backfilled.
-- Re-runnable: every statement is IF NOT EXISTS, CREATE OR REPLACE,
-- or DROP TRIGGER IF EXISTS + CREATE.
--
-- After applying: run `npm run gen-types`. Until then the app calls
-- all of it through the untyped client in src/lib/metrics/db.ts and
-- degrades on 42P01 / 42703 / 42883 / PGRST202 / PGRST204 / PGRST205
-- (src/lib/metrics/revenue.ts): the beacon still answers 204, the
-- webhook still sets app_metadata.tier, the console shows "—".
--
-- Verify:
--   1. Presence, once a day, and only your own row:
--        -- signed in, load any tracked page, then:
--        SELECT last_seen_on FROM users WHERE id = auth.uid();  -- today
--        UPDATE users SET last_seen_on = '2020-01-01'
--         WHERE id = auth.uid();                                 -- 1 row
--        SELECT last_seen_on FROM users WHERE id = auth.uid();  -- STILL
--                                                               -- today
--   2. Nobody but the service role can see who pays:
--        SET LOCAL role authenticated;
--        SELECT count(*) FROM subscription_state;  -- 0 rows, RLS
--        SELECT metrics_active_members(30);        -- permission denied
--   3. The mirror survives a Stripe retry:
--        SELECT record_subscription_state(
--                 '<uuid>', 'pro', 'active', now() + interval '30 days',
--                 'cus_x', 'sub_x');
--        -- twice; expect one row, started_at unchanged by the second.
--   4. MRR sanity, in the console: subscriber counts x net price
--        (Pro $4.555, Studio $9.41 — src/lib/metrics/revenue.ts).
-- ══════════════════════════════════════════════════════════════
