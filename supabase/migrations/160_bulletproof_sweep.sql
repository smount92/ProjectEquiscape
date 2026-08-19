-- ============================================================
-- 160: Bulletproofing sweep — RLS + RPC fixes from the 2026-08
-- adversarial audit (entry/judging, ledgers, visibility).
--
--  1. soft_delete_account works again (149's NULL-safe guard also
--     blocked the legitimate service-role caller — account deletion
--     has been broken for every user since 149).
--  2. Barred entrants can no longer un-scratch their own entries
--     via direct PostgREST (the "sticky scratch" is now sticky at
--     the row level).
--  3. Suspended/barred users can no longer vote; suspended staff
--     can no longer record placings.
--  4. Pre-publish results are no longer anon-readable: placings and
--     callbacks stay hidden until the class reveals or the show
--     finishes (live shows keep their real-time announcer board).
--  5. horse_titles respects horse visibility.
--  6. verify_qualification_card returns horse_name again (lost in
--     153's recreate — a buyer must see WHICH horse earned a card).
--  7. horse_images allows 'unlisted' (migration 150's missed table:
--     signed-in non-owners saw photoless unlisted passports).
-- ============================================================

-- ── 1. Account deletion (audit S1) ──
-- The service-role caller has auth.uid() = NULL; 149's IS DISTINCT
-- FROM guard therefore raised for the ONLY caller in the codebase
-- (settings.ts deleteAccount → admin client). Allow service_role
-- through; a signed-in user may still only delete themself.

CREATE OR REPLACE FUNCTION public.soft_delete_account(target_uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF (SELECT auth.role()) IS DISTINCT FROM 'service_role'
       AND (SELECT auth.uid()) IS DISTINCT FROM target_uid THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted] ' || substr(target_uid::text, 1, 8),
        bio = NULL, avatar_url = NULL, notification_prefs = NULL
    WHERE id = target_uid;

    UPDATE public.user_horses SET is_public = false, trade_status = 'Not for Sale', life_stage = 'orphaned' WHERE owner_id = target_uid;
    UPDATE public.messages SET content = '[Message deleted by user]' WHERE sender_id = target_uid;
    UPDATE public.horse_transfers SET status = 'cancelled' WHERE sender_id = target_uid AND status = 'pending';
    UPDATE public.commissions SET status = 'cancelled' WHERE (artist_id = target_uid OR client_id = target_uid) AND status NOT IN ('completed', 'delivered', 'cancelled');
    DELETE FROM public.group_memberships WHERE user_id = target_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_account(UUID) TO authenticated;

-- ── 2. Sticky scratch (audit C1) ──
-- The owner branch gains: not barred, not suspended, and NO
-- touching rows that are already scratched (scratched = history;
-- re-entering is a fresh INSERT which the 151 policy fully guards).

DROP POLICY IF EXISTS "Owner updates own entry while open, staff anytime" ON show_class_entries;
CREATE POLICY "Owner updates own entry while open, staff anytime"
  ON show_class_entries FOR UPDATE
  TO authenticated
  USING (
    (owner_id = (SELECT auth.uid())
      AND show_class_entries.status <> 'scratched'
      AND NOT is_caller_suspended()
      AND NOT EXISTS (
        SELECT 1 FROM show_barred_entrants b
        WHERE b.show_id = show_class_entries.show_id
          AND b.user_id = (SELECT auth.uid())
      )
      AND EXISTS (
        SELECT 1 FROM shows s
        WHERE s.id = show_class_entries.show_id
          AND s.status = 'entries_open'
      ))
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward'])
  )
  WITH CHECK (
    (
      owner_id = (SELECT auth.uid())
      AND NOT is_caller_suspended()
      AND NOT EXISTS (
        SELECT 1 FROM show_barred_entrants b
        WHERE b.show_id = show_class_entries.show_id
          AND b.user_id = (SELECT auth.uid())
      )
      AND EXISTS (
        SELECT 1 FROM shows s
        WHERE s.id = show_class_entries.show_id
          AND s.status = 'entries_open'
      )
      AND EXISTS (
        SELECT 1 FROM user_horses h
        WHERE h.id = show_class_entries.horse_id
          AND h.owner_id = (SELECT auth.uid())
      )
    )
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward'])
  );

-- ── 3a. Votes: suspended and barred users don't vote (audit S5) ──

DROP POLICY IF EXISTS "Authed users vote on judging community-vote shows" ON show_entry_votes;
CREATE POLICY "Authed users vote on judging community-vote shows"
  ON show_entry_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    voter_id = (SELECT auth.uid())
    AND entry_vote_open(entry_id)
    AND entry_owner_of(entry_id) <> (SELECT auth.uid())
    AND NOT is_caller_suspended()
    AND NOT EXISTS (
      SELECT 1 FROM show_barred_entrants b
      WHERE b.show_id = show_id_of_entry(entry_id)
        AND b.user_id = (SELECT auth.uid())
    )
  );

-- ── 3b. Placings: suspended staff don't record (audit S5) ──

