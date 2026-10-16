-- ============================================================
-- 239: HOTFIX - horses and posts load their member again
--
-- Release 2 (2026-10-16). Paste as soon as possible.
--
-- 235 gave user_horses.moderation_hidden_by and posts.hidden_by (and the
-- Help ID tables' hidden_by) a foreign key to public.users. user_horses and
-- posts already point at users (the owner, the author), so every query that
-- loads "the horse with its owner" or "the post with its author" became
-- ambiguous, and the API refuses it (PGRST201: "more than one relationship
-- was found"). Stables, the feed, barn threads and other pages that read
-- them fail until this is pasted.
--
-- The fix keeps every column and every value; it only drops the four new
-- foreign keys. They were bookkeeping (which admin hid it), not something
-- any page joins on. The API reloads its schema at the end, so pages work
-- the moment this finishes.
--
-- Safe to paste twice.
-- ============================================================

ALTER TABLE public.user_horses   DROP CONSTRAINT IF EXISTS user_horses_moderation_hidden_by_fkey;
ALTER TABLE public.posts         DROP CONSTRAINT IF EXISTS posts_hidden_by_fkey;
ALTER TABLE public.id_requests   DROP CONSTRAINT IF EXISTS id_requests_hidden_by_fkey;
ALTER TABLE public.id_suggestions DROP CONSTRAINT IF EXISTS id_suggestions_hidden_by_fkey;

NOTIFY pgrst, 'reload schema';
