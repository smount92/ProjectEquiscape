-- ============================================================
-- 236: contact messages get a category, a status and the sender's account
--
-- Release 2 (2026-10), ticket MHH-027 (gap G9).
--
-- The contact form is the one way anyone can reach the owner, including
-- logged-out visitors and members whose page just broke. Its messages had
-- no category, no open/resolved state and no link to the sender's account,
-- and an error page's reference number had to be typed by hand. This adds:
--   category     what it's about, chosen on the form
--   status       open or resolved (the owner closes it when it's handled;
--                messages already read are treated as handled)
--   user_id      the signed-in sender's account, set by the server, never
--                by the form; a sender can only ever name themselves
--   error_ref    the reference from the error page, filled in for them
--   resolved_at  when it was closed
--
-- Safe to paste twice.
-- ============================================================

ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'question';
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS error_ref TEXT;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_category_check;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_category_check
  CHECK (category IN ('question', 'problem', 'registry', 'account', 'billing', 'shows', 'market', 'report', 'idea', 'other'));

ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_status_check
  CHECK (status IN ('open', 'resolved'));

-- Messages already read before this release count as handled.
UPDATE public.contact_messages
SET status = 'resolved', resolved_at = coalesce(resolved_at, created_at)
WHERE is_read = true AND status = 'open';

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created ON public.contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_user ON public.contact_messages (user_id);

-- The insert policy keeps 022's length checks and adds: a new message is
-- always open, names no account but the sender's own, and carries a short
-- reference at most.
DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can submit a contact message"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) > 0 AND
    length(email) > 3 AND
    length(message) > 0 AND
    length(message) < 5000 AND
    status = 'open' AND
    resolved_at IS NULL AND
    (user_id IS NULL OR user_id = (SELECT auth.uid())) AND
    (error_ref IS NULL OR length(error_ref) <= 100)
  );
