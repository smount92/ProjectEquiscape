-- ============================================================
-- Migration 011: Provenance Tracking — Show Records & Pedigrees
-- ============================================================

-- =========================
-- 1. SHOW RECORDS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS show_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_name       TEXT NOT NULL,
  show_date       DATE,
  division        TEXT,
  "placing"       TEXT,
  ribbon_color    TEXT,
  judge_name      TEXT,
  is_nan          BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE show_records ENABLE ROW LEVEL SECURITY;

-- Public viewing: anyone can see records on public horses
CREATE POLICY "Anyone can view show records on public horses"
  ON show_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = show_records.horse_id
      AND h.is_public = true
    )
  );

-- Owner can also view records on private horses
CREATE POLICY "Owner can view own show records"
  ON show_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Owner inserts records for their own horses
CREATE POLICY "Owner can add show records"
  ON show_records FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = show_records.horse_id
      AND h.owner_id = auth.uid()
    )
  );

-- Owner can update
CREATE POLICY "Owner can update own show records"
  ON show_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner can delete
CREATE POLICY "Owner can delete own show records"
  ON show_records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX idx_show_records_horse_id
  ON show_records (horse_id);

CREATE INDEX idx_show_records_user_id
  ON show_records (user_id);

CREATE INDEX idx_show_records_date
  ON show_records (horse_id, show_date DESC NULLS LAST);

-- =========================
-- 2. PEDIGREE CARD TABLE
-- =========================
CREATE TABLE IF NOT EXISTS horse_pedigrees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sire_name       TEXT,
  dam_name        TEXT,
  sculptor        TEXT,
  cast_number     TEXT,
  edition_size    TEXT,
  lineage_notes   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_pedigrees ENABLE ROW LEVEL SECURITY;

-- Public viewing
CREATE POLICY "Anyone can view pedigree on public horses"
  ON horse_pedigrees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_pedigrees.horse_id
      AND h.is_public = true
    )
  );

-- Owner can view on private horses
CREATE POLICY "Owner can view own pedigree"
  ON horse_pedigrees FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Owner can insert (one per horse)
CREATE POLICY "Owner can add pedigree"
  ON horse_pedigrees FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_pedigrees.horse_id
      AND h.owner_id = auth.uid()
    )
  );

-- Owner can update
CREATE POLICY "Owner can update own pedigree"
  ON horse_pedigrees FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner can delete
CREATE POLICY "Owner can delete own pedigree"
  ON horse_pedigrees FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enforce 1-to-1: each horse gets at most one pedigree card
CREATE UNIQUE INDEX idx_horse_pedigrees_unique
  ON horse_pedigrees (horse_id);

CREATE INDEX idx_horse_pedigrees_user_id
  ON horse_pedigrees (user_id);
