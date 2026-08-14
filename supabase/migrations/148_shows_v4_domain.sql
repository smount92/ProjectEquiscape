-- ============================================================
-- 148 — SHOWS V4 DOMAIN: safety-native showing + the class room
--
-- The v4 rebuild's schema delta. Four themes:
--   A. Safety as domain concepts (sloptrough class of problem):
--      per-show barred entrants, site-wide suspension, and
--      DB-enforced entry rules (photo ownership, deadline,
--      public horse) — previously action-layer only, bypassable
--      with the anon key from devtools.
--   B. The class is the room: per-class result reveals
--      (results_published_at) so judged shows publish rolling,
--      class by class, instead of one dump.
--   C. Critique as a first-class artifact: per-ENTRY judge
--      feedback (model + photo separated), not per-placing —
--      MEPSA's novice tradition; unplaced entries can receive
--      critiques too.
--   D. Documentation (the charter's "digital show binder"):
--      reusable breed/performance dossiers that attach to
--      entries and travel with the horse across shows.
-- Plus: card void metadata (the status machine in
-- src/lib/shows/cards.ts already models void; the actions layer
-- gains voidCard alongside this).
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- A1. Site-wide suspension
-- Enforcement is two-layer: requireAuth() throws on the
-- app_metadata flag (no extra query — set via auth admin API by
-- the suspend action), and this column backs RLS checks + the
-- admin list. Both are set together by suspendUser().
-- ══════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- ══════════════════════════════════════════════════════════════
-- A2. Per-show barred entrants ("sticky scratch")
-- A staff scratch can bar the entrant from re-entering THIS show.
-- Checked by the entries INSERT policy below — the whack-a-mole
-- loop (scratch → re-enter in seconds) ends here.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS show_barred_entrants (
  show_id     UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  barred_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (show_id, user_id)
);

ALTER TABLE show_barred_entrants ENABLE ROW LEVEL SECURITY;

-- Staff manage the bar list; the barred user can see their own row
-- (the entry form tells them honestly instead of a generic error).
CREATE POLICY "Staff read bars, barred user reads own"
  ON show_barred_entrants FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward'])
  );

CREATE POLICY "Host and co-host bar entrants"
  ON show_barred_entrants FOR INSERT
  TO authenticated
  WITH CHECK (
    barred_by = (SELECT auth.uid())
    AND show_role_check(show_id, ARRAY['host', 'co_host'])
  );

CREATE POLICY "Host and co-host lift bars"
  ON show_barred_entrants FOR DELETE
  TO authenticated
  USING (show_role_check(show_id, ARRAY['host', 'co_host']));

-- ══════════════════════════════════════════════════════════════
-- A3. Entry INSERT policy — recreated with the safety checks:
--   + entrant is not barred from this show
--   + entrant is not suspended
--   + entry deadline has not passed (closes the up-to-59-minute
--     cron gap; previously only checked in the actions layer)
-- Existing conditions (owner, show open, horse ownership) kept
-- verbatim from 118.
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Owner enters own horse while entries open" ON show_class_entries;

CREATE POLICY "Owner enters own horse while entries open"
  ON show_class_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_class_entries.show_id
        AND s.status = 'entries_open'
        AND (s.entries_close_at IS NULL OR s.entries_close_at >= now())
    )
    AND EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = show_class_entries.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM show_barred_entrants b
      WHERE b.show_id = show_class_entries.show_id
        AND b.user_id = (SELECT auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.is_suspended
    )
  );

-- ══════════════════════════════════════════════════════════════
-- A4. Entry domain trigger — the rules RLS can't express cleanly:
--   * the judged photo must belong to the entered horse (the FK
--     alone accepted ANY horse_images row — anyone's photo)
--   * the horse must be public and not soft-deleted at entry time
-- BEFORE INSERT plus photo-swap UPDATEs. Staff/system updates
-- (scratch, renumber) don't touch photo_id and pass untouched.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_entry_domain_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.photo_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.photo_id IS DISTINCT FROM OLD.photo_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.horse_images i
      WHERE i.id = NEW.photo_id AND i.horse_id = NEW.horse_id
    ) THEN
      RAISE EXCEPTION 'Entry photo must belong to the entered horse';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_horses h
      WHERE h.id = NEW.horse_id
        AND h.is_public = true
        AND h.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Horse must be public and not deleted to enter a show';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_show_class_entries_domain ON show_class_entries;
