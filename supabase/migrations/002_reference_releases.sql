-- ============================================================
-- MIGRATION 002: Reference Releases (Paint Jobs / Specific Models)
-- Adds a cascading relationship: Reference_Molds → Reference_Releases
-- ============================================================

-- ----- New Table: Reference_Releases -----
-- Specific paint jobs / model releases tied to a base mold
CREATE TABLE reference_releases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mold_id             UUID NOT NULL REFERENCES reference_molds(id) ON DELETE CASCADE,
  model_number        TEXT,                       -- e.g. '1482'
  release_name        TEXT NOT NULL,              -- e.g. 'Full Moon Rising'
  color_description   TEXT,                       -- e.g. 'Chestnut Pinto'
  release_year_start  INTEGER,
  release_year_end    INTEGER
);

CREATE INDEX idx_reference_releases_mold ON reference_releases(mold_id);

COMMENT ON TABLE reference_releases IS 'Specific paint jobs / model numbers tied to a base mold (Reference_Molds).';
COMMENT ON COLUMN reference_releases.model_number IS 'Breyer catalog number, e.g. #1482.';
COMMENT ON COLUMN reference_releases.release_name IS 'Official release name, e.g. Full Moon Rising.';
COMMENT ON COLUMN reference_releases.color_description IS 'Color/pattern description, e.g. Chestnut Pinto.';


-- ----- Alter User_Horses: Add release_id FK -----
ALTER TABLE user_horses
  ADD COLUMN release_id UUID REFERENCES reference_releases(id) ON DELETE SET NULL;

CREATE INDEX idx_user_horses_release ON user_horses(release_id) WHERE release_id IS NOT NULL;


-- ----- RLS for Reference_Releases -----
ALTER TABLE reference_releases ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users (immutable reference data)
CREATE POLICY "reference_releases_select_authenticated"
  ON reference_releases FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies = only admins (via service role) can modify


-- ============================================================
-- SEED: Sample Reference Releases
-- A handful of well-known releases to populate the cascading dropdown
-- ============================================================

-- Get mold IDs dynamically by name for seed data
DO $$
DECLARE
  v_adios          UUID;
  v_fighting       UUID;
  v_man_o_war      UUID;
  v_lady_phase     UUID;
  v_ruffian        UUID;
  v_secretariat    UUID;
  v_indian_pony    UUID;
  v_western_horse  UUID;
  v_midnight_sun   UUID;
  v_san_domingo    UUID;
  v_proud_arab_s   UUID;
  v_clydesdale_s   UUID;
  v_running_mare   UUID;
  v_five_gaiter    UUID;
  v_fury_prancer   UUID;
  v_hanoverian     UUID;
