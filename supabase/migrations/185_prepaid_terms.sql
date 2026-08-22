-- ============================================================
-- 185: Time-boxed memberships — the entitlement clock, in the reports
-- ============================================================
--
-- WHAT THIS IS FOR. Model Horse Hub now sells memberships that END. A
-- prepaid term is one PayPal charge that buys N months and renews
-- nothing; a fixed-term subscription bills monthly and stops by itself
-- after 3, 6 or 12 cycles. Both exist because two prospective members in
-- a row said the same thing: they want the membership, they do not want
-- a standing authorization on their PayPal account.
--
-- WHAT THIS IS NOT FOR. Access. The tier of record is, exactly as
-- before, auth.users.app_metadata.tier — and the clock that ends a term
-- is auth.users.app_metadata.paid_through, read on every request by
-- getUserTier(). Both live beside each other in app_metadata precisely
-- so that a membership ending never depends on a table, a cron, or this
-- migration having been pasted.
--
-- ── NOTHING HERE IS REQUIRED FOR TERMS TO WORK ────────────────────
--
-- The application feature-detects all of it. With 185 unapplied:
--   · the reporting mirror falls back to record_paypal_subscription_state
--     (183), and then to record_subscription_state (176). Tier, status
--     and MRR stay correct; the reports just do not show WHEN a term
--     ends, which is a missing column on a dashboard, not a member
--     losing access;
--   · replay protection for captures falls back to the capture-id list
--     kept in app_metadata, which is durable and is what the grant path
--     actually checks first. It is correct for every sequential replay —
--     PayPal redelivering, the member refreshing, the webhook arriving
--     after the return leg.
--
-- WHAT PASTING IT BUYS. One specific race the metadata list cannot
-- close: the return leg and the webhook landing within the same few
-- hundred milliseconds, both reading the list before either writes it,
-- and both granting. Today that costs a member getting more months than
-- they paid for. claim_paypal_capture makes it impossible.
--
-- SAFE TO PASTE ON A LIVE DATABASE. Every statement is additive and
-- idempotent. No existing column, function, policy or grant is altered
-- or dropped — record_subscription_state (176, the Stripe webhook's only
-- writer) and record_paypal_subscription_state (183) are both left
-- exactly as they were.

-- ── 1. When the membership runs out ──────────────────────────
--
-- NULL is the ordinary value and means "no expiry": every existing row,
-- and every open-ended subscription forever. It must never be read as
-- "expired" — the application makes the same promise in
-- src/lib/entitlement/clock.ts and for the same reason.

ALTER TABLE public.subscription_state
  ADD COLUMN IF NOT EXISTS paid_through TIMESTAMPTZ;

COMMENT ON COLUMN public.subscription_state.paid_through IS
  'End of a PREPAID or FIXED-TERM membership. NULL means no expiry — an open-ended subscription, or a member who has never bought a term. Reporting only: the value that actually gates the site is auth.users.app_metadata.paid_through, read on every request. If the two ever disagree, app_metadata wins and this column is the one that is wrong.';

-- ── 2. The term-aware mirror write ───────────────────────────
--
-- A sibling of record_paypal_subscription_state rather than a parameter
-- added to it, for the same reason 183 did not touch 176: the function a
-- live webhook already calls keeps the exact signature and behaviour it
-- has today. Same contract as both of its predecessors — idempotent,
-- started_at never moves, and a NULL argument means "leave what you
-- have" so a thin event cannot erase what a fat one recorded.
--
-- p_paid_through is the ONE exception to that rule: it is written
-- verbatim, NULL included, because "this membership no longer has an end
-- date" is a real and important state (a term holder who moved to an
-- open-ended subscription, or whose term was refunded). COALESCE here
-- would make an ended term look permanent in the reports.

