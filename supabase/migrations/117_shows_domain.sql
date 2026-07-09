-- ============================================================
-- Migration 117: Shows Domain — Schema (Phase B of show rebuild)
-- ============================================================
-- New first-class competition domain per the approved Phase A
-- design doc. NOT bolted onto `events` — a show may later link
-- to a community event for discovery, but competition data lives
-- in its own tables.
--
-- NAMING NOTE: the design doc calls the entries table
-- `show_entries`. A legacy photo-show table once held that name
-- (migration 016) but was dropped in migration 052 — the
-- `show_class_entries` name is a precautionary rename for
-- clarity, not a live collision. Everything here is additive —
-- zero changes to existing tables.
--
-- Companion: migration 118 adds RLS policies + helper functions.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. shows — the root aggregate
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shows (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  -- One system, two modes: live (venue, tables, leg tags) and
  -- online (photo per class, entry + judging windows).
  mode               TEXT NOT NULL CHECK (mode IN ('live', 'online')),
  -- LOCKED decision (owner 2026-07-09): community voting kept as
  -- a judging option alongside expert judging.
  judging            TEXT NOT NULL DEFAULT 'judged'
                     CHECK (judging IN ('judged', 'community_vote')),
  -- Lifecycle state machine — transitions are explicit host
  -- actions, validated in src/lib/shows/stateMachine.ts.
  -- draft → published → entries_open → entries_closed
  --       → running (live) | judging (online)
  --       → results_review → completed → archived
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN (
                       'draft', 'published', 'entries_open', 'entries_closed',
                       'running', 'judging', 'results_review',
                       'completed', 'archived'
                     )),
  -- Live-mode fields
  venue_name         TEXT,
  venue_address      TEXT,
  show_date          DATE,
  -- Entry window (both modes) + judging window (online)
  entries_open_at    TIMESTAMPTZ,
  entries_close_at   TIMESTAMPTZ,
  judging_ends_at    TIMESTAMPTZ,
  rules_md           TEXT,
  -- Fees v1 = manual checklist (LOCKED decision); free-text info
  -- only. Stripe checkout lands in Phase F.
  fee_info           TEXT,
  -- Table capacity for live shows; NULL = uncapped / online.
  capacity           INTEGER CHECK (capacity IS NULL OR capacity > 0),
  -- Host opt-in (default ON): 1st/2nd in qualifying classes issue
  -- MHH qualification cards.
  is_mhh_qualifying  BOOLEAN NOT NULL DEFAULT true,
  sanctioning_note   TEXT,
  -- Hobby-native show year: May 1 → April 30. Stored as the year
  -- the show year STARTS in (2026 = 2026-05-01..2027-04-30).
  -- Maintained by trigger from show_date/entries_close_at; label
  -- formatting lives in src/lib/shows/showYear.ts.
  show_year          INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shows_host ON shows (host_id);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows (status);
CREATE INDEX IF NOT EXISTS idx_shows_show_year ON shows (show_year);

-- show_year maintenance: May 1 → April 30 (months 1-4 belong to
-- the PREVIOUS show year). Anchor date = show_date for live,
-- else entries_close_at.
CREATE OR REPLACE FUNCTION trg_shows_derive_show_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  anchor DATE;
BEGIN
  anchor := COALESCE(NEW.show_date, (NEW.entries_close_at AT TIME ZONE 'UTC')::date);
  IF anchor IS NOT NULL THEN
    NEW.show_year := CASE
      WHEN EXTRACT(MONTH FROM anchor) >= 5 THEN EXTRACT(YEAR FROM anchor)::int
      ELSE EXTRACT(YEAR FROM anchor)::int - 1
    END;
  ELSE
    NEW.show_year := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_shows_show_year
  BEFORE INSERT OR UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION trg_shows_derive_show_year();

-- host_id is immutable: RLS lets hosts/co-hosts UPDATE their show,
-- but reassigning ownership (host_id) would let a co-host hijack a
-- show — or a host dodge accountability. A deliberate host-transfer
-- flow can land later as a SECURITY DEFINER function; until then
-- any change to host_id is refused at the row level.
CREATE OR REPLACE FUNCTION trg_shows_host_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.host_id IS DISTINCT FROM OLD.host_id THEN
    RAISE EXCEPTION 'shows.host_id is immutable — host transfer requires a dedicated flow';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_shows_host_guard
  BEFORE UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION trg_shows_host_immutable();

