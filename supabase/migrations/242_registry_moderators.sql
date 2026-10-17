-- ============================================================
-- 242: Registry moderators: the role, the history, the claim
--
-- Release 3, Registry Desk Phase 1 (docs/design/registry-desk-phase1-plan.md,
-- owner rulings 2026-10-16 in docs/DECISIONS.md).
--
-- 1. registry_moderators: the owner hand-picks Registry moderators. A seat
--    is active, resting, stepped down or removed; the site reads it on
--    every request, so a removed moderator is refused at once. A
--    "Registry Moderator" badge goes with an active seat.
-- 2. registry_actions and registry_action_rows: the Registry's history.
--    Every change made on the Registry Desk (and every approval) is one
--    entry with who did it, in what role, and each row's before and
--    after, so it can be undone for 30 days.
-- 3. catalog_changelog gains the role of whoever made the change and a
--    link to its history entry, and three more change types (merge,
--    restore, revert). Existing rows are untouched; their role reads
--    "before roles".
-- 4. catalog_suggestions gains a claim (who is looking at it, until when),
--    the member's original wording when a moderator edits before
--    approving, and the role of whoever decided it. Only the server can
--    set those four (a trigger refuses a member's own write to them).
--
-- New tables are for the server only: row security on, no policies.
-- Nothing here changes any Registry data. Safe to paste twice. If the
-- site is busy the paste may stop with "lock timeout"; paste it again a
-- minute later.
-- ============================================================

SET lock_timeout = '5s';

-- ── 1. Moderator seats ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.registry_moderators (
  user_id        UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE, -- embed-checked: new table, nothing embeds users from it
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'resting', 'stepped_down', 'removed')),
  granted_by     UUID,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  term_ends_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 months'),
  last_action_at TIMESTAMPTZ,
  removed_at     TIMESTAMPTZ,
  removed_reason TEXT CHECK (removed_reason IS NULL OR char_length(removed_reason) <= 1000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registry_moderators_status ON public.registry_moderators (status);

ALTER TABLE public.registry_moderators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.registry_moderators FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_registry_moderators_updated_at ON public.registry_moderators;
CREATE TRIGGER trg_registry_moderators_updated_at
  BEFORE UPDATE ON public.registry_moderators
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();

INSERT INTO public.badges (id, name, description, icon, category, tier) VALUES
  ('registry_moderator', 'Registry Moderator',
   'A vetted member who keeps the Registry accurate on the Registry Desk.', '🗂️', 'community', 5)
ON CONFLICT (id) DO NOTHING;

-- ── 2. History ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.registry_actions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- kind and status are checked below, by name, so a second paste widens them.
  kind             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'applied',
  actor_id         UUID REFERENCES public.users(id) ON DELETE SET NULL, -- embed-checked: the only link to users on this new table
  actor_role       TEXT NOT NULL CHECK (actor_role IN ('member', 'curator', 'moderator', 'owner')),
  -- No foreign key: the row may since have been merged or removed.
  catalog_item_id  UUID,
  item_title       TEXT,
  related_item_id  UUID,
  suggestion_id    UUID REFERENCES public.catalog_suggestions(id) ON DELETE SET NULL,
  summary          TEXT NOT NULL CHECK (char_length(summary) <= 2000),
  note             TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  row_count        INT NOT NULL DEFAULT 1,
  second_look_by   UUID,
  second_look_at   TIMESTAMPTZ,
  second_look_note TEXT CHECK (second_look_note IS NULL OR char_length(second_look_note) <= 1000),
  looks_right_by   UUID,
  looks_right_at   TIMESTAMPTZ,
  undone_by        UUID,
  undone_at        TIMESTAMPTZ,
  undo_of          UUID REFERENCES public.registry_actions(id) ON DELETE SET NULL,
  undo_until       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at       TIMESTAMPTZ
);
-- reject: a suggestion turned down on the Desk (it counts toward the daily
-- limit and the speed alarm like any other decision).
-- pending: written just before a merge or a removal runs, and turned
-- applied by the database function that runs it, in the same
-- transaction; an entry never reads "applied" before the change happened.
ALTER TABLE public.registry_actions DROP CONSTRAINT IF EXISTS registry_actions_kind_check;
ALTER TABLE public.registry_actions ADD CONSTRAINT registry_actions_kind_check
  CHECK (kind IN ('edit', 'add', 'refile', 'approve', 'revert', 'merge', 'remove', 'undo', 'reject'));
ALTER TABLE public.registry_actions DROP CONSTRAINT IF EXISTS registry_actions_status_check;
ALTER TABLE public.registry_actions ADD CONSTRAINT registry_actions_status_check
  CHECK (status IN ('applied', 'awaiting_second_look', 'declined', 'undone', 'failed', 'pending'));

