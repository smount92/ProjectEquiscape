-- 138: show_records.show_id — let trophy-case rows link back to the
-- v2 show that generated them (POLISH-4 / audit "show records never
-- store the originating show id").
--
-- Nullable by design: self-reported and legacy rows have no source
-- show. ON DELETE SET NULL — deleting a show must never destroy a
-- horse's trophy-case history (records outlive shows; the link is
-- provenance, not ownership).
--
-- APPLY BEFORE merging the feat/show-record-links branch, then run
-- gen-types (the branch ships a hand-patched interim type per the
-- DEBT-7 convention).

ALTER TABLE public.show_records
    ADD COLUMN IF NOT EXISTS show_id uuid
        REFERENCES public.shows(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_show_records_show_id
    ON public.show_records (show_id)
    WHERE show_id IS NOT NULL;

COMMENT ON COLUMN public.show_records.show_id IS
    'Originating v2 show (platform_generated rows only); NULL for self-reported and legacy records.';

-- Backfill: platform_generated rows can be matched to their show by
-- exact title + date (the only key the legacy shape stored). Safe to
-- run repeatedly; only touches rows still NULL and skips ambiguous
-- titles (two shows with the same title+date stay unlinked).
UPDATE public.show_records sr
SET show_id = s.id
FROM public.shows s
WHERE sr.show_id IS NULL
  AND sr.verification_tier = 'platform_generated'
  AND s.title = sr.show_name
  AND NOT EXISTS (
      SELECT 1 FROM public.shows s2
      WHERE s2.title = s.title AND s2.id <> s.id
  );
