-- ============================================================
-- Migration 030: Competition Engine — Judge Roles, NAN Tracking,
--                Show String Planner, Enhanced Show Records
-- ============================================================

-- ── 1. User Roles ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'judge', 'admin'));

COMMENT ON COLUMN users.role IS 'User role for platform-level permissions. Judges can verify show records.';

-- ── 2. Enhanced Show Records ──
-- Add columns for NAN tracking and verification
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS show_type TEXT DEFAULT 'photo_other'
  CHECK (show_type IN (
    'live_namhsa', 'live_regional', 'photo_mepsa',
    'photo_mhh', 'photo_other', 'virtual_other'
  ));
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS sanctioning_body TEXT;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS class_name TEXT;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS total_entries INTEGER;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS is_nan_qualifying BOOLEAN DEFAULT false;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS nan_card_type TEXT
  CHECK (nan_card_type IN ('green', 'yellow', 'pink', NULL));
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS nan_year INTEGER;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'self_reported'
  CHECK (verification_tier IN ('self_reported', 'host_verified', 'mhh_auto'));
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS judge_critique TEXT;

-- NAN qualification index
CREATE INDEX IF NOT EXISTS idx_show_records_nan
  ON show_records (horse_id, nan_year, nan_card_type)
  WHERE is_nan_qualifying = true;

-- ── 3. Show String Planner ──
CREATE TABLE IF NOT EXISTS show_strings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  show_date   DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE show_strings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own show strings"
  ON show_strings FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner creates show strings"
  ON show_strings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner updates own show strings"
  ON show_strings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner deletes own show strings"
  ON show_strings FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS show_string_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_string_id  UUID NOT NULL REFERENCES show_strings(id) ON DELETE CASCADE,
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  class_name      TEXT NOT NULL,
  division        TEXT,
  time_slot       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE show_string_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entries follow show string ownership"
  ON show_string_entries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM show_strings s
    WHERE s.id = show_string_entries.show_string_id
      AND s.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Owner adds entries"
  ON show_string_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM show_strings s
    WHERE s.id = show_string_entries.show_string_id
      AND s.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Owner updates entries"
  ON show_string_entries FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM show_strings s
    WHERE s.id = show_string_entries.show_string_id
      AND s.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Owner deletes entries"
  ON show_string_entries FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM show_strings s
    WHERE s.id = show_string_entries.show_string_id
      AND s.user_id = (SELECT auth.uid())
  ));

CREATE INDEX idx_show_strings_user ON show_strings (user_id);
CREATE INDEX idx_show_string_entries_string ON show_string_entries (show_string_id);
CREATE INDEX idx_show_string_entries_horse ON show_string_entries (horse_id);

-- ── 4. Enhanced Shows (NAN sanctioning + judge critiques) ──
ALTER TABLE photo_shows ADD COLUMN IF NOT EXISTS is_nan_qualifying BOOLEAN DEFAULT false;
ALTER TABLE photo_shows ADD COLUMN IF NOT EXISTS sanctioning_body TEXT;
ALTER TABLE show_entries ADD COLUMN IF NOT EXISTS judge_critique TEXT;
ALTER TABLE show_entries ADD COLUMN IF NOT EXISTS judge_score DECIMAL(5,2);
ALTER TABLE show_entries ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT 'General';

-- ============================================================
-- ✅ Migration 030 Complete
-- Added: User roles, NAN tracking, show string planner,
--        enhanced show/entry fields
-- ============================================================
