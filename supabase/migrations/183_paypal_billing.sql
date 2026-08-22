-- ============================================================
-- 183: PayPal billing — reporting mirror + webhook replay ledger
-- ============================================================
--
-- WHAT THIS IS FOR. MHH now sells subscriptions through TWO providers.
-- Stripe has always been one; PayPal is the second, and it exists because
-- Stripe will only sell PayPal as a payment method to businesses
-- registered in the EU/UK/CH/NO/LI — this is a US business, so
-- "just turn PayPal on in Stripe" is not purchasable at any price. Members
-- here routinely hold PayPal balances from selling and trading horses and
-- want to spend them.
--
-- WHAT THIS IS NOT FOR. Access. The tier of record is, exactly as before,
-- auth.users.app_metadata.tier — every gate on the site reads it and
-- nothing else, and the PayPal webhook writes it the same way the Stripe
-- webhook does. Everything below is reporting and safety plumbing.
--
-- ── NOTHING HERE IS REQUIRED FOR PAYPAL TO WORK ───────────────────
--
-- The application feature-detects all of it (src/lib/paypal/entitlement.ts
-- and the webhook's claimEvent). With 183 unapplied:
--   · the mirror falls back to record_subscription_state from 176, so MRR
--     and subscriber counts stay correct from day one — a PayPal row just
--     has no provider attribution and no PayPal id on it;
--   · replay protection falls back to the handlers' own idempotency, which
--     is real: every one writes absolute values, never increments.
-- Pasting 183 upgrades both from "correct" to "correct and legible".
--
-- SAFE TO PASTE ON A LIVE DATABASE. Every statement is additive and
-- idempotent. No existing column, function, policy or grant is altered or
-- dropped, and in particular record_subscription_state — the Stripe
-- webhook's only writer — is left exactly as 176 defined it.

-- ── 1. Provider attribution on the mirror ────────────────────
--
-- Existing rows are all Stripe's, hence the default. The column is
-- descriptive only: no code branches on it, it gates nothing, and a wrong
-- value costs a slightly wrong pie chart and nothing else.

ALTER TABLE public.subscription_state
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'stripe';

ALTER TABLE public.subscription_state
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_state_provider_check'
  ) THEN
    ALTER TABLE public.subscription_state
      ADD CONSTRAINT subscription_state_provider_check
      CHECK (provider IN ('stripe', 'paypal'));
  END IF;
END $$;

COMMENT ON COLUMN public.subscription_state.provider IS
  'stripe | paypal — which provider most recently wrote this row. Reporting only; it gates nothing. KNOWN IMPRECISION: record_subscription_state (176, the Stripe writer) is deliberately NOT modified by this migration, so a member who cancels PayPal and later subscribes by card leaves ''paypal'' behind on their row. Correcting that would mean editing the live Stripe webhook''s only mirror function to gain a more accurate pie chart, which is not a trade worth making. If it ever matters, add `provider = ''stripe''` to that function''s INSERT and ON CONFLICT SET lists.';
COMMENT ON COLUMN public.subscription_state.paypal_subscription_id IS
  'The PayPal subscription ("I-...") behind this row, for reconciliation against the PayPal dashboard. Not identity — meaningless off PayPal, exactly like the stripe_* columns beside it.';

-- ── 2. The PayPal webhook's mirror write ─────────────────────
--
-- A sibling of record_subscription_state rather than a parameter added to
-- it, so that the Stripe path's only writer keeps the exact signature and
-- behaviour it has had since 176. Same contract as that function:
-- idempotent, preserves started_at across cancel-and-resubscribe, and
-- treats a NULL argument as "leave what you have" so a thin event cannot
-- erase what a fat one recorded.

