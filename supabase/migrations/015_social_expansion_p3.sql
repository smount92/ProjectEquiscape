-- ============================================================
-- Migration 015: Social Expansion Phase 3 — Follows + Activity Feed
-- ============================================================

-- ── User Follows ──
CREATE TABLE IF NOT EXISTS user_follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can see who follows whom (public social graph)
CREATE POLICY "Anyone can view follows"
  ON user_follows FOR SELECT TO authenticated USING (true);

-- Users can follow others
CREATE POLICY "Users can follow"
  ON user_follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
  ON user_follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

CREATE UNIQUE INDEX idx_user_follows_unique ON user_follows (follower_id, following_id);
CREATE INDEX idx_user_follows_follower ON user_follows (follower_id);
CREATE INDEX idx_user_follows_following ON user_follows (following_id);

-- ── Activity Events ──
CREATE TABLE IF NOT EXISTS activity_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  horse_id    UUID REFERENCES user_horses(id) ON DELETE CASCADE,
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Anyone can view public activity
CREATE POLICY "Anyone can view public activity"
  ON activity_events FOR SELECT TO authenticated
  USING (
    horse_id IS NULL OR EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = activity_events.horse_id AND h.is_public = true
    )
  );

-- Service role inserts only (no INSERT policy for users)

CREATE INDEX idx_activity_events_created ON activity_events (created_at DESC);
CREATE INDEX idx_activity_events_actor ON activity_events (actor_id);
CREATE INDEX idx_activity_events_horse ON activity_events (horse_id);
