-- 221: A status on a barn thread — "In progress" / "Implemented"
-- (2026-09-21).
--
-- The suggestion box is a barn, and its threads are the roadmap members
-- can see. The owner wanted to mark a suggestion as taken up or shipped
-- where the member posted it, instead of replying "done" into a thread
-- nobody re-reads. One nullable column on posts, settable by barn staff
-- (owner / admin / moderator, the same roles that pin). NULL = no mark.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS thread_status TEXT
    CHECK (thread_status IS NULL OR thread_status IN ('in_progress', 'implemented', 'not_planned'));

COMMENT ON COLUMN public.posts.thread_status IS
  'Barn thread mark set by barn staff: in_progress, implemented or not_planned. NULL = no mark. Shown on the notice board and the thread header.';