BEGIN
  SELECT id INTO v_adios         FROM reference_molds WHERE mold_name = 'Adios' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_fighting      FROM reference_molds WHERE mold_name = 'Fighting Stallion' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_man_o_war     FROM reference_molds WHERE mold_name = 'Man O War' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_lady_phase    FROM reference_molds WHERE mold_name = 'Lady Phase' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_ruffian       FROM reference_molds WHERE mold_name = 'Ruffian' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_secretariat   FROM reference_molds WHERE mold_name = 'Secretariat' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_indian_pony   FROM reference_molds WHERE mold_name = 'Indian Pony' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_western_horse FROM reference_molds WHERE mold_name = 'Western Horse' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_midnight_sun  FROM reference_molds WHERE mold_name = 'Midnight Sun' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_san_domingo   FROM reference_molds WHERE mold_name = 'San Domingo' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_proud_arab_s  FROM reference_molds WHERE mold_name = 'Proud Arabian Stallion' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_clydesdale_s  FROM reference_molds WHERE mold_name = 'Clydesdale Stallion' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_running_mare  FROM reference_molds WHERE mold_name = 'Running Mare' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_five_gaiter   FROM reference_molds WHERE mold_name = 'Five-Gaiter' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_fury_prancer  FROM reference_molds WHERE mold_name = 'Fury Prancer' AND manufacturer = 'Breyer' LIMIT 1;
  SELECT id INTO v_hanoverian    FROM reference_molds WHERE mold_name = 'Hanoverian' AND manufacturer = 'Breyer' LIMIT 1;

  -- Adios releases
  IF v_adios IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_adios, '50', 'Adios Famous Standardbred', 'Palomino', 1969, 1990),
      (v_adios, '51', 'Best of the West Shadow', 'Bay', 1972, 1973),
      (v_adios, '854', 'El Pastor', 'Dapple Grey', 1987, 1988),
      (v_adios, '903', 'Full Moon Rising', 'Chestnut Pinto', 1995, 1996);
  END IF;

  -- Fighting Stallion releases
  IF v_fighting IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_fighting, '31', 'Fighting Stallion', 'Charcoal', 1961, 1967),
      (v_fighting, '35', 'Diablo', 'Alabaster', 1961, 1987),
      (v_fighting, '32', 'Fighting Stallion', 'Woodgrain', 1961, 1965),
      (v_fighting, '835', 'Monarch', 'Bay Blanket Appaloosa', 1991, 1993);
  END IF;

  -- Man O War releases
  IF v_man_o_war IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_man_o_war, '47', 'Man O'' War', 'Chestnut', 1967, 1995),
      (v_man_o_war, '847', 'Seabiscuit', 'Bay', 1989, 1990),
      (v_man_o_war, '924', 'Affirmed', 'Dark Chestnut', 1998, 1999);
  END IF;

  -- Lady Phase releases
  IF v_lady_phase IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_lady_phase, '40', 'Lady Phase', 'Bay', 1976, 1985),
      (v_lady_phase, '880', 'Khamjar', 'Liver Chestnut', 1993, 1994),
      (v_lady_phase, '700403', 'Lady Phase', 'Alabaster', 2003, 2005);
  END IF;

  -- Ruffian releases
  IF v_ruffian IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_ruffian, '606', 'Ruffian', 'Dark Bay', 1977, 1990),
      (v_ruffian, '806', 'Bold Forbes', 'Red Bay', 1988, 1989);
  END IF;

  -- Secretariat releases
  IF v_secretariat IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_secretariat, '435', 'Secretariat', 'Chestnut', 1987, 2007),
      (v_secretariat, '725', 'Secretariat 35th Anniversary', 'Chestnut with Blanket', 2003, 2003);
  END IF;

  -- Indian Pony releases
  IF v_indian_pony IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_indian_pony, '175', 'Indian Pony', 'Bay Pinto', 1970, 1971),
      (v_indian_pony, '176', 'Indian Pony', 'Black Pinto', 1970, 1971),
      (v_indian_pony, '177', 'Indian Pony', 'Buckskin War Paint', 1970, 1971);
  END IF;

  -- Western Horse releases
  IF v_western_horse IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_western_horse, '57', 'Western Horse', 'Palomino', 1950, 1974),
      (v_western_horse, '56', 'Western Horse', 'Black Pinto', 1954, 1974);
  END IF;

  -- Midnight Sun
  IF v_midnight_sun IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_midnight_sun, '60', 'Midnight Sun', 'Chestnut', 1988, 1990);
  END IF;

  -- San Domingo
  IF v_san_domingo IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_san_domingo, '67', 'San Domingo', 'Bay Overo Pinto', 1978, 1987),
      (v_san_domingo, '880', 'Sherman Morgan', 'Dark Bay', 1987, 1988);
  END IF;

  -- Proud Arabian Stallion
  IF v_proud_arab_s IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_proud_arab_s, '211', 'Proud Arabian Stallion', 'Mahogany Bay', 1972, 1988),
      (v_proud_arab_s, '215', 'Proud Arabian Stallion', 'Dapple Grey', 1972, 1988),
      (v_proud_arab_s, '815', 'El Pastor', 'Alabaster', 1986, 1988);
  END IF;

  -- Clydesdale Stallion
  IF v_clydesdale_s IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_clydesdale_s, '80', 'Clydesdale Stallion', 'Bay', 1969, 1989),
      (v_clydesdale_s, '83', 'King of the Wind Set', 'Dapple Grey', 1990, 1993);
  END IF;

  -- Running Mare
  IF v_running_mare IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_running_mare, '124', 'Running Mare', 'Sorrel', 1963, 1971),
      (v_running_mare, '120', 'Running Mare', 'Bay', 1963, 1987);
  END IF;

  -- Five-Gaiter
  IF v_five_gaiter IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_five_gaiter, '52', 'Five-Gaiter', 'Sorrel', 1963, 1986),
      (v_five_gaiter, '53', 'Five-Gaiter Commander', 'Alabaster', 1963, 1987);
  END IF;

  -- Fury Prancer
  IF v_fury_prancer IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_fury_prancer, '44', 'Fury Prancer', 'Black', 1956, 1965),
      (v_fury_prancer, '43', 'Fury Prancer', 'Smoke', 1960, 1966);
  END IF;

  -- Hanoverian
  IF v_hanoverian IS NOT NULL THEN
    INSERT INTO reference_releases (mold_id, model_number, release_name, color_description, release_year_start, release_year_end) VALUES
      (v_hanoverian, '58', 'Hanoverian', 'Bay', 1980, 1984),
      (v_hanoverian, '862', 'Snowbound', 'Dapple Grey Blanket Appaloosa', 1992, 1993);
  END IF;

  RAISE NOTICE 'Seed complete. Missing molds were skipped.';
END $$;


-- ============================================================
-- ✅ Migration 002 Complete
-- New table:  reference_releases (with RLS)
-- Altered:    user_horses (added release_id FK)
-- Seeded:     ~45 sample releases across 16 popular molds
-- ============================================================
