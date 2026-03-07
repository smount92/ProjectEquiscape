-- ============================================================
-- Migration 004: Personal Collections (Folders)
-- Allows users to organize horses into named collections
-- ============================================================

-- 1. Create user_collections table
CREATE TABLE user_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_user_collections_user ON user_collections(user_id);

COMMENT ON TABLE user_collections IS 'Personal folders/collections for organizing model horses.';


-- 2. Add collection_id to user_horses
ALTER TABLE user_horses
ADD COLUMN collection_id UUID REFERENCES user_collections(id) ON DELETE SET NULL;

CREATE INDEX idx_user_horses_collection ON user_horses(collection_id) WHERE collection_id IS NOT NULL;


-- 3. Enable RLS
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;


-- 4. RLS Policies — Owner-only CRUD
CREATE POLICY "collections_select_own"
  ON user_collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "collections_insert_own"
  ON user_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_update_own"
  ON user_collections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_delete_own"
  ON user_collections FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Public read for collections of public horses (for public profiles)
CREATE POLICY "collections_select_public"
  ON user_collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.collection_id = user_collections.id
        AND user_horses.is_public = TRUE
    )
  );

-- ============================================================
-- ✅ MIGRATION COMPLETE
-- New table: user_collections (id, user_id, name, description, created_at)
-- New column: user_horses.collection_id (nullable FK)
-- RLS: Owner-only CRUD + public read for collections with public horses
-- ============================================================
