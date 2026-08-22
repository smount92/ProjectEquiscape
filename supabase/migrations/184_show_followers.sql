-- ============================================================
-- 184: Follow a show
--
-- Until now the ONLY relationship a member could have with a show was
-- entering a horse. Everyone still deciding — the people a show most
-- needs — had no way to say "tell me what happens here", so the show
-- lifecycle spoke only to people who had already committed. The class
-- badges have been saying "1 more exhibitor mints cards" to a room
-- with nobody subscribed to hear it.
--
-- show_followers is that subscription, and deliberately the lightest
-- possible one: no host approval, no state beyond existence, one row
-- per (show, member). Entering a horse implicitly creates the row too
-- (an entrant obviously wants the updates) — the notification fan-outs
-- union followers with entrants and dedupe, so nobody is told twice.
--
-- PRIVACY IS THE WHOLE DESIGN HERE. A follow is a statement of
-- interest, and "who is watching which show" is exactly the kind of
-- social graph that gets read as gossip. So:
--   · SELECT is scoped to your OWN rows. There is no policy under
--     which one member can enumerate another member's follows, and
--     no policy under which anyone reads a show's follower LIST.
--   · The host gets a COUNT and only a count, through the SECURITY
--     DEFINER function below — a soft signal of interest for someone
--     deciding whether to open entries, with no identities attached.
--   · The fan-outs read the list with the SERVICE ROLE (RLS bypassed)
--     inside after() blocks. Notifications go out; the list never
--     reaches a client payload.
--
-- Code feature-detects this table (src/lib/shows/followSupport.ts):
-- before this migration is pasted the follow button does not render
-- and every fan-out treats the follower set as empty, so the site
-- behaves EXACTLY as it does today.
-- ============================================================

CREATE TABLE IF NOT EXISTS show_followers (
    show_id    UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- The pair IS the identity: following twice is following once.
    PRIMARY KEY (show_id, user_id)
);

-- show_id: the fan-out's "who follows this show" (service role).
-- user_id: "which shows do I follow" — the member's own read.
CREATE INDEX IF NOT EXISTS idx_show_followers_show ON show_followers (show_id);
CREATE INDEX IF NOT EXISTS idx_show_followers_user ON show_followers (user_id);

ALTER TABLE show_followers ENABLE ROW LEVEL SECURITY;

-- ── Your own rows, and nothing else ──────────────────────────
-- Note there is no "hosts can read their show's followers" policy,
-- by design. The host's count comes from show_follower_count() below.
DROP POLICY IF EXISTS "Members read their own show follows" ON show_followers;
CREATE POLICY "Members read their own show follows"
    ON show_followers FOR SELECT
    USING (user_id = auth.uid());

-- Follow: only ever yourself, and only a show that actually exists
-- and is not still a private draft. (Draft ids are guessable UUIDs;
-- without the status check a follow row could be planted on a show
-- its host has not published, and would then fire notifications the
-- moment it went live.)
DROP POLICY IF EXISTS "Members follow shows as themselves" ON show_followers;
CREATE POLICY "Members follow shows as themselves"
    ON show_followers FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM shows s
            WHERE s.id = show_id
              AND s.status <> 'draft'
        )
    );

-- Unfollow: only your own row. No UPDATE policy exists — there is
-- nothing in a follow to edit, so the row is create/delete only.
DROP POLICY IF EXISTS "Members unfollow shows as themselves" ON show_followers;
CREATE POLICY "Members unfollow shows as themselves"
    ON show_followers FOR DELETE
    USING (user_id = auth.uid());

-- ── The host's soft signal: a COUNT, never a list ────────────
-- SECURITY DEFINER because the SELECT policy above (correctly) hides
-- other members' rows from everyone including the host. This function
-- is the one narrow hole in that, and it returns a scalar: managers of
-- the show get the number of followers, everybody else gets 0. It can
-- never leak an identity because it never selects one.
--
-- SET search_path = public is mandatory on every DEFINER function here
-- (a caller-controlled search_path on a DEFINER function is a
-- privilege-escalation hole).
CREATE OR REPLACE FUNCTION show_follower_count(p_show_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_count INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RETURN 0;
    END IF;

    -- Managers only. Stewards and judges run classes; interest in the
    -- show is the host's business decision, so it stays with the
    -- host/co-host pair that MANAGER_ROLES uses everywhere else.
    IF NOT EXISTS (
        SELECT 1 FROM show_staff
        WHERE show_id = p_show_id
          AND user_id = v_uid
          AND role IN ('host', 'co_host')
    ) THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM show_followers
    WHERE show_id = p_show_id;

    RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION show_follower_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION show_follower_count(UUID) TO authenticated;