DROP POLICY IF EXISTS "Show staff record placings" ON show_placings;
CREATE POLICY "Show staff record placings"
  ON show_placings FOR ALL
  TO authenticated
  USING (show_role_check(show_id_of_class(class_id),
                         ARRAY['host', 'co_host', 'steward', 'judge']))
  WITH CHECK (
    show_role_check(show_id_of_class(class_id),
                    ARRAY['host', 'co_host', 'steward', 'judge'])
    AND NOT is_caller_suspended()
  );

-- ── 4. Pre-publish results stay hidden (audit H3) ──
-- Public may read placings/callbacks only once they are announced:
--   - the show finished (completed/archived), or
--   - that CLASS revealed (v4 rolling reveal), or
--   - the show is a LIVE show mid-run (the announcer board is the
--     point of a live ring — results are called aloud as recorded).
-- Online judged shows no longer leak the slate (or the judge's
-- notes, or the champion picks) before the reveal.

CREATE OR REPLACE FUNCTION placings_announced(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM show_classes c
    JOIN show_sections sec ON sec.id = c.section_id
    JOIN show_divisions d ON d.id = sec.division_id
    JOIN shows s ON s.id = d.show_id
    WHERE c.id = p_class_id
      AND s.status <> 'draft'
      AND (
        s.status IN ('completed', 'archived')
        OR c.results_published_at IS NOT NULL
        OR (s.mode = 'live' AND s.status IN ('running', 'judging', 'results_review'))
      )
  );
$$;

DROP POLICY IF EXISTS "Public reads placings of visible shows" ON show_placings;
CREATE POLICY "Public reads placings of visible shows"
  ON show_placings FOR SELECT
  TO authenticated, anon
  USING (
    placings_announced(class_id)
    OR show_role_check(show_id_of_class(class_id),
                       ARRAY['host', 'co_host', 'steward', 'judge'])
  );

DROP POLICY IF EXISTS "Public reads callbacks of visible shows" ON show_callbacks;
CREATE POLICY "Public reads callbacks of visible shows"
  ON show_callbacks FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_callbacks.show_id
        AND s.status <> 'draft'
        AND (
          s.status IN ('completed', 'archived')
          OR (s.mode = 'live' AND s.status IN ('running', 'judging', 'results_review'))
        )
    )
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward', 'judge'])
  );

-- ── 5. Titles respect horse visibility (audit S6) ──
-- Same predicate family as get_public_horse_cards: world-readable
-- only while the horse is publicly visible; the owner always sees
-- their own horses' titles. (The grant itself is permanent either
-- way — visibility only gates who can READ it.)

DROP POLICY IF EXISTS "Titles are public record" ON horse_titles;
CREATE POLICY "Titles readable for visible horses"
  ON horse_titles FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM user_horses uh
      WHERE uh.id = horse_titles.horse_id
        AND uh.deleted_at IS NULL
        AND (
          uh.visibility IN ('public', 'unlisted')
          OR uh.owner_id = (SELECT auth.uid())
        )
    )
  );

-- ── 6. verify_qualification_card: horse_name restored (audit SEV-2) ──
-- 153's recreate dropped the column 120 added — "which horse is
-- this card for" is the whole point of checking a card before a
-- purchase. Return shape changes again, so DROP + CREATE.

DROP FUNCTION IF EXISTS verify_qualification_card(TEXT);

CREATE FUNCTION verify_qualification_card(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  status TEXT,
  earned_place INTEGER,
  show_year INTEGER,
  show_title TEXT,
  class_name TEXT,
  issued_at TIMESTAMPTZ,
  class_entry_count INTEGER,
  class_exhibitor_count INTEGER,
  is_stakes BOOLEAN,
  horse_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT qc.id, qc.status, qc.earned_place, qc.show_year,
         s.title, c.name, qc.issued_at,
         qc.class_entry_count, qc.class_exhibitor_count, qc.is_stakes,
         -- The earning horse's name, shown only while the horse is
         -- publicly visible (mirrors the horse's own passport rules).
         CASE
           WHEN uh.deleted_at IS NULL AND uh.visibility IN ('public', 'unlisted')
             THEN uh.custom_name
           ELSE NULL
         END
  FROM qualification_cards qc
  JOIN shows s ON s.id = qc.show_id
  JOIN show_classes c ON c.id = qc.class_id
  LEFT JOIN user_horses uh ON uh.id = qc.horse_id
  WHERE qc.id = p_code;
$$;

-- ── 7. horse_images: the table migration 150 missed (audit S3) ──
-- user_horses opened to visibility IN ('public','unlisted'); the
-- photos policy still demanded is_public = true, so signed-in
-- non-owners saw photoless unlisted passports (anon was fine via
-- the DEFINER passport RPC — the asymmetry was the tell).

DROP POLICY IF EXISTS "horse_images_select" ON horse_images;
CREATE POLICY "horse_images_select"
  ON horse_images FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM user_horses uh
      WHERE uh.id = horse_images.horse_id
        AND (
          -- Owner arm unchanged from 112: owners keep seeing their
          -- own photos, soft-deleted horses included.
          uh.owner_id = (SELECT auth.uid())
          OR (uh.visibility IN ('public', 'unlisted') AND uh.deleted_at IS NULL)
        )
    )
  );
