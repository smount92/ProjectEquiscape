-- ══════════════════════════════════════════════════════════════
-- Migration 122: Groups Forum ("Notice Board")
-- Additive only. Thread titles, activity bumping, and per-user
-- read state for the group board rebuild (NEXT_PUBLIC_GROUPS_FORUM).
-- ══════════════════════════════════════════════════════════════

-- ── 1. Thread titles ──
-- Root group posts only, by convention (the forum UI is the only
-- writer). No CHECK constraint — other post contexts simply never
-- set it, and existing untitled posts derive a display title at
-- read time.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT;

-- ── 2. Activity bumping ──
ALTER TABLE posts ADD COLUMN IF NOT EXISTS bumped_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: a root post's bump time is its newest reply's created_at,
-- or its own created_at if it has no replies.
UPDATE posts p
SET bumped_at = GREATEST(
    p.created_at,
    COALESCE(
        (SELECT max(r.created_at) FROM posts r WHERE r.parent_id = p.id),
        p.created_at
    )
)
WHERE p.parent_id IS NULL;

-- Board query index: pinned first, then most-recently-bumped.
CREATE INDEX IF NOT EXISTS idx_posts_group_board
    ON posts (group_id, is_pinned DESC, bumped_at DESC)
    WHERE parent_id IS NULL AND group_id IS NOT NULL;

-- ── 3. Replies bump their thread ──
-- Body copied from 092_supabase_linter_fixes.sql (the current
-- definition — 092 superseded 042 to add SET search_path), plus the
-- bumped_at touch on the parent. Harmless for non-group parents.
CREATE OR REPLACE FUNCTION public.add_post_reply(
  p_parent_id UUID,
  p_author_id UUID,
  p_content TEXT,
  p_horse_id UUID DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.posts (author_id, content, parent_id, horse_id, group_id, event_id)
  VALUES (p_author_id, p_content, p_parent_id, p_horse_id, p_group_id, p_event_id)
  RETURNING id INTO v_id;

  UPDATE public.posts
  SET replies_count = replies_count + 1,
      bumped_at = now()
  WHERE id = p_parent_id;
  RETURN v_id;
END;
$$;

-- ── 4. Per-user group read state (brass unread dots) ──
CREATE TABLE IF NOT EXISTS group_last_read (
    group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_last_read ENABLE ROW LEVEL SECURITY;

-- Users see and manage ONLY their own read-state rows.
CREATE POLICY "group_last_read_select" ON group_last_read
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "group_last_read_insert" ON group_last_read
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "group_last_read_update" ON group_last_read
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
