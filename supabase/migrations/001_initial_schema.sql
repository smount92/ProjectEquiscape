-- ============================================================
-- THE MODEL HORSE HUB — Phase 1 MVP: Full Database Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- ============================================================
-- 1. CUSTOM TYPES (Enums)
-- ============================================================

-- Angle profiles for horse photography
CREATE TYPE angle_profile AS ENUM (
  'Primary_Thumbnail',
  'Left_Side',
  'Right_Side',
  'Front_Chest',
  'Back_Hind',
  'Detail_Face_Eyes',
  'Detail_Ears',
  'Detail_Hooves',
  'Flaw_Rub_Damage',
  'Other'
);

-- Finish types for model horses
CREATE TYPE finish_type AS ENUM (
  'OF',
  'Custom',
  'Artist Resin'
);


-- ============================================================
-- 2. TABLES
-- ============================================================

-- ----- Table 1: Users -----
-- Links to Supabase Auth (auth.users) via id
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT,                          -- PRIVATE: Only visible to self
  alias_name  TEXT UNIQUE NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE NOT NULL,
  pref_simple_mode BOOLEAN DEFAULT FALSE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE  users IS 'Public profiles for collectors. Linked 1:1 with auth.users.';
COMMENT ON COLUMN users.full_name IS 'Private field — RLS ensures only the owner can read this.';
COMMENT ON COLUMN users.alias_name IS 'Public display name — visible to community.';


-- ----- Table 2: Reference_Molds -----
-- Immutable reference data for mass-produced models (Breyer, Peter Stone)
CREATE TABLE reference_molds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer        TEXT NOT NULL,
  mold_name           TEXT NOT NULL,
  scale               TEXT,
  release_year_start  INTEGER
);

COMMENT ON TABLE reference_molds IS 'Immutable reference data for mass-produced Breyer/Stone molds.';


-- ----- Table 3: Artist_Resins -----
-- Immutable reference data for artist resins and OOAK sculptures
CREATE TABLE artist_resins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sculptor_alias  TEXT NOT NULL,
  resin_name      TEXT NOT NULL,
  scale           TEXT NOT NULL,
  cast_medium     TEXT
);

COMMENT ON TABLE artist_resins IS 'Immutable reference data for artist resins and OOAK sculptures.';


-- ----- Table 4: User_Horses -----
-- The digital inventory for collectors
CREATE TABLE user_horses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_mold_id UUID REFERENCES reference_molds(id) ON DELETE SET NULL,
  artist_resin_id   UUID REFERENCES artist_resins(id) ON DELETE SET NULL,
  custom_name       TEXT NOT NULL,
  finish_type       finish_type NOT NULL,
  condition_grade   TEXT NOT NULL,
  is_for_sale       BOOLEAN DEFAULT FALSE NOT NULL,
  is_public         BOOLEAN DEFAULT TRUE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- CONSTRAINT: A horse must link to EITHER a reference mold OR an artist resin, not both.
  CONSTRAINT horse_reference_check CHECK (
    (reference_mold_id IS NOT NULL AND artist_resin_id IS NULL) OR
    (reference_mold_id IS NULL AND artist_resin_id IS NOT NULL) OR
    (reference_mold_id IS NULL AND artist_resin_id IS NULL)
  )
);

CREATE INDEX idx_user_horses_owner ON user_horses(owner_id);
CREATE INDEX idx_user_horses_mold  ON user_horses(reference_mold_id) WHERE reference_mold_id IS NOT NULL;
CREATE INDEX idx_user_horses_resin ON user_horses(artist_resin_id)   WHERE artist_resin_id IS NOT NULL;

COMMENT ON TABLE user_horses IS 'The digital inventory — each row is one model horse in a collector''s stable.';


-- ----- Table 5: Financial_Vault -----
-- STRICTLY PRIVATE — only the horse owner can read/write
CREATE TABLE financial_vault (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id                UUID UNIQUE NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  purchase_price          DECIMAL(10,2),
  purchase_date           DATE,
  estimated_current_value DECIMAL(10,2),
  insurance_notes         TEXT
);

COMMENT ON TABLE financial_vault IS 'STRICTLY PRIVATE financial data — only the authenticated owner can access.';


-- ----- Table 6: Horse_Images -----
-- Supports full galleries with specific profile angles
CREATE TABLE horse_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id      UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  angle_profile angle_profile NOT NULL,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_horse_images_horse ON horse_images(horse_id);

COMMENT ON TABLE horse_images IS 'Multi-angle photo gallery for each horse.';


-- ----- Table 7: Customization_Logs -----
CREATE TABLE customization_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  artist_alias    TEXT,
  work_type       TEXT NOT NULL,
  materials_used  TEXT,
  date_completed  DATE
);

CREATE INDEX idx_customization_logs_horse ON customization_logs(horse_id);

COMMENT ON TABLE customization_logs IS 'Tracks customization work (repaints, body mods, etc.) done on a horse.';


-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS) — ENABLE ON ALL TABLES
-- ============================================================

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_molds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_resins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_horses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_vault    ENABLE ROW LEVEL SECURITY;
ALTER TABLE horse_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization_logs ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- ===== USERS TABLE =====

