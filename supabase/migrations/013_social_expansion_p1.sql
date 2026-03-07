-- ============================================================
-- Migration 013: Social Expansion Phase 1 — Featured Horses
-- ============================================================

CREATE TABLE IF NOT EXISTS featured_horses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  featured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE featured_horses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view featured horses"
  ON featured_horses FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_featured_horses_date ON featured_horses (featured_at DESC);
