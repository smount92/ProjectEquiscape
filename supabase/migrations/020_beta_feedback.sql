-- ============================================================
-- Migration 020: Beta Feedback — Finishing Artist + Edition Info
-- ============================================================

-- ── 1. Finishing artist (who painted/finished the model) ──
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS finishing_artist TEXT;

COMMENT ON COLUMN user_horses.finishing_artist IS 'Name of the artist who painted/finished/customized this model.';

-- ── 2. Edition info (e.g., "3 of 50") ──
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS edition_number INTEGER;

ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS edition_size INTEGER;

COMMENT ON COLUMN user_horses.edition_number IS 'This model''s number in a limited edition run (e.g., 3 of 50).';
COMMENT ON COLUMN user_horses.edition_size IS 'Total number produced in this edition.';

-- ── 3. Database suggestions table (user-submitted entries) ──
CREATE TABLE IF NOT EXISTS database_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('mold', 'release', 'resin')),
  name         TEXT NOT NULL,
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE database_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can see their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON database_suggestions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

-- Users can insert suggestions
CREATE POLICY "Users can submit suggestions"
  ON database_suggestions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE INDEX idx_suggestions_status ON database_suggestions(status);
CREATE INDEX idx_suggestions_user ON database_suggestions(submitted_by);
