-- ============================================================
-- 244: Registry style rules, to-do claims and the owner's daily digest
--
-- Release 3 (2026-10), Registry Desk Phase 1, Package C. Safe to paste
-- twice. Paste after 242 and 243 (it does not need them, but the Desk's
-- History and digest read 242's registry_actions).
--
-- The Registry Desk gives Registry moderators three new lists:
--
-- 1. registry_style_rules + registry_rule_votes: the house style for the
--    Registry, written by moderators (owner ruling 2026-10-16). One
--    proposes, the others agree; at 3 agreements (the owner's counts,
--    the proposer's does not) it takes effect, unless the owner vetoes.
--    check_key names a suggested fix in src/lib/registry/fixes.ts; it is
--    checked in code, not here, so a new fix needs no migration.
-- 2. registry_todo_claims: "I'm on it" on a to-do list or one row of it,
--    for a day, so two moderators don't fix the same rows; done_at marks
--    it finished.
-- 3. registry_digests: one row per day. The daily cron inserts the day
--    ON CONFLICT DO NOTHING before it rings the owner's bell, so the
--    digest goes out once a day however often the cron runs.
--
-- All four tables are written and read only by the server (service role)
-- after it has checked the moderator's role, so RLS is on with no
-- policies, and members and visitors get no table rights at all.
-- Each table has one foreign key to public.users (marked embed-checked);
-- nothing embeds users from these tables.
--
-- Before this is pasted the Desk's Rules tab, claims and the digest say
-- "Coming once update 244 is added." After the paste: npm run gen-types.
-- ============================================================

-- 233's updated_at stamp, re-stated unchanged so this file stands alone.
CREATE OR REPLACE FUNCTION public.trg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

-- ── 1. Style rules ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.registry_style_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  check_key     TEXT,
  params        JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'proposed',
  proposed_by   UUID REFERENCES public.users(id) ON DELETE SET NULL, -- embed-checked
  in_effect_at  TIMESTAMPTZ,
  vetoed_at     TIMESTAMPTZ,
  veto_note     TEXT,
  retired_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.registry_style_rules DROP CONSTRAINT IF EXISTS registry_style_rules_status_check;
ALTER TABLE public.registry_style_rules ADD CONSTRAINT registry_style_rules_status_check
  CHECK (status IN ('proposed', 'in_effect', 'vetoed', 'withdrawn', 'retired'));

ALTER TABLE public.registry_style_rules DROP CONSTRAINT IF EXISTS registry_style_rules_title_length;
ALTER TABLE public.registry_style_rules ADD CONSTRAINT registry_style_rules_title_length
  CHECK (char_length(title) BETWEEN 3 AND 140);

ALTER TABLE public.registry_style_rules DROP CONSTRAINT IF EXISTS registry_style_rules_body_length;
ALTER TABLE public.registry_style_rules ADD CONSTRAINT registry_style_rules_body_length
  CHECK (char_length(body) BETWEEN 10 AND 2000);

ALTER TABLE public.registry_style_rules DROP CONSTRAINT IF EXISTS registry_style_rules_check_key_length;
ALTER TABLE public.registry_style_rules ADD CONSTRAINT registry_style_rules_check_key_length
  CHECK (check_key IS NULL OR char_length(check_key) BETWEEN 1 AND 60);

ALTER TABLE public.registry_style_rules DROP CONSTRAINT IF EXISTS registry_style_rules_params_object;
ALTER TABLE public.registry_style_rules ADD CONSTRAINT registry_style_rules_params_object
  CHECK (jsonb_typeof(params) = 'object');

ALTER TABLE public.registry_style_rules DROP CONSTRAINT IF EXISTS registry_style_rules_veto_note_length;
ALTER TABLE public.registry_style_rules ADD CONSTRAINT registry_style_rules_veto_note_length
  CHECK (veto_note IS NULL OR char_length(veto_note) <= 1000);

CREATE INDEX IF NOT EXISTS idx_registry_style_rules_status
  ON public.registry_style_rules (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_registry_style_rules_updated_at ON public.registry_style_rules;
CREATE TRIGGER trg_registry_style_rules_updated_at
  BEFORE UPDATE ON public.registry_style_rules
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();

COMMENT ON TABLE public.registry_style_rules IS
  'Registry house style, proposed and agreed by Registry moderators (3 agreements, the owner''s counts, the proposer''s does not); the owner may veto. check_key names a fix in src/lib/registry/fixes.ts.';

-- ── 2. Votes on a rule ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.registry_rule_votes (
  rule_id     UUID NOT NULL REFERENCES public.registry_style_rules(id) ON DELETE CASCADE,
  voter_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- embed-checked
  vote        TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, voter_id)
);

ALTER TABLE public.registry_rule_votes DROP CONSTRAINT IF EXISTS registry_rule_votes_vote_check;
ALTER TABLE public.registry_rule_votes ADD CONSTRAINT registry_rule_votes_vote_check
  CHECK (vote IN ('agree', 'disagree'));

ALTER TABLE public.registry_rule_votes DROP CONSTRAINT IF EXISTS registry_rule_votes_note_length;
ALTER TABLE public.registry_rule_votes ADD CONSTRAINT registry_rule_votes_note_length
  CHECK (note IS NULL OR char_length(note) <= 500);

CREATE INDEX IF NOT EXISTS idx_registry_rule_votes_voter
  ON public.registry_rule_votes (voter_id);

-- ── 3. To-do claims ───────────────────────────────────────────
-- item_key '*' is the whole list; otherwise a row id or a group key.

CREATE TABLE IF NOT EXISTS public.registry_todo_claims (
  list_key       TEXT NOT NULL,
  item_key       TEXT NOT NULL,
  claimed_by     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- embed-checked
  claimed_until  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day'),
  done_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_key, item_key)
);

ALTER TABLE public.registry_todo_claims DROP CONSTRAINT IF EXISTS registry_todo_claims_key_length;
ALTER TABLE public.registry_todo_claims ADD CONSTRAINT registry_todo_claims_key_length
  CHECK (char_length(list_key) BETWEEN 1 AND 60 AND char_length(item_key) BETWEEN 1 AND 300);

CREATE INDEX IF NOT EXISTS idx_registry_todo_claims_by
  ON public.registry_todo_claims (claimed_by);

-- ── 4. The owner's daily digest ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.registry_digests (
  day      DATE PRIMARY KEY,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary  JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ── Service role only ─────────────────────────────────────────

ALTER TABLE public.registry_style_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registry_rule_votes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registry_todo_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registry_digests     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.registry_style_rules FROM anon, authenticated;
REVOKE ALL ON public.registry_rule_votes  FROM anon, authenticated;
REVOKE ALL ON public.registry_todo_claims FROM anon, authenticated;
REVOKE ALL ON public.registry_digests     FROM anon, authenticated;

GRANT ALL ON public.registry_style_rules TO service_role;
GRANT ALL ON public.registry_rule_votes  TO service_role;
GRANT ALL ON public.registry_todo_claims TO service_role;
GRANT ALL ON public.registry_digests     TO service_role;