CREATE TRIGGER trg_show_class_entries_domain
  BEFORE INSERT OR UPDATE ON show_class_entries
  FOR EACH ROW EXECUTE FUNCTION check_entry_domain_rules();

-- ══════════════════════════════════════════════════════════════
-- B. Per-class result reveal
-- NULL = results not yet public for this class. The judge
-- finishes a class → host (or auto, on record) publishes it →
-- spectators see that class's ribbon rail while the next class
-- is still being judged. Show-level results_review/completed
-- states are unchanged; a show-level publish stamps every class.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_classes ADD COLUMN IF NOT EXISTS results_published_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════════
-- C. Per-entry critique (model + photo separated)
-- Written by judge/host/co-host during judging (staff UPDATE
-- policy from 118 already covers the write). Revealed to the
-- entrant/public only once the class's results_published_at is
-- set — enforced in the read actions, which never select these
-- columns before reveal.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_class_entries ADD COLUMN IF NOT EXISTS critique_text TEXT;
ALTER TABLE show_class_entries ADD COLUMN IF NOT EXISTS critique_photo_text TEXT;
ALTER TABLE show_class_entries ADD COLUMN IF NOT EXISTS critique_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE show_class_entries ADD COLUMN IF NOT EXISTS critique_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════════
-- D. Documentation — the charter's "digital show binder".
-- Reusable per-horse dossiers (breed blurb, performance
-- explanation) that attach to entries; the judge sees the doc
-- with the entry, like the paper-card tradition. ON DELETE SET
-- NULL: losing a doc never voids an entry.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS horse_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'breed'
              CHECK (kind IN ('breed', 'performance', 'collectibility', 'other')),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body_md     TEXT NOT NULL CHECK (char_length(body_md) <= 4000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horse_documents_horse ON horse_documents (horse_id);
CREATE INDEX IF NOT EXISTS idx_horse_documents_owner ON horse_documents (owner_id);

ALTER TABLE horse_documents ENABLE ROW LEVEL SECURITY;

-- The entry link must exist BEFORE the visibility policy that
-- references it.
ALTER TABLE show_class_entries
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES horse_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_show_class_entries_document
  ON show_class_entries (document_id) WHERE document_id IS NOT NULL;

-- Owner full CRUD; readers = anyone who can see an entry the doc
-- is attached to (public show gallery or show staff) — mirrors
-- the entries SELECT policy so the judge view and public class
-- rooms can render documentation.
CREATE POLICY "Owner manages own documents"
  ON horse_documents FOR ALL
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "Documents visible with their entries"
  ON horse_documents FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM show_class_entries e
      WHERE e.document_id = horse_documents.id
        AND (
          show_is_public(e.show_id)
          OR show_role_check(e.show_id, ARRAY['host', 'co_host', 'steward', 'judge'])
        )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- E. Card void metadata (status CHECK already allows 'void';
-- the state machine in cards.ts already models the transition —
-- only the action + audit trail were missing).
-- ══════════════════════════════════════════════════════════════

ALTER TABLE qualification_cards ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE qualification_cards ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE qualification_cards ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- ============================================================
-- Tables: show_barred_entrants, horse_documents
-- Columns: users.is_suspended/suspended_at/suspended_reason;
--   show_classes.results_published_at; show_class_entries
--   critique_text/critique_photo_text/critique_by/critique_at/
--   document_id; qualification_cards voided_at/voided_by/
--   void_reason
-- Policy change: entries INSERT adds barred + suspended +
--   deadline checks
-- Trigger: trg_show_class_entries_domain (photo↔horse, public
--   horse at entry)
-- After applying: npm run gen-types
-- ============================================================
