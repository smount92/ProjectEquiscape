-- ============================================================
-- 230: the owners' roadmap — goals, problems and chores in one table
--
-- Short- and long-term goals lived in chat threads and dated docs,
-- and user-reported problems in the mailbox; nothing had a status.
-- The Admin console's Roadmap tab reads and writes this table through
-- the service role only. RLS is on with no policies and the table is
-- revoked from the API roles, so no member session can read it — it
-- holds the owners' private notes about what is broken and what is
-- next. Vocabulary mirrors src/lib/roadmap/model.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  detail      TEXT NOT NULL DEFAULT '' CHECK (char_length(detail) <= 4000),
  kind        TEXT NOT NULL CHECK (kind IN ('goal', 'problem', 'idea', 'chore')),
  horizon     TEXT NOT NULL CHECK (horizon IN ('now', 'short', 'long', 'someday')),
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'blocked', 'done', 'dropped')),
  priority    SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  area        TEXT NOT NULL DEFAULT '' CHECK (char_length(area) <= 40),
  source      TEXT NOT NULL DEFAULT '' CHECK (char_length(source) <= 120),
  link        TEXT NOT NULL DEFAULT '' CHECK (char_length(link) <= 500),
  due_on      DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ
);

COMMENT ON TABLE public.roadmap_items IS
  'Owners-only roadmap: goals, problems, ideas and chores with a horizon and a status (230). Service role only; shown on the Admin console Roadmap tab.';

CREATE INDEX IF NOT EXISTS roadmap_items_open_idx
  ON public.roadmap_items (horizon, priority)
  WHERE status NOT IN ('done', 'dropped');

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roadmap_items FROM anon, authenticated;