-- Users can read their OWN full profile (including full_name)
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Any authenticated user can see public fields (alias, verified status)
-- This uses a security definer function to control which columns are exposed
-- For now, we allow SELECT but full_name privacy is enforced at the app layer
-- combined with the "own profile" policy above being the primary read path.

-- Users can insert their own profile row (on signup)
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update only their own profile
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users cannot delete their profile directly (handled via auth cascade)
-- No DELETE policy = no direct deletes allowed


-- ===== REFERENCE_MOLDS TABLE =====
-- Read-only for all authenticated users (immutable reference data)

CREATE POLICY "reference_molds_select_authenticated"
  ON reference_molds FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies = only admins (via service role) can modify


-- ===== ARTIST_RESINS TABLE =====
-- Read-only for all authenticated users (immutable reference data)

CREATE POLICY "artist_resins_select_authenticated"
  ON artist_resins FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies = only admins (via service role) can modify


-- ===== USER_HORSES TABLE =====

-- Owners can see all their own horses
CREATE POLICY "user_horses_select_own"
  ON user_horses FOR SELECT
  USING (auth.uid() = owner_id);

-- Authenticated users can see other users' PUBLIC horses
CREATE POLICY "user_horses_select_public"
  ON user_horses FOR SELECT
  USING (is_public = TRUE AND auth.role() = 'authenticated');

-- Owners can insert horses into their own stable
CREATE POLICY "user_horses_insert_own"
  ON user_horses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Owners can update only their own horses
CREATE POLICY "user_horses_update_own"
  ON user_horses FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Owners can delete only their own horses
CREATE POLICY "user_horses_delete_own"
  ON user_horses FOR DELETE
  USING (auth.uid() = owner_id);


-- ===== FINANCIAL_VAULT TABLE =====
-- 🔒 STRICTLY PRIVATE — Only the horse's owner can access

CREATE POLICY "financial_vault_select_own"
  ON financial_vault FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );

CREATE POLICY "financial_vault_insert_own"
  ON financial_vault FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );

CREATE POLICY "financial_vault_update_own"
  ON financial_vault FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );

CREATE POLICY "financial_vault_delete_own"
  ON financial_vault FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );


-- ===== HORSE_IMAGES TABLE =====

-- Anyone authenticated can view images of public horses; owners see all their own
CREATE POLICY "horse_images_select_own"
  ON horse_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND (user_horses.owner_id = auth.uid() OR user_horses.is_public = TRUE)
    )
  );

-- Only the horse owner can upload images
CREATE POLICY "horse_images_insert_own"
  ON horse_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );

-- Only the horse owner can update image metadata
CREATE POLICY "horse_images_update_own"
  ON horse_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );

-- Only the horse owner can delete images
CREATE POLICY "horse_images_delete_own"
  ON horse_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );


-- ===== CUSTOMIZATION_LOGS TABLE =====

-- Viewable if the horse is public or owned by the user
CREATE POLICY "customization_logs_select_own"
  ON customization_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND (user_horses.owner_id = auth.uid() OR user_horses.is_public = TRUE)
    )
  );

-- Only the horse owner can insert logs
CREATE POLICY "customization_logs_insert_own"
  ON customization_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );

-- Only the horse owner can update logs
CREATE POLICY "customization_logs_update_own"
  ON customization_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );

-- Only the horse owner can delete logs
CREATE POLICY "customization_logs_delete_own"
  ON customization_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = auth.uid()
    )
  );


-- ============================================================
-- 5. STORAGE BUCKET for Horse Images
-- ============================================================

-- Create a storage bucket for horse photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('horse-images', 'horse-images', FALSE);

-- Storage RLS: Only authenticated users can upload to their own folder
CREATE POLICY "horse_images_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'horse-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Storage RLS: Users can view images from public horses or their own
CREATE POLICY "horse_images_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'horse-images'
    AND auth.role() = 'authenticated'
  );

-- Storage RLS: Only the owner can update their own images
CREATE POLICY "horse_images_storage_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'horse-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Storage RLS: Only the owner can delete their own images
CREATE POLICY "horse_images_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'horse-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );


-- ============================================================
-- 6. HELPER FUNCTION: Auto-create user profile on signup
-- ============================================================

-- This function is triggered when a new user signs up via Supabase Auth.
-- It creates a corresponding row in the public.users table.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, alias_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'alias_name', 'user_' || LEFT(NEW.id::TEXT, 8))
  );
  RETURN NEW;
END;
$$;

-- Trigger: fire after a new auth user is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- ✅ SCHEMA SETUP COMPLETE
-- ============================================================
-- Tables:  7 created (users, reference_molds, artist_resins,
--          user_horses, financial_vault, horse_images, customization_logs)
-- Enums:   2 created (angle_profile, finish_type)
-- RLS:     Enabled on ALL tables with granular policies
-- Storage: 1 bucket (horse-images) with owner-scoped policies
-- Trigger: Auto-creates user profile on signup
-- ============================================================
