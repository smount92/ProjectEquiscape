-- ============================================================
-- 237: scheduled jobs report a heartbeat
--
-- Release 2 (2026-10), ticket MHH-029 (gap G11).
--
-- Four jobs run on Vercel's clock (vercel.json): market prices daily, show
-- status hourly, the Stablemaster monthly, eBay prices every four hours. A
-- job that failed went to Sentry; a job that silently stopped running was
-- invisible. Each run now writes when it ran and whether it worked, and
-- Admin › Ops shows any job that is late or failing.
--
-- Written only by the server (service role); no member can read or write
-- it, so there are no policies. Safe to paste twice.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cron_heartbeats (
  job            TEXT PRIMARY KEY,
  last_run_at    TIMESTAMPTZ,
  last_ok_at     TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  last_error     TEXT
);

ALTER TABLE public.cron_heartbeats ENABLE ROW LEVEL SECURITY;
