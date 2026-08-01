-- ══════════════════════════════════════════════════════════════
-- Migration 142: Supporter tier (brass plaque + supporters ledger)
-- ══════════════════════════════════════════════════════════════
-- NUMBERING NOTE: 139 was the last migration on disk when this was written.
-- 140–141 are intentionally left free for the other wave agent's migrations;
-- if we collide anyway, the integration merger renumbers.
--
-- Supporter is an honest "keep the lights on" annual contribution — it is
-- deliberately NOT a tier in app_metadata (orthogonal to free/pro/studio) and
-- it gates NOTHING. State lives on public.users so the brass plaque and the
-- About-page ledger can read it:
--   is_supporter               — set/cleared ONLY by the Stripe webhook
--                                (service role); guarded from client writes
--                                by trigger below.
--   supporter_since            — first time they supported (kept across
--                                renewals; webhook-managed, same guard).
--   show_in_supporters_ledger  — user preference (opt-IN, default false).
--                                User-writable like any settings column.
--
-- Additive + idempotent. After apply: npm run gen-types (columns + RPC were
-- hand-added to database.generated.ts in the same PR; regen keeps it honest).
-- ══════════════════════════════════════════════════════════════

-- ── Columns ──
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_supporter BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS supporter_since TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS show_in_supporters_ledger BOOLEAN NOT NULL DEFAULT false;

-- Ledger + "all supporters" lookups; tiny partial index, mirrors 062's style.
CREATE INDEX IF NOT EXISTS idx_users_supporters
    ON public.users (supporter_since)
    WHERE is_supporter = true;

-- ── Column-level SELECT grants ──
-- Migration 133 revoked the table-level SELECT and re-granted per column, so
-- new columns are invisible to clients until granted. All three are safe to
-- read: the plaque is public recognition by design, and ledger opt-in state
-- carries no more information than the plaque + the public ledger already do.
-- (anon grant is inert today — RLS has no anon SELECT policy on users — but
-- mirrors 133 so a future anon policy doesn't silently hide the plaque.)
GRANT SELECT (is_supporter, supporter_since, show_in_supporters_ledger)
    ON public.users TO anon, authenticated;

-- ── Guard: clients must NOT be able to write supporter payment state ──
-- The users table has RLS "update own row" + a TABLE-level UPDATE/INSERT grant
-- (all columns), so without a guard any signed-in user could simply
-- `UPDATE users SET is_supporter = true WHERE id = auth.uid()` via PostgREST.
-- Column-level REVOKE doesn't work against a table-level grant (see 133's
-- notes), and re-granting UPDATE per column would have to enumerate every
-- settings column — too much blast radius for this change. A BEFORE trigger
-- scoped to exactly these two columns is additive and collision-free.
--
-- current_user is the PostgREST-mapped DB role: 'anon'/'authenticated' for
-- client API calls, 'service_role' for the admin client (Stripe webhook),
-- 'postgres' for migrations/psql. The function is intentionally SECURITY
-- INVOKER so current_user reflects the caller.
--
-- Client writes are silently reverted (not raised) so a legitimate broad
-- settings update that happens to include the whole row never 500s — the
-- protected columns just keep their server-managed values.
CREATE OR REPLACE FUNCTION public.users_guard_supporter_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.is_supporter := false;
            NEW.supporter_since := NULL;
        ELSE
            NEW.is_supporter := OLD.is_supporter;
            NEW.supporter_since := OLD.supporter_since;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_guard_supporter_cols ON public.users;
CREATE TRIGGER trg_users_guard_supporter_cols
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.users_guard_supporter_cols();

-- ── Supporters' Ledger RPC (About page, anon-safe) ──
-- DEFINER so anon visitors can read it (users has no anon SELECT policy).
-- Returns alias + since ONLY for supporters who opted in, and only for
-- visible accounts (mirrors AnonProfile's account_status check + hides test
-- accounts per 086). Never returns ids, emails, or non-opted-in supporters.
CREATE OR REPLACE FUNCTION public.get_supporters_ledger()
RETURNS TABLE (alias_name TEXT, supporter_since TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
    SELECT u.alias_name, u.supporter_since
    FROM public.users u
    WHERE u.is_supporter = true
      AND u.show_in_supporters_ledger = true
      AND u.deleted_at IS NULL
      AND u.account_status <> 'deleted'
      AND u.is_test_account = false
    ORDER BY u.supporter_since ASC NULLS LAST, u.alias_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_supporters_ledger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supporters_ledger() TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 142 Complete — supporter columns, write guard,
--    get_supporters_ledger(). After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