-- ══════════════════════════════════════════════════════════════
-- 2. show_staff — delegated roles (co-hosts, stewards, judges)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS show_staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('host', 'co_host', 'steward', 'judge')),
  -- Conflict-of-interest flag: e.g. a judge who also has entries.
  coi_flag    BOOLEAN NOT NULL DEFAULT false,
  coi_note    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (show_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_show_staff_show ON show_staff (show_id);
CREATE INDEX IF NOT EXISTS idx_show_staff_user ON show_staff (user_id);

-- ══════════════════════════════════════════════════════════════
-- 3. show_divisions → show_sections → show_classes
-- Divisions are finish×axis ("OF Plastic Halter"); sections are
-- breed groups ("Stock", "Light"); classes are the judged unit.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS show_divisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  -- The division's competition axis. Powers the server-side
  -- "one breed-halter class per horse per show" rule (the design
  -- doc's per-division-axis enforcement — fixes today's
  -- client-only gap). Not in the doc's column list but required
  -- to enforce its rule without name parsing.
  axis        TEXT NOT NULL DEFAULT 'other'
              CHECK (axis IN ('halter', 'performance', 'workmanship',
                              'collectibility', 'other')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_divisions_show
  ON show_divisions (show_id, sort_order);

CREATE TABLE IF NOT EXISTS show_sections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id  UUID NOT NULL REFERENCES show_divisions(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_sections_division
  ON show_sections (division_id, sort_order);

CREATE TABLE IF NOT EXISTS show_classes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id             UUID NOT NULL REFERENCES show_sections(id) ON DELETE CASCADE,
  class_number           TEXT,
  name                   TEXT NOT NULL,
  -- Class-level state machine (src/lib/shows/stateMachine.ts):
  -- scheduled → called → judging → placed, plus terminal
  -- combined / cancelled. The classlist is mutable at runtime —
  -- split/combine/cancel is normal, not exceptional.
  status                 TEXT NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled', 'called', 'judging',
                                           'placed', 'combined', 'cancelled')),
  -- Split/combine lineage. New class rows are linked, entries are
  -- MOVED; the published classlist is never destructively edited.
  split_from_class_id    UUID REFERENCES show_classes(id) ON DELETE SET NULL,
  combined_into_class_id UUID REFERENCES show_classes(id) ON DELETE SET NULL,
  max_per_entrant        INTEGER CHECK (max_per_entrant IS NULL OR max_per_entrant > 0),
  -- Entry eligibility filters; NULL/empty = unrestricted.
  allowed_scales         TEXT[],
  allowed_finishes       TEXT[],
  -- When true (and shows.is_mhh_qualifying), 1st/2nd here issue
  -- MHH qualification cards.
  is_qualifying          BOOLEAN NOT NULL DEFAULT true,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_classes_section
  ON show_classes (section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_show_classes_split_from
  ON show_classes (split_from_class_id) WHERE split_from_class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_show_classes_combined_into
  ON show_classes (combined_into_class_id) WHERE combined_into_class_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- 4. show_class_entries — one horse in one class
-- (design doc name `show_entries` belonged to the legacy
-- photo-show table, dropped in 052; renamed here for clarity)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS show_class_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Denormalized show_id: entry_number is per-show, and RLS /
  -- hot queries ("all my entries at this show") avoid a 4-table
  -- join. Kept consistent by the actions layer.
  show_id       UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  class_id      UUID NOT NULL REFERENCES show_classes(id) ON DELETE CASCADE,
  horse_id      UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Proxy showing is first-class: the handler may differ from the
  -- owner. NULL = owner handles their own horse.
  handler_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Leg-tag number, assigned per show (same horse keeps its
  -- number across classes at one show).
  entry_number  INTEGER CHECK (entry_number IS NULL OR entry_number > 0),
  -- Online mode: the judged object is the photo.
  photo_id      UUID REFERENCES horse_images(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'entered'
                CHECK (status IN ('entered', 'scratched', 'placed')),
  -- Free-text annotation (e.g. why an entry was auto-scratched
  -- when classes were combined). Written by staff/system paths.
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scratch/re-entry contract (documented in
-- src/lib/shows/entryRules.ts): scratched rows are HISTORY and
-- stay in place; re-entering after a scratch creates a NEW row.
-- Uniqueness is therefore partial — a horse may appear in a class
-- many times scratched, but at most once live.
CREATE UNIQUE INDEX IF NOT EXISTS uq_show_class_entries_live
  ON show_class_entries (class_id, horse_id)
  WHERE status <> 'scratched';

CREATE INDEX IF NOT EXISTS idx_show_class_entries_show
  ON show_class_entries (show_id);
CREATE INDEX IF NOT EXISTS idx_show_class_entries_class
  ON show_class_entries (class_id);
CREATE INDEX IF NOT EXISTS idx_show_class_entries_horse
  ON show_class_entries (horse_id);
CREATE INDEX IF NOT EXISTS idx_show_class_entries_owner
  ON show_class_entries (owner_id);
CREATE INDEX IF NOT EXISTS idx_show_class_entries_handler
  ON show_class_entries (handler_id) WHERE handler_id IS NOT NULL;

-- Integrity: the denormalized show_id MUST match the show the
-- class actually belongs to (class → section → division → show).
-- Without this, an entrant could INSERT an entry whose class_id
-- points into someone else's show while show_id points at a show
-- where entries happen to be open — injecting entries cross-show.
-- SECURITY DEFINER: the ownership chain must be readable even when
-- the writer can't see every row through RLS.
CREATE OR REPLACE FUNCTION trg_show_class_entries_match_show()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  class_show_id UUID;
BEGIN
  SELECT d.show_id INTO class_show_id
  FROM show_classes c
  JOIN show_sections s ON s.id = c.section_id
  JOIN show_divisions d ON d.id = s.division_id
  WHERE c.id = NEW.class_id;

  IF class_show_id IS NULL OR class_show_id <> NEW.show_id THEN
    RAISE EXCEPTION 'entry show_id does not match the show of class %', NEW.class_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_show_class_entries_show_guard
  BEFORE INSERT OR UPDATE ON show_class_entries
  FOR EACH ROW EXECUTE FUNCTION trg_show_class_entries_match_show();

-- ══════════════════════════════════════════════════════════════
-- 5. show_placings — ONE result vocabulary
-- place is an integer 1..6; NULL = participation. Labels and
-- ribbon colors derive from src/lib/shows/placings.ts — this
-- kills the six duplicated lookup tables of the old system.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS show_placings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES show_classes(id) ON DELETE CASCADE,
  entry_id    UUID NOT NULL REFERENCES show_class_entries(id) ON DELETE CASCADE,
  place       INTEGER CHECK (place IS NULL OR place BETWEEN 1 AND 6),
  judge_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One entry gets one result per class. NULL places (participation)
  -- may repeat; numbered places may not.
  UNIQUE (class_id, place),
  UNIQUE (class_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_show_placings_class ON show_placings (class_id);
CREATE INDEX IF NOT EXISTS idx_show_placings_entry ON show_placings (entry_id);

-- Integrity: a placing's entry must actually be in the class being
-- placed — otherwise staff of one show could hang results on
-- entries from another class/show.
CREATE OR REPLACE FUNCTION trg_show_placings_entry_in_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_class_id UUID;
BEGIN
  SELECT e.class_id INTO entry_class_id
  FROM show_class_entries e
  WHERE e.id = NEW.entry_id;

  IF entry_class_id IS NULL OR entry_class_id <> NEW.class_id THEN
    RAISE EXCEPTION 'placing entry % does not belong to class %', NEW.entry_id, NEW.class_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_show_placings_class_guard
  BEFORE INSERT OR UPDATE ON show_placings
  FOR EACH ROW EXECUTE FUNCTION trg_show_placings_entry_in_class();

-- ══════════════════════════════════════════════════════════════
-- 6. show_callbacks — champion / reserve ladder
-- Placed 1sts queue to the section callback; section champions to
-- the division callback; and so on up to show.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS show_callbacks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id            UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  scope              TEXT NOT NULL CHECK (scope IN ('section', 'division', 'show')),
  -- show_sections.id or show_divisions.id; NULL when scope='show'.
  scope_id           UUID,
  champion_entry_id  UUID REFERENCES show_class_entries(id) ON DELETE SET NULL,
  reserve_entry_id   UUID REFERENCES show_class_entries(id) ON DELETE SET NULL,
  judge_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (scope = 'show' OR scope_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_show_callbacks_show ON show_callbacks (show_id);
CREATE INDEX IF NOT EXISTS idx_show_callbacks_scope
  ON show_callbacks (scope, scope_id) WHERE scope_id IS NOT NULL;

-- Integrity: champion/reserve entries and the scoped
-- section/division must all belong to the callback's own show —
-- staff of show A must not be able to point a callback at show B's
-- entries or structure.
CREATE OR REPLACE FUNCTION trg_show_callbacks_same_show()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.champion_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM show_class_entries e
    WHERE e.id = NEW.champion_entry_id AND e.show_id = NEW.show_id
  ) THEN
    RAISE EXCEPTION 'callback champion entry does not belong to show %', NEW.show_id;
  END IF;

  IF NEW.reserve_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM show_class_entries e
    WHERE e.id = NEW.reserve_entry_id AND e.show_id = NEW.show_id
  ) THEN
    RAISE EXCEPTION 'callback reserve entry does not belong to show %', NEW.show_id;
  END IF;

  IF NEW.scope = 'section' AND NOT EXISTS (
    SELECT 1 FROM show_sections s
    JOIN show_divisions d ON d.id = s.division_id
    WHERE s.id = NEW.scope_id AND d.show_id = NEW.show_id
  ) THEN
    RAISE EXCEPTION 'callback section scope_id does not belong to show %', NEW.show_id;
  END IF;

  IF NEW.scope = 'division' AND NOT EXISTS (
    SELECT 1 FROM show_divisions d
    WHERE d.id = NEW.scope_id AND d.show_id = NEW.show_id
  ) THEN
    RAISE EXCEPTION 'callback division scope_id does not belong to show %', NEW.show_id;
  END IF;

  IF NEW.scope = 'show' AND NEW.scope_id IS NOT NULL THEN
    RAISE EXCEPTION 'show-scope callbacks must not carry a scope_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_show_callbacks_show_guard
  BEFORE INSERT OR UPDATE ON show_callbacks
  FOR EACH ROW EXECUTE FUNCTION trg_show_callbacks_same_show();

-- ══════════════════════════════════════════════════════════════
-- 7. qualification_cards — bearer tokens on the horse's Hoofprint
-- id IS the short code (8-char URL-safe, generated in
-- src/lib/shows/cards.ts, collision-checked at insert).
-- current_owner_id follows the horse through Safe-Trade (hook
-- lands in Phase F). Redemption verifies against show_placings.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS qualification_cards (
  id                  TEXT PRIMARY KEY CHECK (id ~ '^[A-HJ-NP-Za-km-z2-9]{8}$'),
  -- RESTRICT (not CASCADE) on show/class: cards are earned results
  -- of a completed show — deleting the show or class must never
  -- silently vaporize them. Both FKs restrict because a show
  -- delete would otherwise reach cards via the class cascade chain.
  show_id             UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
  class_id            UUID NOT NULL REFERENCES show_classes(id) ON DELETE RESTRICT,
  horse_id            UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  earned_place        INTEGER NOT NULL CHECK (earned_place IN (1, 2)),
  earned_by_owner_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'issued'
                      CHECK (status IN ('issued', 'transferred', 'redeemed', 'void')),
  -- Show year the card belongs to (May 1 → Apr 30), denormalized
  -- from the show for card display + championship eligibility.
  show_year           INTEGER,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One card per horse per class (the 1st/2nd distinction lives
  -- in earned_place). Deliberately ABSOLUTE — unlike the entries
  -- table's status-partial uniqueness — because a card represents
  -- the one real 1st/2nd result for that horse in that class
  -- (issuance is guarded by the RLS placing check in 118); voided
  -- cards are corrections, not room for a duplicate.
  UNIQUE (class_id, horse_id)
);

CREATE INDEX IF NOT EXISTS idx_qualification_cards_show ON qualification_cards (show_id);
CREATE INDEX IF NOT EXISTS idx_qualification_cards_horse ON qualification_cards (horse_id);
CREATE INDEX IF NOT EXISTS idx_qualification_cards_current_owner
  ON qualification_cards (current_owner_id);
CREATE INDEX IF NOT EXISTS idx_qualification_cards_year
  ON qualification_cards (show_year, status);

-- ══════════════════════════════════════════════════════════════
-- 8. show_results_docs — the archival results file
-- (searchable NAMHSA-format export; their 30-day requirement)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS show_results_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id       UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  format        TEXT NOT NULL DEFAULT 'csv',
  storage_path  TEXT NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_results_docs_show ON show_results_docs (show_id);

-- ============================================================
-- ✅ Migration 117 Complete
-- Added: shows, show_staff, show_divisions, show_sections,
--        show_classes, show_class_entries, show_placings,
--        show_callbacks, qualification_cards, show_results_docs
-- Integrity triggers: shows host_id immutable; entry show_id must
-- match its class's show; placing entry must be in its class;
-- callback entries/scope must belong to the callback's show.
-- RLS lands in migration 118.
-- ============================================================
