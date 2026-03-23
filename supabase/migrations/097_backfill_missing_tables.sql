-- ============================================================
-- Migration 097: Backfill Missing Tables
-- 
-- These tables are referenced in application code but missing
-- from the remote database. group_posts and group_post_replies
-- were dropped in 052_the_great_purge.sql as "legacy" but are
-- still actively used by the group posts feature. event_comments
-- and event_photos were defined in 041_event_enrichment.sql but
-- appear to have never been applied to the remote DB.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. group_posts (originally 031, dropped in 052, still used)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS group_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  horse_id    UUID REFERENCES user_horses(id) ON DELETE SET NULL,
  image_urls  TEXT[] DEFAULT '{}',
  is_pinned   BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_posts_select" ON group_posts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = group_posts.group_id
      AND gm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "group_posts_insert" ON group_posts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = group_posts.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "group_posts_delete" ON group_posts FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = group_posts.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE INDEX IF NOT EXISTS idx_group_posts ON group_posts (group_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 2. group_post_replies (originally 031, dropped in 052, still used)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS group_post_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE group_post_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replies_select" ON group_post_replies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_posts gp
    JOIN group_memberships gm ON gm.group_id = gp.group_id
    WHERE gp.id = group_post_replies.post_id
      AND gm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "replies_insert" ON group_post_replies FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "replies_delete" ON group_post_replies FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_group_post_replies ON group_post_replies (post_id, created_at);

-- ══════════════════════════════════════════════════════════════
-- 3. event_comments (from 041, not applied to remote)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_comments_select" ON event_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "event_comments_insert" ON event_comments FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_comments_delete" ON event_comments FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_comments.event_id
      AND e.created_by = (SELECT auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_event_comments_event ON event_comments (event_id, created_at);

-- ══════════════════════════════════════════════════════════════
-- 4. event_photos (from 041, not applied to remote)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path  TEXT NOT NULL,
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_photos_select" ON event_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "event_photos_insert" ON event_photos FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_photos_delete" ON event_photos FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_photos.event_id
      AND e.created_by = (SELECT auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos (event_id);

-- ============================================================
-- ✅ Migration 097 Complete
-- Backfilled: group_posts, group_post_replies,
--             event_comments, event_photos
-- All use IF NOT EXISTS — safe to re-run idempotently
-- ============================================================
