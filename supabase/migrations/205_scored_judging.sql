-- 205: Scored judging — the scorecard (2026-09-01).
--
-- Owner's brief: a rubric so entries are "graded on a scale, not on a
-- judge's whim", per-class rubrics, scorecards per horse, radar
-- charts — shipped for this week's MHH Championship judging.
--
-- ARCHITECTURE: scores follow the CRITIQUE pattern exactly (148/v4).
-- Critiques live on the entry row, are written by judge/host/co-host
-- during judging or results review, and become visible when the
-- class publishes results (results_published_at gates the read
-- paths). Scores are the same shape with the same lifecycle, so they
-- add two columns and zero new policies — the entry's existing RLS
-- and reveal gate govern them.
--
-- The rubric is a CLASS fact: five criteria with weights, seeded
-- from the axis templates in src/lib/shows/rubrics.ts (halter /
-- performance / workmanship / collectibility / themed / other) and
-- stored denormalized so later template edits never rewrite what a
-- judged class was actually scored against. NULL rubric = the class
-- judges on the plain ribbon tray, exactly as before — scoring is
-- opt-in per class.
--
-- PASTE NOTE (deadlock of 2026-09-01): the first paste of this file
-- deadlocked — both ALTERs in one transaction take exclusive locks on
-- two hot tables while live show pages hold shared locks on them
-- crosswise. lock_timeout makes each attempt fail fast instead of
-- queueing (the queue IS the deadlock window); if a statement times
-- out, just run it again. Running the two ALTER sections as two
-- separate executions removes the cross-table window entirely.
SET lock_timeout = '4s';

ALTER TABLE show_classes ADD COLUMN IF NOT EXISTS rubric JSONB;

COMMENT ON COLUMN show_classes.rubric IS
  'Scoring rubric for this class: {key, name, criteria:[{key,label,weight,help}]}. NULL = ribbon-tray judging only. Denormalized from the app''s templates at selection time — the rubric a class was judged against never changes underneath it.';

ALTER TABLE show_class_entries
  ADD COLUMN IF NOT EXISTS score_data  JSONB,
  ADD COLUMN IF NOT EXISTS score_total NUMERIC(5,1);

COMMENT ON COLUMN show_class_entries.score_data IS
  'The judge''s criterion scores, {criterionKey: 1..10}, against the class rubric. Written like critiques (judge/host/co-host, judging or results_review), revealed like critiques (class results_published_at).';
COMMENT ON COLUMN show_class_entries.score_total IS
  'Weighted total 0–100, computed app-side from score_data × rubric weights. Stored for sorting the tray suggestion and the results view.';

CREATE INDEX IF NOT EXISTS idx_show_class_entries_scored
  ON show_class_entries (class_id, score_total DESC)
  WHERE score_total IS NOT NULL;

-- ✅ Migration 205 Complete — rubrics on classes, scores on entries