CREATE OR REPLACE FUNCTION public.record_paypal_term_state(
    p_user_id                UUID,
    p_tier                   TEXT,
    p_status                 TEXT,
    p_current_period_end     TIMESTAMPTZ DEFAULT NULL,
    p_paypal_subscription_id TEXT DEFAULT NULL,
    p_paid_through           TIMESTAMPTZ DEFAULT NULL
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

    -- A member deleted between the PayPal event and its retry would
    -- otherwise raise a foreign-key error and make PayPal retry forever.
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN
        RETURN;
    END IF;

    INSERT INTO public.subscription_state AS s (
        user_id, tier, status, current_period_end,
        provider, paypal_subscription_id, paid_through, started_at, updated_at
    )
    VALUES (
        p_user_id, p_tier, p_status, p_current_period_end,
        'paypal', p_paypal_subscription_id, p_paid_through, now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE
       SET tier                   = EXCLUDED.tier,
           status                 = EXCLUDED.status,
           current_period_end     = COALESCE(EXCLUDED.current_period_end, s.current_period_end),
           provider               = 'paypal',
           paypal_subscription_id = COALESCE(EXCLUDED.paypal_subscription_id, s.paypal_subscription_id),
           -- Written verbatim. See the note above.
           paid_through           = EXCLUDED.paid_through,
           started_at             = s.started_at,
           updated_at             = now();
END;
$$;

COMMENT ON FUNCTION public.record_paypal_term_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ) IS
  'The mirror write for time-boxed memberships. Called ALONGSIDE — never instead of — the app_metadata write the site''s gates read. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.record_paypal_term_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_paypal_term_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ) TO service_role;

-- ── 3. The capture ledger ────────────────────────────────────
--
-- WHY A CAPTURE NEEDS ITS OWN LEDGER, when paypal_webhook_events (183)
-- already de-duplicates deliveries. Two reasons:
--
--   · a term GRANT is not idempotent by construction. Every other write
--     in this integration sets absolute values — tier X, subscription
--     id Y — so a replay lands on the same state. A term ADDS months to
--     whatever is already there, on purpose (see the stacking rule), so
--     applying one twice genuinely gives twice the months.
--   · the two capture paths are not both webhooks. The return leg, where
--     the member is watching, captures and grants without any webhook
--     event existing yet. paypal_webhook_events cannot see it.
--
-- NO FOREIGN KEY on user_id, deliberately. This table's whole job is to
-- remember that a payment was applied; making that memory depend on the
-- payer's row still existing would delete the replay guard at exactly
-- the moment 183's own comments warn about — a member deleted between an
-- event and its retry.

CREATE TABLE IF NOT EXISTS public.paypal_prepaid_captures (
  -- PayPal's capture id. The payment itself, and the idempotency key.
  capture_id   TEXT PRIMARY KEY,
  user_id      UUID,
  order_id     TEXT,
  months       INT,
  -- When someone said "I am about to grant this".
  claimed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When the grant actually landed. NULL means a claim that has not
  -- (yet) become a membership — see the reclaim window below.
  applied_at   TIMESTAMPTZ,
  -- What the member ended up paid through. For reconciliation.
  paid_through TIMESTAMPTZ
);

COMMENT ON TABLE public.paypal_prepaid_captures IS
  'One row per PayPal capture that bought a prepaid membership term. Purely a replay guard and an audit trail: it holds no payment instrument, no payer detail and no amount — PayPal''s own capture id, our user id, and the dates. Safe to keep forever; it is one row per purchase.';

CREATE INDEX IF NOT EXISTS idx_paypal_prepaid_captures_user
  ON public.paypal_prepaid_captures (user_id);

ALTER TABLE public.paypal_prepaid_captures ENABLE ROW LEVEL SECURITY;

-- No policy, deliberately — the same stance as subscription_state (176),
-- object_view_daily (175) and paypal_webhook_events (183). service_role
-- bypasses RLS; every other role sees zero rows and can write nothing.
REVOKE ALL ON TABLE public.paypal_prepaid_captures FROM anon, authenticated;

-- ── 4. Claim a capture ───────────────────────────────────────
--
-- TRUE  = you are the one granting this term, go ahead.
-- FALSE = somebody else has it in hand. Do nothing.
--
-- THE RECLAIM WINDOW is the part worth reading twice. A plain
-- INSERT ... ON CONFLICT DO NOTHING would be a one-shot: if the process
-- that claimed a capture then failed to write the membership — a crash,
-- a timeout against the auth API, a deploy landing mid-request — every
-- retry afterwards would be told "already claimed" and the member would
-- have paid for a term that never arrived. Silently. Forever.
--
-- So a claim expires. A row that is still unapplied five minutes later
-- may be taken over by whoever asks next. Five minutes is far longer
-- than the milliseconds a genuine race lasts, and far shorter than the
-- three days PayPal keeps redelivering, so the next retry recovers the
-- lost grant while two simultaneous deliveries still cannot both win.
--
-- The INSERT and the check are one statement, so two concurrent
-- deliveries cannot both be told to proceed.

CREATE OR REPLACE FUNCTION public.claim_paypal_capture(
    p_capture_id TEXT,
    p_user_id    UUID DEFAULT NULL,
    p_order_id   TEXT DEFAULT NULL,
    p_months     INT  DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rows INT;
BEGIN
    -- A capture we cannot identify cannot be de-duplicated. Say TRUE:
    -- the caller's own app_metadata check is still in force, and
    -- refusing a term somebody has been charged for is the worse error.
    IF p_capture_id IS NULL OR btrim(p_capture_id) = '' THEN
        RETURN TRUE;
    END IF;

    INSERT INTO public.paypal_prepaid_captures AS c (
        capture_id, user_id, order_id, months
    )
    VALUES (btrim(p_capture_id), p_user_id, p_order_id, p_months)
    ON CONFLICT (capture_id) DO UPDATE
       SET claimed_at = now(),
           user_id    = COALESCE(c.user_id, EXCLUDED.user_id),
           order_id   = COALESCE(c.order_id, EXCLUDED.order_id),
           months     = COALESCE(c.months, EXCLUDED.months)
     WHERE c.applied_at IS NULL
       AND c.claimed_at < now() - interval '5 minutes';

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;

COMMENT ON FUNCTION public.claim_paypal_capture(TEXT, UUID, TEXT, INT) IS
  'Replay guard for prepaid term grants. TRUE = you own this capture, grant the term. FALSE = someone else has it. An unapplied claim older than 5 minutes can be taken over, so a grant that died mid-flight is recovered by PayPal''s next redelivery rather than lost. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.claim_paypal_capture(TEXT, UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_paypal_capture(TEXT, UUID, TEXT, INT) TO service_role;

-- ── 5. Close the claim out ───────────────────────────────────
--
-- Called after the membership has actually been written. This is what
-- makes the claim permanent rather than reclaimable, and it records what
-- the member ended up paid through so a purchase can be reconciled
-- against PayPal without touching auth.users.

CREATE OR REPLACE FUNCTION public.mark_paypal_capture_applied(
    p_capture_id   TEXT,
    p_paid_through TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_capture_id IS NULL OR btrim(p_capture_id) = '' THEN
        RETURN;
    END IF;

    UPDATE public.paypal_prepaid_captures
       SET applied_at   = COALESCE(applied_at, now()),
           paid_through = COALESCE(p_paid_through, paid_through)
     WHERE capture_id = btrim(p_capture_id);
END;
$$;

COMMENT ON FUNCTION public.mark_paypal_capture_applied(TEXT, TIMESTAMPTZ) IS
  'Marks a claimed capture as having actually become a membership, so it can no longer be reclaimed. applied_at never moves once set. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.mark_paypal_capture_applied(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_paypal_capture_applied(TEXT, TIMESTAMPTZ) TO service_role;

-- ── 6. Grant ledger ──────────────────────────────────────────
--
-- subscription_state.paid_through     reporting only; no new grants
-- paypal_prepaid_captures             replay guard; no client grants
-- record_paypal_term_state            service_role EXECUTE
-- claim_paypal_capture                service_role EXECUTE
-- mark_paypal_capture_applied         service_role EXECUTE
--
-- VERIFY AFTER PASTING (as the service role, from the SQL editor):
--
--   SELECT public.claim_paypal_capture('TEST-CAP-1');           -- t
--   SELECT public.claim_paypal_capture('TEST-CAP-1');           -- f
--   SELECT public.mark_paypal_capture_applied('TEST-CAP-1', now());
--   SELECT applied_at IS NOT NULL FROM public.paypal_prepaid_captures
--    WHERE capture_id = 'TEST-CAP-1';                           -- t
--   DELETE FROM public.paypal_prepaid_captures WHERE capture_id = 'TEST-CAP-1';
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'subscription_state' ORDER BY ordinal_position;
--
-- Then: npm run gen-types
