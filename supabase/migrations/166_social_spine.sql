-- ============================================================
-- 166 — SOCIAL SPINE
--
-- One feed, on `posts`. Three small additions, all optional at
-- the app layer (every reader/writer feature-detects, so the
-- site behaves correctly BEFORE this file is pasted and simply
-- gains the extra behaviour after):
--
--   1. posts.kind        — what produced this post. 'user' for
--                          human composer output, 'show_results'
--                          for the automatic "🏆 Results are in"
--                          announcement a show emits when its
--                          host publishes. Lets the feed render
--                          system posts differently and lets the
--                          emit be idempotent.
--   2. posts.visibility  — 'public' (default) or 'followers'.
--                          The minimal per-post audience control
--                          the owner ratified. Enforced in RLS
--                          here AND filtered in the feed query,
--                          because a leak is unrecoverable.
--   3. indexes           — the global stream is a straight
--                          chronological scan of top-level rows;
--                          give it a partial index instead of a
--                          seq scan, and give the legacy
--                          activity_events text-post interleave
--                          one too.
--
-- Nothing here drops or rewrites existing data. posts.kind and
-- posts.visibility both backfill to their defaults, so every
-- pre-existing post stays exactly as visible as it is today.
-- ============================================================

-- ── 1. kind ──────────────────────────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_kind_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_kind_check
      CHECK (kind IN ('user', 'show_results', 'audit'));
  END IF;
END $$;

COMMENT ON COLUMN posts.kind IS
  'What produced this post. user = composed by a person; show_results = auto-emitted when a show publishes results; audit = system provenance note on a passport thread (never surfaces in the feed).';

-- Tag the system/audit notes already written onto passport threads
-- (reference-identity changes, parked-transfer expirations) so the
-- feed can exclude them by kind instead of by content prefix.
UPDATE posts SET kind = 'audit'
WHERE kind = 'user'
  AND (content LIKE '📋 Reference identity updated%'
    OR content LIKE '⏰ Parked transfer expired%');

-- ── 2. visibility ────────────────────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_visibility_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_visibility_check
      CHECK (visibility IN ('public', 'followers'));
  END IF;
END $$;

COMMENT ON COLUMN posts.visibility IS
  'Audience for a top-level post. public = anyone who can see the context; followers = author + the author''s followers.';

-- ── 3. RLS: preserve 042''s context gate, AND the audience gate
--
-- The context half is copied verbatim from 042 (horse posts need
-- a public horse; group posts need membership; everything else
-- is open) so this migration cannot silently widen or narrow
-- what is already reachable. The only NEW restriction is the
-- second conjunct: a 'followers' post is readable by its author
-- and by the people who follow the author. 'public' — the
-- default every existing row carries — is unaffected.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "posts_select" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated
USING (
  (
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
  )
  AND
  (
    visibility = 'public'
    OR author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_follows f
      WHERE f.following_id = posts.author_id
        AND f.follower_id = (SELECT auth.uid())
    )
  )
);

-- ── 4. Indexes ───────────────────────────────────────────────

-- The global stream: top-level rows, newest first.
CREATE INDEX IF NOT EXISTS posts_toplevel_created_idx
  ON posts (created_at DESC)
  WHERE parent_id IS NULL;

-- Followers-of-author lookups from the RLS policy above.
CREATE INDEX IF NOT EXISTS user_follows_following_follower_idx
  ON user_follows (following_id, follower_id);

-- One results announcement per show, forever. The emit is
-- fire-and-forget from the publish path and a host can re-run a
-- publish; this makes a double-fire a no-op at the database
-- level rather than trusting the app's existence check.
CREATE UNIQUE INDEX IF NOT EXISTS posts_show_results_once_idx
  ON posts (show_id)
  WHERE kind = 'show_results' AND show_id IS NOT NULL;

-- Legacy activity_events text posts are interleaved read-only
-- into the same stream until they age out.
CREATE INDEX IF NOT EXISTS activity_events_text_post_created_idx
  ON activity_events (created_at DESC)
  WHERE event_type = 'text_post';

-- ============================================================
-- After applying: regenerate types (posts gains kind +
-- visibility).
--
-- Verify:
--   1. /feed still lists every post it listed before (all rows
--      default to visibility='public').
--   2. Composing with the audience set to "Followers" produces a
--      post that a non-follower cannot SELECT:
--        SET LOCAL role authenticated;
--        SET LOCAL request.jwt.claims TO '{"sub":"<non-follower>"}';
--        SELECT count(*) FROM posts WHERE id = '<the post>';  -- 0
--   3. Publishing a show's results twice leaves exactly one
--      kind='show_results' post for that show_id.
-- ============================================================
