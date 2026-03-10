-- ============================================================
-- Migration 039: Modern Social Foundation
-- Threaded comments, universal likes, user blocks, realtime
-- ============================================================

-- ── Threaded Comments ──
ALTER TABLE horse_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES horse_comments(id) ON DELETE CASCADE;
ALTER TABLE horse_comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_horse_comments_parent ON horse_comments (parent_id) WHERE parent_id IS NOT NULL;

-- ── Activity Likes ──
CREATE TABLE IF NOT EXISTS activity_likes (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, activity_id)
);
ALTER TABLE activity_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_likes_select" ON activity_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_likes_insert" ON activity_likes FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "activity_likes_delete" ON activity_likes FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- ── Group Post Likes ──
CREATE TABLE IF NOT EXISTS group_post_likes (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id  UUID NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE group_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gp_likes_select" ON group_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "gp_likes_insert" ON group_post_likes FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "gp_likes_delete" ON group_post_likes FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── Comment Likes ──
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES horse_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cl_select" ON comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cl_insert" ON comment_likes FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "cl_delete" ON comment_likes FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ── User Blocks ──
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_select_own" ON user_blocks FOR SELECT TO authenticated USING ((SELECT auth.uid()) = blocker_id);
CREATE POLICY "blocks_insert_own" ON user_blocks FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = blocker_id);
CREATE POLICY "blocks_delete_own" ON user_blocks FOR DELETE TO authenticated USING ((SELECT auth.uid()) = blocker_id);

-- Prevent blocking yourself
ALTER TABLE user_blocks ADD CONSTRAINT no_self_block CHECK (blocker_id != blocked_id);

-- ── Atomic RPCs ──

-- Toggle activity like
CREATE OR REPLACE FUNCTION toggle_activity_like(p_activity_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM activity_likes WHERE user_id = p_user_id AND activity_id = p_activity_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM activity_likes WHERE user_id = p_user_id AND activity_id = p_activity_id;
    UPDATE activity_events SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_activity_id;
    RETURN jsonb_build_object('success', true, 'action', 'unliked');
  ELSE
    INSERT INTO activity_likes (user_id, activity_id) VALUES (p_user_id, p_activity_id);
    UPDATE activity_events SET likes_count = likes_count + 1 WHERE id = p_activity_id;
    RETURN jsonb_build_object('success', true, 'action', 'liked');
  END IF;
END;
$$;

-- Toggle group post like (Task 1.2: fixed typo — post_id not activity_id)
CREATE OR REPLACE FUNCTION toggle_group_post_like(p_post_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM group_post_likes WHERE user_id = p_user_id AND post_id = p_post_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM group_post_likes WHERE user_id = p_user_id AND post_id = p_post_id;
    UPDATE group_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'action', 'unliked');
  ELSE
    INSERT INTO group_post_likes (user_id, post_id) VALUES (p_user_id, p_post_id);
    UPDATE group_posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'action', 'liked');
  END IF;
END;
$$;

-- Toggle comment like
CREATE OR REPLACE FUNCTION toggle_comment_like(p_comment_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM comment_likes WHERE user_id = p_user_id AND comment_id = p_comment_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM comment_likes WHERE user_id = p_user_id AND comment_id = p_comment_id;
    UPDATE horse_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_comment_id;
    RETURN jsonb_build_object('success', true, 'action', 'unliked');
  ELSE
    INSERT INTO comment_likes (user_id, comment_id) VALUES (p_user_id, p_comment_id);
    UPDATE horse_comments SET likes_count = likes_count + 1 WHERE id = p_comment_id;
    RETURN jsonb_build_object('success', true, 'action', 'liked');
  END IF;
END;
$$;

-- ── Realtime Publication ──
-- NOTE: Run this manually in the Supabase SQL editor if it fails in migration:
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages, notifications;
