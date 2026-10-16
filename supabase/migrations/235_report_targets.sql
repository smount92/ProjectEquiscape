-- ============================================================
-- 235: members can report every kind of content
--
-- Release 2 (2026-10), ticket MHH-019.
--
-- Until now only horse pages had a Report button, and the reports table
-- accepted five kinds of thing: post, horse, user, comment and message.
-- The button now sits on show entries and on Help ID requests and
-- suggestions too, so the table must accept those three as well.
--
-- Nothing else changes for reports: a market listing is reported as its
-- horse (the passport is the listing), and barn threads and replies are
-- posts and comments, as they always were.
--
-- It also lets a report card take content down (MHH-025) without deleting
-- anything. Posts (feed posts, replies, barn threads and their replies)
-- and Help ID requests and suggestions get a hidden_at stamp. A hidden
-- row is invisible to every member and visitor, its author included,
-- because a row policy says so; the row itself stays, so a mistake can be
-- undone by clearing hidden_at. (Messages already have deleted_at,
-- horses go private, show entries are scratched: no change needed.)
--
-- Before this is pasted, reporting a show entry or a Help ID post says
-- "not switched on yet", and "Hide" on a report card says to paste this;
-- every other report and take-down works as before.
--
-- Known gap: the public history on a logged-out passport is built by a
-- SECURITY DEFINER function (177) that does not read this stamp, so a
-- hidden note the owner wrote on their own horse still shows there.
--
-- Safe to paste twice.
-- ============================================================

-- ── 1. What can be reported ───────────────────────────────────
ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_target_type_check;
ALTER TABLE public.user_reports ADD CONSTRAINT user_reports_target_type_check
  CHECK (target_type IN (
    'post', 'comment', 'horse', 'user', 'message',
    'show_entry', 'id_request', 'id_suggestion'
  ));

-- ── 2. Hiding, never deleting ─────────────────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.id_requests ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.id_requests ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.id_suggestions ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.id_suggestions ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.posts.hidden_at IS
  'Set when the site team takes a reported post down. Hidden rows are invisible to members (posts_not_hidden policy); clear it to restore.';
COMMENT ON COLUMN public.id_requests.hidden_at IS
  'Set when the site team takes a reported Help ID request down. Clear it to restore.';
COMMENT ON COLUMN public.id_suggestions.hidden_at IS
  'Set when the site team takes a reported Help ID suggestion down. Clear it to restore.';

-- RESTRICTIVE policies are ANDed with the existing ones, so nothing the
-- current policies allow is widened, and they don't need restating.
-- The service role (the admin console) is not subject to RLS and still
-- sees hidden rows. Members can't clear the stamp either: an update must
-- see the row and must leave it unhidden.
DROP POLICY IF EXISTS "posts_not_hidden" ON public.posts;
CREATE POLICY "posts_not_hidden" ON public.posts
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (hidden_at IS NULL);
DROP POLICY IF EXISTS "posts_hidden_stay_hidden" ON public.posts;
CREATE POLICY "posts_hidden_stay_hidden" ON public.posts
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (hidden_at IS NULL) WITH CHECK (hidden_at IS NULL);

DROP POLICY IF EXISTS "id_requests_not_hidden" ON public.id_requests;
CREATE POLICY "id_requests_not_hidden" ON public.id_requests
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (hidden_at IS NULL);
DROP POLICY IF EXISTS "id_requests_hidden_stay_hidden" ON public.id_requests;
CREATE POLICY "id_requests_hidden_stay_hidden" ON public.id_requests
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (hidden_at IS NULL) WITH CHECK (hidden_at IS NULL);

DROP POLICY IF EXISTS "id_suggestions_not_hidden" ON public.id_suggestions;
CREATE POLICY "id_suggestions_not_hidden" ON public.id_suggestions
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (hidden_at IS NULL);
DROP POLICY IF EXISTS "id_suggestions_hidden_stay_hidden" ON public.id_suggestions;
CREATE POLICY "id_suggestions_hidden_stay_hidden" ON public.id_suggestions
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (hidden_at IS NULL) WITH CHECK (hidden_at IS NULL);

-- After pasting: Admin › Ops shows 235 green (it probes posts.hidden_at).
-- Then run npm run gen-types.
