-- 220: Which import a show record came from (2026-09-21).
--
-- The spreadsheet import lands dozens of records in one go; when the
-- file was wrong, the owner needs one "undo this import" rather than
-- dozens of single deletes. Every imported record carries the batch id
-- its import minted; the manual form leaves it NULL. Undo deletes the
-- owner's own records with that batch id, for seven days after the
-- import. Before this is pasted the import still lands, just without
-- an undo (the app says so).

ALTER TABLE public.show_records
  ADD COLUMN IF NOT EXISTS import_batch UUID;

CREATE INDEX IF NOT EXISTS idx_show_records_import_batch
  ON public.show_records (import_batch)
  WHERE import_batch IS NOT NULL;

COMMENT ON COLUMN public.show_records.import_batch IS
  'Set by the spreadsheet import: the batch this record arrived in, so one undo can remove the whole file. NULL for records entered by hand or minted by a show.';
