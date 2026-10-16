-- ============================================================
-- 238: Stripe notices go out once
--
-- Release 2 (2026-10), ticket MHH-023 (review fix).
--
-- Stripe can deliver the same event more than once, and retries a delivery
-- that failed for up to three days. The plan changes are idempotent, but
-- the notices to the member and the owner (payment failed, refund,
-- chargeback) are not: each delivery would ring the bell again. The webhook
-- now records an event's id before it sends that event's notices, and
-- skips them when the id is already recorded.
--
-- Written only by the server (service role); no member can read or write
-- it, so there are no policies. Safe to paste twice.
--
-- Retention: Stripe stops retrying after three days. When the table gets
-- annoying, run:
--   DELETE FROM public.stripe_notice_events WHERE sent_at < now() - interval '90 days';
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_notice_events (
  event_id   TEXT PRIMARY KEY,
  event_type TEXT,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_notice_events ENABLE ROW LEVEL SECURITY;