CREATE OR REPLACE FUNCTION public.record_paypal_subscription_state(
    p_user_id                UUID,
    p_tier                   TEXT,
    p_status                 TEXT,
    p_current_period_end     TIMESTAMPTZ DEFAULT NULL,
    p_paypal_subscription_id TEXT DEFAULT NULL
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
    -- Nothing to record, so record nothing.
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN
        RETURN;
    END IF;

    INSERT INTO public.subscription_state AS s (
        user_id, tier, status, current_period_end,
        provider, paypal_subscription_id, started_at, updated_at
    )
    VALUES (
        p_user_id, p_tier, p_status, p_current_period_end,
        'paypal', p_paypal_subscription_id, now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE
       SET tier                   = EXCLUDED.tier,
           status                 = EXCLUDED.status,
           current_period_end     = COALESCE(EXCLUDED.current_period_end, s.current_period_end),
           provider               = 'paypal',
           paypal_subscription_id = COALESCE(EXCLUDED.paypal_subscription_id, s.paypal_subscription_id),
           -- Never moves. The first paid date is the cohort — and it
           -- survives a member switching provider, which is the whole
           -- point of keeping it out of EXCLUDED.
           started_at             = s.started_at,
           updated_at             = now();
END;
$$;

COMMENT ON FUNCTION public.record_paypal_subscription_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) IS
  'The PayPal webhook''s mirror write. Called ALONGSIDE — never instead of — the app_metadata.tier write the site''s gates read, exactly as record_subscription_state is on the Stripe side. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.record_paypal_subscription_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_paypal_subscription_state(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO service_role;

-- ── 3. Webhook replay ledger ─────────────────────────────────
--
-- PayPal redelivers an event until it gets a 2xx, and a redelivery carries
-- the SAME event id. The handlers are already idempotent by construction,
-- so this is a second belt rather than the only one — but it also turns a
-- replay into a single cheap INSERT instead of a round-trip to PayPal plus
-- two auth-admin writes.

CREATE TABLE IF NOT EXISTS public.paypal_webhook_events (
  event_id    TEXT PRIMARY KEY,
  event_type  TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.paypal_webhook_events IS
  'Every PayPal webhook event id we have already acted on. Purely a replay guard: it holds no member data, no amounts and no ids beyond PayPal''s own event id. Safe to prune — see the retention note in this migration.';

CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_received
  ON public.paypal_webhook_events (received_at);

ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policy, deliberately — same stance as subscription_state (176) and
-- object_view_daily (175). service_role bypasses RLS; every other role
-- sees zero rows and can write nothing.
REVOKE ALL ON TABLE public.paypal_webhook_events FROM anon, authenticated;

-- RETENTION. PayPal stops retrying a delivery after ~3 days, so rows
-- older than a month are dead weight. There is no cron for this and it
-- does not need one at MHH's volume; when the table gets annoying, run:
--
--   DELETE FROM public.paypal_webhook_events
--    WHERE received_at < now() - interval '90 days';

-- ── 4. Claim an event id ─────────────────────────────────────
--
-- Returns TRUE for "you are the first to see this, go ahead" and FALSE for
-- "already handled, stop". The INSERT ... ON CONFLICT DO NOTHING makes the
-- check and the claim one atomic statement, so two concurrent deliveries
-- of the same event cannot both be told to proceed.
--
-- A null or empty id returns TRUE: an event we cannot identify must still
-- be processed, because the handlers are idempotent and dropping a real
-- activation is far worse than repeating one.

CREATE OR REPLACE FUNCTION public.claim_paypal_webhook_event(
    p_event_id   TEXT,
    p_event_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inserted INT;
BEGIN
    IF p_event_id IS NULL OR btrim(p_event_id) = '' THEN
        RETURN TRUE;
    END IF;

    INSERT INTO public.paypal_webhook_events (event_id, event_type)
    VALUES (p_event_id, p_event_type)
    ON CONFLICT (event_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted > 0;
END;
$$;

COMMENT ON FUNCTION public.claim_paypal_webhook_event(TEXT, TEXT) IS
  'Replay guard for the PayPal webhook. TRUE = first delivery, proceed. FALSE = already handled, skip. Atomic, so concurrent redeliveries cannot both proceed. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.claim_paypal_webhook_event(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_paypal_webhook_event(TEXT, TEXT) TO service_role;

-- ── 5. Grant ledger ──────────────────────────────────────────
--
-- subscription_state.provider                reporting only; no grants
-- subscription_state.paypal_subscription_id  reporting only; no grants
-- paypal_webhook_events                      replay guard; no client grants
-- record_paypal_subscription_state           service_role EXECUTE
-- claim_paypal_webhook_event                 service_role EXECUTE
--
-- VERIFY AFTER PASTING (as the service role, from the SQL editor):
--
--   SELECT public.claim_paypal_webhook_event('WH-test-1');  -- t
--   SELECT public.claim_paypal_webhook_event('WH-test-1');  -- f
--   DELETE FROM public.paypal_webhook_events WHERE event_id = 'WH-test-1';
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'subscription_state' ORDER BY ordinal_position;
