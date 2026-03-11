-- ============================================================
-- Migration 042: Universal Social & Media Engine (Phase 1)
-- Grand Unification Plan — replaces 6 content tables with 3
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE NEW TABLES
-- ══════════════════════════════════════════════════════════════

-- ── Universal Posts ──
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  parent_id     UUID REFERENCES posts(id) ON DELETE CASCADE,

  -- ── Exclusive Arc Contexts ──
  horse_id          UUID REFERENCES user_horses(id) ON DELETE CASCADE,
  group_id          UUID REFERENCES groups(id) ON DELETE CASCADE,
  event_id          UUID REFERENCES events(id) ON DELETE CASCADE,
  show_id           UUID REFERENCES photo_shows(id) ON DELETE CASCADE,
  studio_id         UUID REFERENCES artist_profiles(user_id) ON DELETE CASCADE,
  help_request_id   UUID REFERENCES id_requests(id) ON DELETE CASCADE,

  -- ── Denormalized Counters ──
  likes_count   INTEGER NOT NULL DEFAULT 0,
  replies_count INTEGER NOT NULL DEFAULT 0,

  -- ── Metadata ──
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT posts_exclusive_arc CHECK (
    num_nonnulls(horse_id, group_id, event_id, show_id, studio_id, help_request_id) <= 1
  )
);

-- ── Universal Media Attachments ──
CREATE TABLE IF NOT EXISTS media_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path  TEXT NOT NULL,
  uploader_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  post_id           UUID REFERENCES posts(id) ON DELETE CASCADE,
  message_id        UUID REFERENCES messages(id) ON DELETE CASCADE,
  event_id          UUID REFERENCES events(id) ON DELETE CASCADE,
  help_request_id   UUID REFERENCES id_requests(id) ON DELETE CASCADE,
  commission_id     UUID REFERENCES commissions(id) ON DELETE CASCADE,

  caption       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT media_exclusive_arc CHECK (
    num_nonnulls(post_id, message_id, event_id, help_request_id, commission_id) <= 1
  )
);

-- ── Universal Likes ──
CREATE TABLE IF NOT EXISTS likes (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_posts_author       ON posts (author_id, created_at DESC);
CREATE INDEX idx_posts_horse        ON posts (horse_id, created_at DESC) WHERE horse_id IS NOT NULL;
CREATE INDEX idx_posts_group        ON posts (group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX idx_posts_event        ON posts (event_id, created_at DESC) WHERE event_id IS NOT NULL;
CREATE INDEX idx_posts_show         ON posts (show_id, created_at DESC) WHERE show_id IS NOT NULL;
CREATE INDEX idx_posts_parent       ON posts (parent_id, created_at ASC) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_posts_feed         ON posts (created_at DESC)
  WHERE parent_id IS NULL
    AND horse_id IS NULL AND group_id IS NULL AND event_id IS NULL
    AND show_id IS NULL AND studio_id IS NULL AND help_request_id IS NULL;

CREATE INDEX idx_media_post         ON media_attachments (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_media_event        ON media_attachments (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_media_commission   ON media_attachments (commission_id) WHERE commission_id IS NOT NULL;

CREATE INDEX idx_likes_post         ON likes (post_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 3: RLS POLICIES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated
USING (
  (horse_id IS NULL AND group_id IS NULL)
  OR
  (horse_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_horses h WHERE h.id = posts.horse_id AND h.is_public = true
  ))
  OR
  (group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = posts.group_id AND gm.user_id = (SELECT auth.uid())
  ))
);

CREATE POLICY "posts_insert" ON posts FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = author_id);

CREATE POLICY "posts_delete" ON posts FOR DELETE TO authenticated
USING (
  (SELECT auth.uid()) = author_id
  OR
  (horse_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_horses h WHERE h.id = posts.horse_id AND h.owner_id = (SELECT auth.uid())
  ))
  OR
  (group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = posts.group_id AND gm.user_id = (SELECT auth.uid())
    AND gm.role IN ('owner', 'admin', 'moderator')
  ))
  OR
  (event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = posts.event_id AND e.created_by = (SELECT auth.uid())
  ))
);