CREATE INDEX IF NOT EXISTS idx_registry_actions_created ON public.registry_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registry_actions_actor ON public.registry_actions (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registry_actions_item ON public.registry_actions (catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_registry_actions_second_look
  ON public.registry_actions (created_at) WHERE status = 'awaiting_second_look';

ALTER TABLE public.registry_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.registry_actions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.registry_action_rows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id       UUID NOT NULL REFERENCES public.registry_actions(id) ON DELETE RESTRICT,
  catalog_item_id UUID,
  -- Only the columns and attribute keys the action touched.
  before          JSONB,
  after           JSONB,
  outcome         TEXT NOT NULL DEFAULT 'applied'
                  CHECK (outcome IN ('applied', 'skipped_changed_since', 'refused', 'restored')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registry_action_rows_action ON public.registry_action_rows (action_id);
CREATE INDEX IF NOT EXISTS idx_registry_action_rows_item ON public.registry_action_rows (catalog_item_id);

ALTER TABLE public.registry_action_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.registry_action_rows FROM anon, authenticated;

-- ── 3. The public changelog says who and in what role ─────────
-- No new foreign key to catalog_items here: the changelog page embeds
-- catalog_items(...) and a second path would make it ambiguous (PGRST201).

ALTER TABLE public.catalog_changelog ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE public.catalog_changelog DROP CONSTRAINT IF EXISTS catalog_changelog_actor_role_check;
ALTER TABLE public.catalog_changelog ADD CONSTRAINT catalog_changelog_actor_role_check
  CHECK (actor_role IS NULL OR actor_role IN ('member', 'curator', 'moderator', 'owner'));

ALTER TABLE public.catalog_changelog
  ADD COLUMN IF NOT EXISTS action_id UUID REFERENCES public.registry_actions(id) ON DELETE SET NULL;

-- 228's list, plus merge, restore and revert.
ALTER TABLE public.catalog_changelog
  DROP CONSTRAINT IF EXISTS catalog_changelog_change_type_check;
ALTER TABLE public.catalog_changelog
  ADD CONSTRAINT catalog_changelog_change_type_check
  CHECK (change_type IN ('correction', 'addition', 'removal', 'photo', 'duplicate', 'merge', 'restore', 'revert'));

-- ── 4. Claims and decisions on suggestions ───────────────────
-- claimed_by has no foreign key: catalog_suggestions already links to
-- auth.users, and a claim is short-lived.

ALTER TABLE public.catalog_suggestions ADD COLUMN IF NOT EXISTS claimed_by UUID;
ALTER TABLE public.catalog_suggestions ADD COLUMN IF NOT EXISTS claimed_until TIMESTAMPTZ;
ALTER TABLE public.catalog_suggestions ADD COLUMN IF NOT EXISTS original_field_changes JSONB;
ALTER TABLE public.catalog_suggestions ADD COLUMN IF NOT EXISTS decided_role TEXT;
ALTER TABLE public.catalog_suggestions DROP CONSTRAINT IF EXISTS catalog_suggestions_decided_role_check;
ALTER TABLE public.catalog_suggestions ADD CONSTRAINT catalog_suggestions_decided_role_check
  CHECK (decided_role IS NULL OR decided_role IN ('member', 'curator', 'moderator', 'owner'));

-- Only the server sets the claim, the member's original wording and the
-- deciding role. A member may still edit their own pending suggestion
-- (the 092 policy), but not these four columns: otherwise they could
-- claim it in a moderator's name or rewrite "what the member sent".
-- While a moderator holds the claim the suggestion is under_review, so
-- the 092 policy (own AND pending) keeps the member out of it entirely.
--
-- How a member's write is told from the server's, as in 142, 176 and
-- 180: this function is SECURITY INVOKER, so current_user is the role
-- PostgREST switched to for the request: 'anon' or 'authenticated' for a
-- browser's key, 'service_role' for the server, 'postgres' in the SQL
-- editor. (The JWT's role claim says the same for API calls.)
CREATE OR REPLACE FUNCTION public.catalog_suggestions_guard_review_cols()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.claimed_by IS NOT NULL OR NEW.claimed_until IS NOT NULL
         OR NEW.original_field_changes IS NOT NULL OR NEW.decided_role IS NOT NULL THEN
        RAISE EXCEPTION 'Only the Registry team sets who is reviewing a suggestion.' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
       OR NEW.claimed_until IS DISTINCT FROM OLD.claimed_until
       OR NEW.original_field_changes IS DISTINCT FROM OLD.original_field_changes
       OR NEW.decided_role IS DISTINCT FROM OLD.decided_role THEN
      RAISE EXCEPTION 'Only the Registry team sets who is reviewing a suggestion.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalog_suggestions_guard_review_cols ON public.catalog_suggestions;
CREATE TRIGGER trg_catalog_suggestions_guard_review_cols
  BEFORE INSERT OR UPDATE ON public.catalog_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.catalog_suggestions_guard_review_cols();

RESET lock_timeout;

NOTIFY pgrst, 'reload schema';
