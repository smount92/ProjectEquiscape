-- 213: Papers (2026-09-19).
--
-- From the suggestion box, by our first annual Studio Pro member: a
-- place for breeding certificates — scans of the old paper ones and
-- the digital ones — plus links to the sire's and dam's own pages
-- (the hobby's sire/dam lists live on members' own sites) and a
-- summary of the horse. Documentation (148/209) already carries the
-- summary and links; this adds the files and the pedigree links.
--
-- Certificates often name other hobbyists, so the files live in a
-- PRIVATE bucket and are served through server-minted signed URLs,
-- only when the passport itself is public (or to the owner).
--
-- Paste as one run; each statement stands alone (205 lesson).
SET lock_timeout = '4s';

-- ── 1. The sire and dam have pages of their own ─────────────────────
ALTER TABLE horse_pedigrees
  ADD COLUMN IF NOT EXISTS sire_url TEXT CHECK (sire_url IS NULL OR char_length(sire_url) <= 500);
ALTER TABLE horse_pedigrees
  ADD COLUMN IF NOT EXISTS dam_url TEXT CHECK (dam_url IS NULL OR char_length(dam_url) <= 500);
-- The breeding program the certificate came from ("Starrfyre").
ALTER TABLE horse_pedigrees
  ADD COLUMN IF NOT EXISTS bred_by TEXT CHECK (bred_by IS NULL OR char_length(bred_by) <= 120);

COMMENT ON COLUMN horse_pedigrees.sire_url IS 'The sire''s own page — a sire/dam list, a registry entry (213). https only; the app normalises.';
COMMENT ON COLUMN horse_pedigrees.dam_url IS 'The dam''s own page (213).';
COMMENT ON COLUMN horse_pedigrees.bred_by IS 'The breeding program / stable named on the certificate (213).';

-- ── 2. The papers themselves ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.horse_papers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'breeding_certificate'
              CHECK (kind IN ('breeding_certificate', 'registration', 'pedigree_chart', 'other')),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  -- Who issued it (the breeding program, the registry) and when.
  issued_by   TEXT CHECK (issued_by IS NULL OR char_length(issued_by) <= 120),
  issued_on   DATE,
  notes       TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  -- Storage object in the private horse-papers bucket:
  --   {owner_id}/{horse_id}/{uuid}.{webp|pdf|…}
  file_path   TEXT NOT NULL UNIQUE,
  mime        TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf')),
  byte_size   INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  -- Shown on the public passport; off = the owner's eyes only.
  is_public   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.horse_papers IS
  'Breeding certificates, registration papers and pedigree charts filed on a horse (213). Files live in the private horse-papers bucket; the app mints signed URLs when the passport is visible.';

CREATE INDEX IF NOT EXISTS idx_horse_papers_horse ON public.horse_papers (horse_id, sort_order, created_at);

ALTER TABLE public.horse_papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own papers" ON public.horse_papers;
CREATE POLICY "Owner manages own papers"
  ON public.horse_papers FOR ALL
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- Readable exactly when the passport is (150) and the owner chose to show it.
DROP POLICY IF EXISTS "Papers visible on public horses" ON public.horse_papers;
CREATE POLICY "Papers visible on public horses"
  ON public.horse_papers FOR SELECT
  TO authenticated, anon
  USING (
    is_public
    AND EXISTS (
      SELECT 1 FROM public.user_horses h
      WHERE h.id = horse_papers.horse_id
        AND h.visibility IN ('public', 'unlisted')
        AND h.deleted_at IS NULL
    )
  );

GRANT SELECT ON public.horse_papers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horse_papers TO authenticated;

-- ── 3. The private bucket ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'horse-papers',
    'horse-papers',
    false,                -- PRIVATE — reads via server-minted signed URLs
    10485760,             -- 10MB per file
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Upload / delete into your own folder only: {user_id}/{horse_id}/…
DROP POLICY IF EXISTS "horse_papers_upload_own" ON storage.objects;
CREATE POLICY "horse_papers_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'horse-papers'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "horse_papers_read_own" ON storage.objects;
CREATE POLICY "horse_papers_read_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'horse-papers'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "horse_papers_delete_own" ON storage.objects;
CREATE POLICY "horse_papers_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'horse-papers'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- ✅ Migration 213 Complete — papers on the passport
