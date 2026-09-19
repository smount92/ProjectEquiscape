-- 214: Papers attach to records; Other accomplishments (2026-09-19).
--
-- Follow-up from the member whose suggestion built Papers (213), after
-- filing a certificate:
--   • attachments on show records — NAN cards, show photos;
--   • a section for accomplishments that aren't show placings — race
--     records with the Express and the FTRA (formerly MRF).
--
-- Papers stay ONE folder per horse; a paper may now point at the show
-- record or the accomplishment it belongs to, and the passport shows it
-- in both places. Nothing here is required by the app before the paste.
--
-- Paste as one run; each statement stands alone (205 lesson).
SET lock_timeout = '4s';

-- ── 1. Other accomplishments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.horse_accomplishments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id      UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- racing (Express, FTRA), performance, breeding (a breeding granted /
  -- foal produced), award, other
  kind          TEXT NOT NULL DEFAULT 'other'
                CHECK (kind IN ('racing', 'performance', 'breeding', 'award', 'other')),
  -- "Express", "FTRA" — the body that keeps the record.
  organization  TEXT CHECK (organization IS NULL OR char_length(organization) <= 120),
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  -- "2nd of 9, Autumn Classic (6f)" — the result in the member's words.
  result        TEXT CHECK (result IS NULL OR char_length(result) <= 160),
  happened_on   DATE,
  -- "Spring 2024" when the day isn't known; the DATE gets the first of it.
  date_text     TEXT CHECK (date_text IS NULL OR char_length(date_text) <= 40),
  detail        TEXT CHECK (detail IS NULL OR char_length(detail) <= 2000),
  link_url      TEXT CHECK (link_url IS NULL OR char_length(link_url) <= 500),
  is_public     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.horse_accomplishments IS
  'What a horse did that is not a show placing: race records, performance, breedings, awards (214). Owner-kept; shown on the passport under Other accomplishments.';

CREATE INDEX IF NOT EXISTS idx_horse_accomplishments_horse
  ON public.horse_accomplishments (horse_id, happened_on DESC NULLS LAST, created_at);

ALTER TABLE public.horse_accomplishments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own accomplishments" ON public.horse_accomplishments;
CREATE POLICY "Owner manages own accomplishments"
  ON public.horse_accomplishments FOR ALL
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Accomplishments visible on public horses" ON public.horse_accomplishments;
CREATE POLICY "Accomplishments visible on public horses"
  ON public.horse_accomplishments FOR SELECT
  TO authenticated, anon
  USING (
    is_public
    AND EXISTS (
      SELECT 1 FROM public.user_horses h
      WHERE h.id = horse_accomplishments.horse_id
        AND h.visibility IN ('public', 'unlisted')
        AND h.deleted_at IS NULL
    )
  );

GRANT SELECT ON public.horse_accomplishments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horse_accomplishments TO authenticated;

-- ── 2. Papers point at what they document ───────────────────────────
ALTER TABLE public.horse_papers
  ADD COLUMN IF NOT EXISTS show_record_id UUID REFERENCES show_records(id) ON DELETE SET NULL;
ALTER TABLE public.horse_papers
  ADD COLUMN IF NOT EXISTS accomplishment_id UUID REFERENCES public.horse_accomplishments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_horse_papers_show_record
  ON public.horse_papers (show_record_id) WHERE show_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_horse_papers_accomplishment
  ON public.horse_papers (accomplishment_id) WHERE accomplishment_id IS NOT NULL;

-- New kinds for what gets attached to a record: the card a show
-- issued, a photo from the show, an award.
ALTER TABLE public.horse_papers DROP CONSTRAINT IF EXISTS horse_papers_kind_check;
ALTER TABLE public.horse_papers ADD CONSTRAINT horse_papers_kind_check
  CHECK (kind IN (
    'breeding_certificate', 'registration', 'pedigree_chart',
    'qualification_card', 'show_photo', 'award', 'other'
  ));

COMMENT ON COLUMN public.horse_papers.show_record_id IS 'The show record this paper documents — a NAN/OMEQ card, a show photo (214).';
COMMENT ON COLUMN public.horse_papers.accomplishment_id IS 'The accomplishment this paper documents — a race chart, a certificate (214).';

-- ✅ Migration 214 Complete — papers attach to records; other accomplishments