-- ── Seed: the backlog as of 2026-10-12, gathered from the audit notes,
--    member messages and the NAMHSA call. Edit freely on the tab. ──
INSERT INTO public.roadmap_items (title, detail, kind, horizon, status, priority, area, source) VALUES
  -- Problems
  ('Three archived test shows still count as NAMHSA-qualifying',
   'Test 5, Test Show and Test Show #2 are archived but still flagged is_mhh_qualifying, so they sit in the standings footer. Un-qualify or delete the three rows.',
   'problem', 'now', 'open', 1, 'shows', 'NAMHSA prep 2026-10'),
  ('Four identical "Stock Horse Foal" Breyer molds in the Registry',
   'Merge to one canonical mold (Catalog tab → merge). Then work the pending catalog suggestions queue.',
   'problem', 'now', 'open', 2, 'registry', 'inbox batch 2026-10-08'),
  ('Québec Live double-entry report has no example yet',
   'A member says a horse was entered twice in one class. The insert path is single, so the likely cause is the same photo under two horse records. Ask Misty for the show, class and horse.',
   'problem', 'short', 'blocked', 2, 'shows', 'Misty (member message)'),
  ('Stable bulk trade-status change skips the active-sale lock',
   'bulkUpdateHorses in src/app/actions/horse.ts can flip a horse to not-for-sale while a deal is active; the single-horse path refuses. Route bulk through the same guard.',
   'problem', 'short', 'open', 2, 'stable', 'audit 2026-10-11'),
  ('Breed-group words read as generic in entry eligibility',
   '"Pony", "draft", "warmblood" in a class name are not matched to a horse''s breed, so a Welsh Pony in "Pony Breeds" shows as Check first instead of Eligible. Teach classNamesBreed the group words.',
   'problem', 'short', 'open', 3, 'shows', 'entry-flow redesign 2026-10'),
  ('Legacy text may still carry &amp;-style entities',
   'The sanitiser now stores plain text, but rows written before 2026-10-08 (groups, posts, messages, external shows, suggestion reasons) were not backfilled; migration 227 was reserved and skipped.',
   'problem', 'someday', 'open', 3, 'ops', 'inbox batch 2026-10-08'),
  -- Chores
  ('Verify the show-tag PDF on a current show',
   'The printer route now serves v2 shows but was not opened end to end. Needs a Pro account with live entries: open a show you entered → Print my show tags.',
   'chore', 'now', 'open', 2, 'shows', 'push 2026-10-12'),
  ('Reply to MHI, Starshore and Misty',
   'MHI: Sold status and location dropdown. Starshore: barns description. Misty: ask for a concrete double-entry example.',
   'chore', 'now', 'open', 1, 'community', 'inbox 2026-10-08'),
  ('Send the numbering write-up to NAMHSA''s incoming president',
   'The MHH-agnostic member-number / horse-number proposal with example rows is in the Claude Doc. Share it and ask for a decision on who holds the register.',
   'chore', 'now', 'open', 1, 'namhsa', 'NAMHSA call 2026-10-11'),
  ('Set SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT in Vercel',
   'The Ops tab''s errors card shows the setup guide until the three variables exist.',
   'chore', 'short', 'open', 3, 'ops', 'ops lean-out 2026-09'),
  ('Clear the pre-existing lint errors',
   'DashboardV2 try/catch in JSX, StableFilterBar:118, SuggestNewEntryForm:434, catalog/page.tsx:433 apostrophes, UnifiedReferenceSearch.',
   'chore', 'someday', 'open', 3, 'ops', 'build log'),
  -- Goals
  ('Persistent "Your entries" tray on the show page',
   'Group the viewer''s live entries by horse on the show page itself, not only on the entry page''s Done view.',
   'goal', 'short', 'open', 2, 'shows', 'entry-flow redesign 2026-10'),
  ('Horse-first entry mode',
   'Pick a horse, then tick every class it fits — the mirror of the class-first workbench, using enterClassBatch.',
   'goal', 'short', 'open', 2, 'shows', 'entry-flow redesign 2026-10'),
  ('Barns guide page',
   'A plain-words page explaining Barns (private groups, suggestion box, notice board) for members who ask what they are.',
   'goal', 'short', 'open', 3, 'community', 'Starshore (member message)'),
  ('Curation workbench for catalog suggestions',
   'Treat the pending suggestions queue the way the entry page treats classes: one ledger, one decision surface, bulk approve.',
   'goal', 'long', 'open', 2, 'registry', 'audit 2026-10-11'),
  ('Host show-readiness forecast',
   'Before entries open, tell the host what will refuse: empty classes, missing caps, closing dates in the past.',
   'goal', 'long', 'open', 3, 'shows', 'audit 2026-10-11'),
  ('Deal-action ledger on the Market',
   'One owner for what a buyer or seller may do next on a deal, read by every button.',
   'goal', 'long', 'open', 3, 'market', 'audit 2026-10-11'),
  ('National member and horse numbers with NAMHSA',
   'M-numbers and H-numbers (7 random digits + Damm check digit), NAMHSA-owned register, MHH as the first implementer. Depends on the incoming president''s decision.',
   'goal', 'long', 'in_progress', 1, 'namhsa', 'NAMHSA call 2026-10-11'),
  ('Digital NAN cards and judge software',
   'The two things NAMHSA said they want after numbering: a card that lives on the horse''s passport, and a judging tool that reads the same data.',
   'goal', 'long', 'open', 2, 'namhsa', 'NAMHSA call 2026-10-11'),
  ('Keep Vercel ISR writes flat',
   'The 60-second root-layout cache was the cost driver (fixed 2026-10). Watch the usage page monthly; any new layout-level cache must be long-lived and tag-cleared.',
   'goal', 'long', 'open', 2, 'ops', 'Vercel cost 2026-10'),
  ('Turn on PayPal billing',
   'Built dark behind a flag. Needs the owner''s PayPal setup steps, then the flag.',
   'goal', 'someday', 'open', 3, 'billing', 'PayPal billing memory'),
  ('Everything in one place: more feeds after eBay',
   'The hobby''s data converging on MHH: price history, external shows, registries. eBay was the first feed.',
   'goal', 'someday', 'open', 3, 'growth', 'strategy');
