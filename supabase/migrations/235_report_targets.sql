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
-- Before this is pasted, reporting a show entry or a Help ID post says
-- "not switched on yet"; every other report works as before.
--
-- Safe to paste twice.
-- ============================================================

ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_target_type_check;
ALTER TABLE public.user_reports ADD CONSTRAINT user_reports_target_type_check
  CHECK (target_type IN (
    'post', 'comment', 'horse', 'user', 'message',
    'show_entry', 'id_request', 'id_suggestion'
  ));
