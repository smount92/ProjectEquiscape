-- ============================================================
-- 077: Horse-Collection Many-to-Many Junction Table
-- Horses can now belong to MULTIPLE collections simultaneously.
-- Data migrated from user_horses.collection_id → junction table.
-- ============================================================

-- 1. Create junction table
CREATE TABLE IF NOT EXISTS horse_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    horse_id UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES user_collections(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(horse_id, collection_id)
);

-- 2. Migrate existing data from single FK to junction table
INSERT INTO horse_collections (horse_id, collection_id)
SELECT id, collection_id
FROM user_horses
WHERE collection_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. RLS: users can manage their own horses' collection assignments
ALTER TABLE horse_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own horse collection links"
    ON horse_collections FOR SELECT
    USING (
        horse_id IN (
            SELECT id FROM user_horses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own horse collection links"
    ON horse_collections FOR INSERT
    WITH CHECK (
        horse_id IN (
            SELECT id FROM user_horses WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own horse collection links"
    ON horse_collections FOR DELETE
    USING (
        horse_id IN (
            SELECT id FROM user_horses WHERE user_id = auth.uid()
        )
    );

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_horse_collections_horse_id ON horse_collections(horse_id);
CREATE INDEX IF NOT EXISTS idx_horse_collections_collection_id ON horse_collections(collection_id);