CREATE POLICY "media_select" ON media_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "media_insert" ON media_attachments FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = uploader_id);
CREATE POLICY "media_delete" ON media_attachments FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = uploader_id);

CREATE POLICY "likes_select" ON likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 4: ATOMIC RPCs
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION toggle_post_like(p_post_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM likes WHERE user_id = p_user_id AND post_id = p_post_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM likes WHERE user_id = p_user_id AND post_id = p_post_id;
    UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'action', 'unliked');
  ELSE
    INSERT INTO likes (user_id, post_id) VALUES (p_user_id, p_post_id);
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'action', 'liked');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION add_post_reply(
  p_parent_id UUID,
  p_author_id UUID,
  p_content TEXT,
  p_horse_id UUID DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO posts (author_id, content, parent_id, horse_id, group_id, event_id)
  VALUES (p_author_id, p_content, p_parent_id, p_horse_id, p_group_id, p_event_id)
  RETURNING id INTO v_id;

  UPDATE posts SET replies_count = replies_count + 1 WHERE id = p_parent_id;
  RETURN v_id;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- STEP 5: DATA MIGRATION (Zero Data Loss)
-- ══════════════════════════════════════════════════════════════

-- 5a: horse_comments → posts
INSERT INTO posts (id, author_id, content, parent_id, horse_id, likes_count, created_at, updated_at)
SELECT
  hc.id, hc.user_id, hc.content, hc.parent_id, hc.horse_id,
  COALESCE(hc.likes_count, 0), hc.created_at, hc.created_at
FROM horse_comments hc
ON CONFLICT (id) DO NOTHING;

-- 5b: group_posts → posts
INSERT INTO posts (id, author_id, content, group_id, horse_id, is_pinned, likes_count, replies_count, created_at, updated_at)
SELECT
  gp.id, gp.user_id, gp.content, gp.group_id, gp.horse_id,
  COALESCE(gp.is_pinned, false), COALESCE(gp.likes_count, 0), COALESCE(gp.reply_count, 0),
  gp.created_at, COALESCE(gp.updated_at, gp.created_at)
FROM group_posts gp
ON CONFLICT (id) DO NOTHING;

-- 5c: group_post_replies → posts (children of group posts)
INSERT INTO posts (id, author_id, content, parent_id, group_id, created_at, updated_at)
SELECT
  gpr.id, gpr.user_id, gpr.content, gpr.post_id, gp.group_id,
  gpr.created_at, gpr.created_at
FROM group_post_replies gpr
JOIN group_posts gp ON gp.id = gpr.post_id
ON CONFLICT (id) DO NOTHING;

-- 5d: event_comments → posts
INSERT INTO posts (id, author_id, content, event_id, created_at, updated_at)
SELECT
  ec.id, ec.user_id, ec.content, ec.event_id, ec.created_at, ec.created_at
FROM event_comments ec
ON CONFLICT (id) DO NOTHING;

-- 5e: activity_events text posts → posts
INSERT INTO posts (id, author_id, content, created_at, updated_at)
SELECT
  ae.id, ae.actor_id, COALESCE((ae.metadata->>'text')::TEXT, ''),
  ae.created_at, ae.created_at
FROM activity_events ae
WHERE ae.event_type = 'text_post'
  AND (ae.metadata->>'text') IS NOT NULL
  AND (ae.metadata->>'text') != ''
ON CONFLICT (id) DO NOTHING;

-- 5f: image_urls arrays → media_attachments
-- Group post images
INSERT INTO media_attachments (uploader_id, storage_path, post_id, created_at)
SELECT gp.user_id, unnest(gp.image_urls), gp.id, gp.created_at
FROM group_posts gp
WHERE gp.image_urls IS NOT NULL AND array_length(gp.image_urls, 1) > 0;

-- Activity event (text_post) images
INSERT INTO media_attachments (uploader_id, storage_path, post_id, created_at)
SELECT ae.actor_id, unnest(ae.image_urls), ae.id, ae.created_at
FROM activity_events ae
WHERE ae.event_type = 'text_post'
  AND ae.image_urls IS NOT NULL AND array_length(ae.image_urls, 1) > 0;

-- Event photos → media_attachments (replaces event_photos table)
INSERT INTO media_attachments (uploader_id, storage_path, event_id, caption, created_at)
SELECT ep.user_id, ep.image_path, ep.event_id, ep.caption, ep.created_at
FROM event_photos ep;

-- 5g: Migrate likes
-- Activity likes
INSERT INTO likes (user_id, post_id, created_at)
SELECT al.user_id, al.activity_id, al.created_at
FROM activity_likes al
WHERE EXISTS (SELECT 1 FROM posts p WHERE p.id = al.activity_id)
ON CONFLICT (user_id, post_id) DO NOTHING;

-- Group post likes
INSERT INTO likes (user_id, post_id, created_at)
SELECT gpl.user_id, gpl.post_id, gpl.created_at
FROM group_post_likes gpl
WHERE EXISTS (SELECT 1 FROM posts p WHERE p.id = gpl.post_id)
ON CONFLICT (user_id, post_id) DO NOTHING;

-- Comment likes
INSERT INTO likes (user_id, post_id, created_at)
SELECT cl.user_id, cl.comment_id, cl.created_at
FROM comment_likes cl
WHERE EXISTS (SELECT 1 FROM posts p WHERE p.id = cl.comment_id)
ON CONFLICT (user_id, post_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- STEP 6: VERIFICATION (run manually after migration)
-- ══════════════════════════════════════════════════════════════
-- SELECT 'horse_comments' AS source, count(*) FROM horse_comments
-- UNION ALL SELECT 'posts (horse)', count(*) FROM posts WHERE horse_id IS NOT NULL AND parent_id IS NULL
-- UNION ALL SELECT 'group_posts', count(*) FROM group_posts
-- UNION ALL SELECT 'posts (group, top)', count(*) FROM posts WHERE group_id IS NOT NULL AND parent_id IS NULL
-- UNION ALL SELECT 'group_post_replies', count(*) FROM group_post_replies
-- UNION ALL SELECT 'posts (group, reply)', count(*) FROM posts WHERE group_id IS NOT NULL AND parent_id IS NOT NULL
-- UNION ALL SELECT 'event_comments', count(*) FROM event_comments
-- UNION ALL SELECT 'posts (event)', count(*) FROM posts WHERE event_id IS NOT NULL
-- UNION ALL SELECT 'text_posts (activity)', (SELECT count(*) FROM activity_events WHERE event_type = 'text_post')
-- UNION ALL SELECT 'posts (global)', count(*) FROM posts WHERE horse_id IS NULL AND group_id IS NULL AND event_id IS NULL AND parent_id IS NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 7: DROP LEGACY — separate migration 043 AFTER code migrated
-- ══════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS comment_likes CASCADE;
-- DROP TABLE IF EXISTS group_post_likes CASCADE;
-- DROP TABLE IF EXISTS activity_likes CASCADE;
-- DROP TABLE IF EXISTS horse_comments CASCADE;
-- DROP TABLE IF EXISTS group_post_replies CASCADE;
-- DROP TABLE IF EXISTS group_posts CASCADE;
-- DROP TABLE IF EXISTS event_comments CASCADE;
-- DROP TABLE IF EXISTS event_photos CASCADE;
-- DELETE FROM activity_events WHERE event_type = 'text_post';
-- DROP FUNCTION IF EXISTS toggle_activity_like CASCADE;
-- DROP FUNCTION IF EXISTS toggle_group_post_like CASCADE;
-- DROP FUNCTION IF EXISTS toggle_comment_like CASCADE;
