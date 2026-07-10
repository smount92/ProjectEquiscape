-- ============================================================
-- Migration 119: Shows Domain — Online judging (Phase E1)
-- (companion to 117_shows_domain.sql / 118_shows_domain_rls.sql)
-- ============================================================
-- Three additions for the online-show experience:
--   1. shows.blind_browsing — the digital leg-tag convention:
--      while a show is being judged, the public entry gallery
--      shows photos + horse names but hides owner identities
--      until results publish. Host-toggleable, default ON.
--   2. show_entry_votes — community voting (LOCKED decision,
--      owner 2026-07-09: community voting kept as a judging
--      option). One vote per user per entry, never your own
--      entry, only while the show is judging. Vote COUNTS are
--      world-readable on public shows — live counts are the fun.
--   3. A judge UPDATE policy on show_classes — 118 gave stewards
--      day-of status flips but not judges; the online judging
--      queue needs the judge to mark a class 'placed' when they
--      finish it. Structural edits stay gated in the actions
--      layer exactly as they are for stewards.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. Blind browsing toggle
-- ══════════════════════════════════════════════════════════════

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS blind_browsing BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN shows.blind_browsing IS
  'Blind entry gallery during judging: owner identities are hidden from the public gallery until results publish (or until the host turns this off). Default ON — the digital leg-tag convention.';

-- ══════════════════════════════════════════════════════════════
-- 2. show_entry_votes — community voting
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS show_entry_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES show_class_entries(id) ON DELETE CASCADE,
  voter_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One vote per user per entry. The unique index's leading
  -- column also serves the hot per-entry count lookups, so no
  -- separate entry_id index is needed.
  UNIQUE (entry_id, voter_id)
);

-- "Everything I voted for" lookups (un-vote UI, dedupe checks).
CREATE INDEX IF NOT EXISTS idx_show_entry_votes_voter
  ON show_entry_votes (voter_id);

-- No consistency trigger needed: entry_id's FK is the only link
-- (votes carry no denormalized show_id), and CASCADE cleans up
-- with the entry.

-- ── Helpers (118 idiom: SECURITY DEFINER so policies never
--    recurse into other tables' RLS) ──

-- Entry → show lookup for the votes policies.
CREATE OR REPLACE FUNCTION show_id_of_entry(p_entry_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT e.show_id
  FROM show_class_entries e
  WHERE e.id = p_entry_id;
$$;

-- Is voting open on this entry? The entry must be LIVE (scratched
-- entries are history, not candidates) and its show must be an
-- actively-judging community-vote show.
CREATE OR REPLACE FUNCTION entry_vote_open(p_entry_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM show_class_entries e
    JOIN shows s ON s.id = e.show_id
    WHERE e.id = p_entry_id
      AND e.status <> 'scratched'
      AND s.status = 'judging'
      AND s.judging = 'community_vote'
  );
$$;

-- Who owns this entry? Used to refuse self-votes at the row level.
CREATE OR REPLACE FUNCTION entry_owner_of(p_entry_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT e.owner_id
  FROM show_class_entries e
  WHERE e.id = p_entry_id;
$$;

ALTER TABLE show_entry_votes ENABLE ROW LEVEL SECURITY;

-- Vote counts are public on public shows — the live tally IS the
-- spectator sport. Votes can only ever exist on shows that reached
-- 'judging' (never drafts), but show_is_public keeps the gate
-- honest anyway.
CREATE POLICY "Public reads votes of visible shows"
  ON show_entry_votes FOR SELECT
  TO authenticated, anon
  USING (show_is_public(show_id_of_entry(entry_id)));

-- Cast: only as yourself, only while the entry's show is an
-- actively-judging community-vote show, and NEVER for your own
-- entry (the digital equivalent of not clapping for yourself).
CREATE POLICY "Authed users vote on judging community-vote shows"
  ON show_entry_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    voter_id = (SELECT auth.uid())
    AND entry_vote_open(entry_id)
    AND entry_owner_of(entry_id) <> (SELECT auth.uid())
  );

-- Un-vote: your own vote, while voting is still open. After the
-- show leaves 'judging' the tally is frozen — results derive
-- from it.
CREATE POLICY "Voters remove their own vote while judging"
  ON show_entry_votes FOR DELETE
  TO authenticated
  USING (
    voter_id = (SELECT auth.uid())
    AND entry_vote_open(entry_id)
  );

-- No UPDATE policy: a vote has nothing to update — it exists or
-- it doesn't.

-- ══════════════════════════════════════════════════════════════
-- 3. Judges flip class status
-- 118 lets stewards UPDATE show_classes for day-of status flips;
-- the online judging queue needs the same for judges (mark a
-- class 'placed' when its placings are recorded). Structural
-- edits remain refused in the actions layer for both roles —
-- this mirrors the steward arrangement exactly.
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "Judges update class status"
  ON show_classes FOR UPDATE
  TO authenticated
  USING (show_role_check(show_id_of_section(section_id), ARRAY['judge']))
  WITH CHECK (show_role_check(show_id_of_section(section_id), ARRAY['judge']));

-- ============================================================
-- ✅ Migration 119 Complete
-- Added: shows.blind_browsing (default TRUE);
--        show_entry_votes + RLS (public counts, authed voting on
--        judging community-vote shows, no self-votes, un-vote
--        while judging);
--        helpers show_id_of_entry / entry_vote_open /
--        entry_owner_of;
--        judge UPDATE policy on show_classes.
-- ============================================================
