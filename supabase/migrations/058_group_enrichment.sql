-- ══════════════════════════════════════════════════════════════
-- Migration 058: Group Enrichment
-- Group Files, Admin Moderation, Sub-Channels
-- ══════════════════════════════════════════════════════════════

-- ── TASK 1: GROUP FILES ──

CREATE TABLE IF NOT EXISTS group_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    file_name   TEXT NOT NULL,
    file_url    TEXT NOT NULL,
    file_size   INTEGER,
    file_type   TEXT DEFAULT 'pdf',
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE group_files ENABLE ROW LEVEL SECURITY;

-- Members can view group files
CREATE POLICY "group_files_select" ON group_files
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = group_files.group_id
        AND gm.user_id = (SELECT auth.uid())
    ));

-- Only admin/owner/moderator can insert files
CREATE POLICY "group_files_insert" ON group_files
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = uploaded_by
        AND EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = group_files.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.role IN ('owner', 'admin', 'moderator')
        )
    );

-- Only uploader or admin/owner can delete files
CREATE POLICY "group_files_delete" ON group_files
    FOR DELETE TO authenticated
    USING (
        (SELECT auth.uid()) = uploaded_by
        OR EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = group_files.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.role IN ('owner', 'admin')
        )
    );

CREATE INDEX idx_group_files_group ON group_files(group_id, created_at DESC);


-- ── TASK 2: ADMIN MODERATION ──

-- Replace self-only membership delete with admin-capable policy
-- (Drop existing policy first if it exists)
DO $$ BEGIN
    DROP POLICY IF EXISTS "membership_delete_self" ON group_memberships;
    DROP POLICY IF EXISTS "membership_delete_admin" ON group_memberships;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "membership_delete_admin" ON group_memberships
    FOR DELETE TO authenticated
    USING (
        -- Self-removal
        (SELECT auth.uid()) = user_id
        -- OR admin/owner removing a member
        OR EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = group_memberships.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.role IN ('owner', 'admin')
        )
    );

-- Allow admin/owner to update member roles
DO $$ BEGIN
    DROP POLICY IF EXISTS "membership_update" ON group_memberships;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "membership_update" ON group_memberships
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = group_memberships.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = group_memberships.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.role IN ('owner', 'admin')
        )
    );


-- ── TASK 3: SUB-CHANNELS ──

CREATE TABLE IF NOT EXISTS group_channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, slug)
);

ALTER TABLE group_channels ENABLE ROW LEVEL SECURITY;

-- Members can view channels
CREATE POLICY "channels_select" ON group_channels
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = group_channels.group_id
        AND gm.user_id = (SELECT auth.uid())
    ));

-- Only admin/owner can create channels
CREATE POLICY "channels_insert" ON group_channels
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = group_channels.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin')
    ));

-- Only admin/owner can delete channels
CREATE POLICY "channels_delete" ON group_channels
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = group_channels.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin')
    ));

-- Add channel_id to posts (nullable — null = #general)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES group_channels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_channel ON posts(channel_id) WHERE channel_id IS NOT NULL;

-- Auto-create #general channel for all existing groups
INSERT INTO group_channels (group_id, name, slug, sort_order)
SELECT id, 'General', 'general', 0 FROM groups
ON CONFLICT (group_id, slug) DO NOTHING;
