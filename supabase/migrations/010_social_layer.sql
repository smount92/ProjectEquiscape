-- ============================================================
-- Migration 010: Social Layer — Favorites & Comments
-- ============================================================

-- =========================
-- 1. FAVORITES TABLE
-- =========================
CREATE TABLE IF NOT EXISTS horse_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_favorites ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can VIEW all favorites (for public counts)
CREATE POLICY "Anyone can view favorites"
  ON horse_favorites FOR SELECT
  TO authenticated
  USING (true);

-- Users can only INSERT their own favorites
CREATE POLICY "Users can favorite horses"
  ON horse_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only DELETE their own favorites (unfavorite)
CREATE POLICY "Users can unfavorite horses"
  ON horse_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Prevent double-favoriting
CREATE UNIQUE INDEX idx_horse_favorites_unique
  ON horse_favorites (user_id, horse_id);

-- Performance: count favorites per horse
CREATE INDEX idx_horse_favorites_horse_id
  ON horse_favorites (horse_id);

-- =========================
-- 2. COMMENTS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS horse_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can VIEW comments on public horses
CREATE POLICY "Anyone can view comments on public horses"
  ON horse_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_comments.horse_id
      AND h.is_public = true
    )
  );

-- Users can INSERT comments on public horses only
CREATE POLICY "Users can comment on public horses"
  ON horse_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_comments.horse_id
      AND h.is_public = true
    )
  );

-- Comment author OR horse owner can DELETE
CREATE POLICY "Author or horse owner can delete comments"
  ON horse_comments FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_comments.horse_id
      AND h.owner_id = auth.uid()
    )
  );

-- Performance indexes
CREATE INDEX idx_horse_comments_horse_id
  ON horse_comments (horse_id);

CREATE INDEX idx_horse_comments_user_id
  ON horse_comments (user_id);

CREATE INDEX idx_horse_comments_created_at
  ON horse_comments (horse_id, created_at);
