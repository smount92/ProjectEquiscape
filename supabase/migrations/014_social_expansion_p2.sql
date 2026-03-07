-- ============================================================
-- Migration 014: Social Expansion Phase 2 — Notifications + Transaction Status
-- ============================================================

-- ── Notifications Table ──
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  horse_id        UUID REFERENCES user_horses(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  content         TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can mark as read / update own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT policy — Service Role inserts only

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_unread ON notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications (user_id, created_at DESC);

-- ── Transaction Status on Conversations ──
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS transaction_status TEXT NOT NULL DEFAULT 'open'
  CHECK (transaction_status IN ('open', 'completed'));
