-- ============================================================
-- Migration 012: User-to-User Ratings (Transaction Feedback)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_ratings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reviewer_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars             SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  review_text       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- One rating per user per conversation (can rate buyer or seller once)
CREATE UNIQUE INDEX idx_user_ratings_unique
  ON user_ratings (conversation_id, reviewer_id);

-- Anyone authenticated can view ratings (public trust signal)
CREATE POLICY "Anyone can view ratings"
  ON user_ratings FOR SELECT
  TO authenticated
  USING (true);

-- Reviewer can insert (one per conversation — enforced by unique index)
CREATE POLICY "Reviewer can add rating"
  ON user_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND reviewer_id != reviewed_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = user_ratings.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- Reviewer can delete (retract their own rating)
CREATE POLICY "Reviewer can retract own rating"
  ON user_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = reviewer_id);

-- Performance indexes
CREATE INDEX idx_user_ratings_reviewer
  ON user_ratings (reviewer_id);

CREATE INDEX idx_user_ratings_reviewed
  ON user_ratings (reviewed_id);

CREATE INDEX idx_user_ratings_conversation
  ON user_ratings (conversation_id);
