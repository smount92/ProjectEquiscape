-- ══════════════════════════════════════════════════════════════
-- Migration 143: External shows — the calendar of record
-- ══════════════════════════════════════════════════════════════
-- NUMBERING NOTE: 142 was the last migration on disk when this was
-- written. Another Wave 3 agent may take a number concurrently — if
-- we collide, the integration merger renumbers at merge (same
-- convention as 142's header).
--
-- /calendar lists EVERY upcoming model-horse show in one place:
-- MHH-hosted shows (the `shows` table) merged with community-
-- submitted EXTERNAL shows (OMHPS, MEPSA, Facebook groups, club
-- sites, live halls). External listings are curated: any member can
-- submit one, an admin approves it, only then does it appear.
--
-- Access model:
--   * INSERT — any authenticated member, but ALWAYS as their own
--     pending row: RLS pins submitted_by to auth.uid() and status
--     to 'pending', and the BEFORE trigger below force-resets the
--     moderation columns for client roles even if a future policy
--     loosens. A submitter can never self-approve.
--   * SELECT — approved rows are world-readable (anon included):
--     the row carries no user data beyond what the submitter typed
--     for public display; submitted_by is NOT exposed publicly
--     because the /calendar read selects only the display columns
--     (and the submitter-identity column is never rendered).
--     Submitters additionally read their OWN rows (any status) so
--     a future "my submissions" surface needs no new policy.
--   * UPDATE/DELETE — no client policy AT ALL. Moderation
--     (approve / reject) happens through the service-role client
--     behind requireAdmin() in src/app/actions/external-shows.ts.
--
-- Additive + idempotent. App code feature-detects this table and
-- hides the external layer until the owner applies the migration.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.external_shows (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title            TEXT        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
    -- Outbound link to the show's home (event page, group post,
    -- entry form). http/https ONLY — belt here, braces in zod
    -- (schemas reject javascript:/data:/ftp: before it ever
    -- reaches the DB), and the page renders it with
    -- rel="noopener nofollow".
    url              TEXT        NOT NULL CHECK (
                         char_length(url) <= 2000
                         AND url ~* '^https?://'
                     ),
    venue_type       TEXT        NOT NULL CHECK (venue_type IN ('online_photo', 'live', 'mail_in')),
    host_name        TEXT        NOT NULL CHECK (char_length(host_name) BETWEEN 2 AND 80),
    platform         TEXT        NOT NULL CHECK (platform IN ('facebook', 'omhps', 'mepsa', 'website', 'other')),
    starts_on        DATE        NOT NULL,
    entries_close_on DATE        CHECK (entries_close_on IS NULL OR entries_close_on <= starts_on),
    -- Live shows: where on earth the hall is. Free text ("Lebanon, TN").
    location         TEXT        CHECK (location IS NULL OR char_length(location) <= 160),
    description      TEXT        NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
    submitted_by     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    -- Optional moderator note (shown to the submitter on rejection).
    review_note      TEXT        CHECK (review_note IS NULL OR char_length(review_note) <= 500),
    reviewed_by      UUID        REFERENCES public.users(id),
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The calendar read: approved rows ordered by date. Partial index
-- keeps it tiny (pending/rejected rows never serve public traffic).
CREATE INDEX IF NOT EXISTS idx_external_shows_approved_date
    ON public.external_shows (starts_on)
    WHERE status = 'approved';

-- The admin queue + "my submissions" lookups.
CREATE INDEX IF NOT EXISTS idx_external_shows_status ON public.external_shows (status, created_at);
CREATE INDEX IF NOT EXISTS idx_external_shows_submitter ON public.external_shows (submitted_by);

-- ── RLS ──

ALTER TABLE public.external_shows ENABLE ROW LEVEL SECURITY;

-- World-readable ONCE APPROVED (anon serves the public /calendar
-- SSR). No user data leaks: the public page selects display
-- columns only, and approved content itself was written for
-- public display. Submitter identity is not rendered anywhere
-- public.
CREATE POLICY "Anyone reads approved external shows"
    ON public.external_shows FOR SELECT
    TO anon, authenticated
    USING (status = 'approved');

-- Submitters see their own rows in any status.
CREATE POLICY "Submitter reads own external shows"
    ON public.external_shows FOR SELECT
    TO authenticated
    USING (submitted_by = (SELECT auth.uid()));

-- Any member may submit — but only as themself, and only pending.
-- (The trigger below re-forces 'pending' as defense in depth.)
CREATE POLICY "Members submit external shows as pending"
    ON public.external_shows FOR INSERT
    TO authenticated
    WITH CHECK (
        submitted_by = (SELECT auth.uid())
        AND status = 'pending'
    );

-- NO UPDATE / DELETE policies for client roles: moderation is
-- service-role-only (requireAdmin() in the action layer). RLS
-- default-denies what has no policy.

-- ── Guard trigger: clients can never write moderation state ──
-- current_user is the PostgREST-mapped DB role ('anon'/
-- 'authenticated' for client API calls, 'service_role' for the
-- admin client, 'postgres' for migrations) — same pattern as
-- migration 142's supporter-column guard. Client writes to the
-- moderation columns are silently reset, never raised, so a
-- legitimate insert that omits them still succeeds.
CREATE OR REPLACE FUNCTION public.external_shows_guard_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.status := 'pending';
            NEW.review_note := NULL;
            NEW.reviewed_by := NULL;
            NEW.reviewed_at := NULL;
        ELSE
            NEW.status := OLD.status;
            NEW.review_note := OLD.review_note;
            NEW.reviewed_by := OLD.reviewed_by;
            NEW.reviewed_at := OLD.reviewed_at;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_external_shows_guard_moderation ON public.external_shows;
CREATE TRIGGER trg_external_shows_guard_moderation
    BEFORE INSERT OR UPDATE ON public.external_shows
    FOR EACH ROW
    EXECUTE FUNCTION public.external_shows_guard_moderation();

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 143 Complete — external_shows table, approved-only
--    public reads, pending-only member inserts, moderation-column
--    guard trigger. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
