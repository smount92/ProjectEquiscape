-- ============================================================
-- Migration 009: Native Inbox — Conversations & Messages
-- ============================================================

-- 1. Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  horse_id    UUID REFERENCES user_horses(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content          TEXT NOT NULL,
  is_read          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Conversation RLS policies — users can only see their own conversations
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- 5. Message RLS policies — users can only see messages in their conversations
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in own conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

CREATE POLICY "Users can mark messages as read in own conversations"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- 6. Indexes for performance
CREATE INDEX idx_conversations_buyer_id ON conversations (buyer_id);
CREATE INDEX idx_conversations_seller_id ON conversations (seller_id);
CREATE INDEX idx_conversations_horse_id ON conversations (horse_id);
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);
CREATE INDEX idx_messages_created_at ON messages (conversation_id, created_at);

-- 7. Prevent duplicate conversations for same buyer+seller+horse
CREATE UNIQUE INDEX idx_conversations_unique
  ON conversations (buyer_id, seller_id, COALESCE(horse_id, '00000000-0000-0000-0000-000000000000'));
