-- 206: The scorecard becomes part of the permanent record (2026-09-01).
--
-- Owner: "the show results add a huge value." A scorecard that lives
-- only in the class room dies with the season; one on show_records
-- rides the trophy case, the passport, and every future transfer —
-- the horse keeps its 83.5 forever, exactly like it keeps its ribbon.
--
-- scorecard carries {rubric, scores} DENORMALIZED: records outlive
-- classes, so the criteria a horse was scored against are frozen into
-- the row rather than joined from a table that may not be there in
-- five years. score_total is the sortable/displayable headline.
--
-- Paste note: run with lock_timeout (the 205 lesson) — fails fast and
-- retries cleanly instead of queueing into a deadlock.
SET lock_timeout = '4s';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS score_total NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS scorecard   JSONB;

COMMENT ON COLUMN show_records.score_total IS
  'Weighted rubric total (0-100) from scored judging (205), when the class was scored. The permanent headline number.';
COMMENT ON COLUMN show_records.scorecard IS
  'The frozen scorecard: {rubric, scores} as judged. Denormalized on purpose — records outlive classes.';

-- ✅ Migration 206 Complete — scores ride the trophy case
