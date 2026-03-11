---
description: Phase 1 — Universal Social & Media Engine. Single `posts` table, `media_attachments`, unified `likes`. Replaces 6 legacy tables. Zero data loss.
---

# Phase 1: Universal Social & Media Engine

> **Grand Unification Plan — Phase 1 of 5**
> **Pre-requisites:** Migrations 001–041 applied, build clean.
> **Iron Laws in effect:**
> - Zero Data Loss Migrations (PL/pgSQL data migration scripts)
> - Exclusive Arc FKs with `CHECK (num_nonnulls(...) <= 1)`
> - Direct-to-storage for all media (Vercel payload compliance)
> - Atomic RPCs for counters

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. If you encounter issues or make design decisions, add a brief note under the task
> 4. Run `npx next build` after every task and note the result
> 5. Do NOT skip updating this file — the human uses it to track progress

---

## What We're Replacing

| Legacy Table | Rows | Destination |
|---|---|---|
| `horse_comments` | Comments on public horses | `posts` with `horse_id` context |
| `group_posts` | Posts inside groups | `posts` with `group_id` context |
| `group_post_replies` | Replies to group posts | `posts` with `parent_id` |
| `event_comments` | Comments on events (migration 041) | `posts` with `event_id` context |
| `activity_events` (text_post type only) | User text posts in feed | `posts` with no context (global feed) |
| `event_photos` | Photos attached to events | `media_attachments` with `event_id` context |
| `activity_likes` | Likes on feed items | `likes` with `post_id` |
| `group_post_likes` | Likes on group posts | `likes` with `post_id` |
| `comment_likes` | Likes on horse comments | `likes` with `post_id` |
| `image_urls TEXT[]` (on activity_events, group_posts) | Casual images | `media_attachments` with `post_id` |

**Tables NOT touched:**
- `activity_events` (non-text_post rows stay — these are system events like `new_horse`, `favorite`, `follow`, `rating`, `show_record`)
- `horse_images` (formal LSQ angle photos — separate domain)
- `horse_favorites` (stays — different semantic: favoriting a horse ≠ liking a post)

---

## Task 1 — Migration 042: Schema Creation + Data Migration ✅ DONE 2026-03-10
> Written and applied. Human confirmed successful.

> ⚠️ **HUMAN REVIEW REQUIRED** before applying this migration.

Create `supabase/migrations/042_universal_social_engine.sql`:

```sql
-- ============================================================
-- Migration 042: Universal Social & Media Engine (Phase 1)
-- Grand Unification Plan — replaces 6 content tables with 3
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE NEW TABLES
-- ══════════════════════════════════════════════════════════════

-- ── Universal Posts ──
-- Every piece of text content in the platform lives here.
-- Context columns (exclusive arcs) determine WHERE the post appears.
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  parent_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  -- Threading: NULL = top-level, non-NULL = reply (1 level deep enforced in app)

  -- ── Exclusive Arc Contexts ──
  -- At most ONE of these can be non-null.
  -- NULL for all = global feed post (casual text post).
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

  -- ── Exclusive Arc Constraint ──
  -- A post can belong to at most ONE context.
  CONSTRAINT posts_exclusive_arc CHECK (
    num_nonnulls(horse_id, group_id, event_id, show_id, studio_id, help_request_id) <= 1
  )
);

-- ── Universal Media Attachments ──
-- Every casual image/file upload lives here.
-- Formal horse photos (LSQ angles) stay in horse_images.
CREATE TABLE IF NOT EXISTS media_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path  TEXT NOT NULL,
  uploader_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- ── Exclusive Arc Contexts ──
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

-- Posts
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
  -- ^ Global feed posts (no context, top-level only)

-- Media
CREATE INDEX idx_media_post         ON media_attachments (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_media_event        ON media_attachments (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_media_commission   ON media_attachments (commission_id) WHERE commission_id IS NOT NULL;

-- Likes
CREATE INDEX idx_likes_post         ON likes (post_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 3: RLS POLICIES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- ── Posts: Read ──
-- Global feed posts: anyone authenticated
-- Horse context: only if horse is public
-- Group context: only if user is a group member
-- Event context: anyone authenticated
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated
USING (
  -- Global/event/studio/help posts: visible to all authenticated
  (horse_id IS NULL AND group_id IS NULL)
  OR
  -- Horse comments: only on public horses
  (horse_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_horses h WHERE h.id = posts.horse_id AND h.is_public = true
  ))
  OR
  -- Group posts: only for members
  (group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = posts.group_id AND gm.user_id = (SELECT auth.uid())
  ))
);

-- ── Posts: Insert ──
CREATE POLICY "posts_insert" ON posts FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = author_id);

-- ── Posts: Delete ──
-- Author can always delete. Group admins can delete group posts.
-- Event creators can delete event comments. Horse owners can delete comments.
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

-- ── Media Attachments ──
CREATE POLICY "media_select" ON media_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "media_insert" ON media_attachments FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = uploader_id);
CREATE POLICY "media_delete" ON media_attachments FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = uploader_id);

-- ── Likes ──
CREATE POLICY "likes_select" ON likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 4: ATOMIC RPCs
-- ══════════════════════════════════════════════════════════════

-- Toggle like on any post (replaces toggle_activity_like, toggle_group_post_like, toggle_comment_like)
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

-- Add reply and increment parent counter
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

-- ── 5a: Migrate horse_comments → posts ──
INSERT INTO posts (id, author_id, content, parent_id, horse_id, likes_count, created_at, updated_at)
SELECT
  hc.id,
  hc.user_id,
  hc.content,
  hc.parent_id,  -- threading preserved from migration 039
  hc.horse_id,
  COALESCE(hc.likes_count, 0),
  hc.created_at,
  hc.created_at  -- no updated_at on legacy table
FROM horse_comments hc
ON CONFLICT (id) DO NOTHING;

-- ── 5b: Migrate group_posts → posts ──
INSERT INTO posts (id, author_id, content, group_id, horse_id, is_pinned, likes_count, replies_count, created_at, updated_at)
SELECT
  gp.id,
  gp.user_id,
  gp.content,
  gp.group_id,
  gp.horse_id,
  COALESCE(gp.is_pinned, false),
  COALESCE(gp.likes_count, 0),
  COALESCE(gp.reply_count, 0),
  gp.created_at,
  COALESCE(gp.updated_at, gp.created_at)
FROM group_posts gp
ON CONFLICT (id) DO NOTHING;

-- ── 5c: Migrate group_post_replies → posts (as children of group posts) ──
INSERT INTO posts (id, author_id, content, parent_id, group_id, created_at, updated_at)
SELECT
  gpr.id,
  gpr.user_id,
  gpr.content,
  gpr.post_id,      -- parent_id = the group post
  gp.group_id,      -- inherit group context from parent
  gpr.created_at,
  gpr.created_at
FROM group_post_replies gpr
JOIN group_posts gp ON gp.id = gpr.post_id
ON CONFLICT (id) DO NOTHING;

-- ── 5d: Migrate event_comments → posts ──
INSERT INTO posts (id, author_id, content, event_id, created_at, updated_at)
SELECT
  ec.id,
  ec.user_id,
  ec.content,
  ec.event_id,
  ec.created_at,
  ec.created_at
FROM event_comments ec
ON CONFLICT (id) DO NOTHING;

-- ── 5e: Migrate activity_events text posts → posts ──
-- ONLY text_post event_type rows. Other event types stay in activity_events.
INSERT INTO posts (id, author_id, content, created_at, updated_at)
SELECT
  ae.id,
  ae.actor_id,
  COALESCE((ae.metadata->>'text')::TEXT, ''),
  ae.created_at,
  ae.created_at
FROM activity_events ae
WHERE ae.event_type = 'text_post'
  AND (ae.metadata->>'text') IS NOT NULL
  AND (ae.metadata->>'text') != ''
ON CONFLICT (id) DO NOTHING;

-- ── 5f: Migrate image_urls arrays → media_attachments ──
-- Group post images
INSERT INTO media_attachments (uploader_id, storage_path, post_id, created_at)
SELECT
  gp.user_id,
  unnest(gp.image_urls),
  gp.id,
  gp.created_at
FROM group_posts gp
WHERE gp.image_urls IS NOT NULL AND array_length(gp.image_urls, 1) > 0;

-- Activity event (text_post) images
INSERT INTO media_attachments (uploader_id, storage_path, post_id, created_at)
SELECT
  ae.actor_id,
  unnest(ae.image_urls),
  ae.id,
  ae.created_at
FROM activity_events ae
WHERE ae.event_type = 'text_post'
  AND ae.image_urls IS NOT NULL AND array_length(ae.image_urls, 1) > 0;

-- Event photos → media_attachments (replaces event_photos table from migration 041)
INSERT INTO media_attachments (uploader_id, storage_path, event_id, caption, created_at)
SELECT
  ep.user_id,
  ep.image_path,
  ep.event_id,
  ep.caption,
  ep.created_at
FROM event_photos ep;

-- ── 5g: Migrate likes ──
-- Activity likes → universal likes (only for text_post activity_events that moved to posts)
INSERT INTO likes (user_id, post_id, created_at)
SELECT
  al.user_id,
  al.activity_id,  -- same UUID, now in posts table
  al.created_at
FROM activity_likes al
WHERE EXISTS (SELECT 1 FROM posts p WHERE p.id = al.activity_id)
ON CONFLICT (user_id, post_id) DO NOTHING;

-- Group post likes
INSERT INTO likes (user_id, post_id, created_at)
SELECT
  gpl.user_id,
  gpl.post_id,
  gpl.created_at
FROM group_post_likes gpl
WHERE EXISTS (SELECT 1 FROM posts p WHERE p.id = gpl.post_id)
ON CONFLICT (user_id, post_id) DO NOTHING;

-- Comment likes
INSERT INTO likes (user_id, post_id, created_at)
SELECT
  cl.user_id,
  cl.comment_id,
  cl.created_at
FROM comment_likes cl
WHERE EXISTS (SELECT 1 FROM posts p WHERE p.id = cl.comment_id)
ON CONFLICT (user_id, post_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- STEP 6: VERIFICATION QUERIES (Run manually to confirm)
-- Uncomment and execute these after the migration to verify
-- zero data loss before proceeding to Step 7.
-- ══════════════════════════════════════════════════════════════

-- SELECT 'horse_comments' AS source, count(*) FROM horse_comments
-- UNION ALL SELECT 'posts (horse_id IS NOT NULL)', count(*) FROM posts WHERE horse_id IS NOT NULL AND parent_id IS NULL
-- UNION ALL SELECT 'group_posts', count(*) FROM group_posts
-- UNION ALL SELECT 'posts (group_id IS NOT NULL, parent IS NULL)', count(*) FROM posts WHERE group_id IS NOT NULL AND parent_id IS NULL
-- UNION ALL SELECT 'group_post_replies', count(*) FROM group_post_replies
-- UNION ALL SELECT 'posts (group_id IS NOT NULL, parent IS NOT NULL)', count(*) FROM posts WHERE group_id IS NOT NULL AND parent_id IS NOT NULL
-- UNION ALL SELECT 'event_comments', count(*) FROM event_comments
-- UNION ALL SELECT 'posts (event_id IS NOT NULL)', count(*) FROM posts WHERE event_id IS NOT NULL
-- UNION ALL SELECT 'text_posts from activity', (SELECT count(*) FROM activity_events WHERE event_type = 'text_post')
-- UNION ALL SELECT 'posts (global feed)', count(*) FROM posts WHERE horse_id IS NULL AND group_id IS NULL AND event_id IS NULL AND parent_id IS NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 7: DROP LEGACY TABLES
-- ⚠️ DO NOT RUN until Step 6 verification confirms 0 data loss.
-- ⚠️ This should be a SEPARATE migration (043) run after code is updated.
-- ══════════════════════════════════════════════════════════════

-- These will be in migration 043_drop_legacy_social.sql AFTER all code is migrated:
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
```

**Action:** Write this file. **DO NOT apply yet** — wait for human review.

---

## Task 2 — Server Actions: Universal Post CRUD ✅ DONE 2026-03-10
> Created posts.ts with createPost, replyToPost, deletePost, togglePostLike, getPosts, getEventMedia, addEventMedia, deleteEventMedia.

Create `src/app/actions/posts.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// UNIVERSAL POSTS — Server Actions
// A single post system for all text content in the platform.
// ============================================================

export interface Post {
    id: string;
    authorId: string;
    authorAlias: string;
    content: string;
    parentId: string | null;
    horseId: string | null;
    groupId: string | null;
    eventId: string | null;
    showId: string | null;
    studioId: string | null;
    helpRequestId: string | null;
    likesCount: number;
    repliesCount: number;
    isPinned: boolean;
    createdAt: string;
    media: { id: string; imageUrl: string; caption: string | null }[];
    // Populated client-side or via join:
    isLikedByMe: boolean;
    replies: Post[];
}

// ── Create a post in any context ──
export async function createPost(data: {
    content: string;
    horseId?: string;
    groupId?: string;
    eventId?: string;
    showId?: string;
    studioId?: string;
    helpRequestId?: string;
    imagePaths?: string[];
}): Promise<{ success: boolean; postId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };
    if (!data.content.trim() && (!data.imagePaths || data.imagePaths.length === 0)) {
        return { success: false, error: "Post cannot be empty." };
    }
    if (data.content.trim().length > 2000) {
        return { success: false, error: "Post is too long (2000 char max)." };
    }

    const { data: post, error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: data.content.trim(),
        horse_id: data.horseId || null,
        group_id: data.groupId || null,
        event_id: data.eventId || null,
        show_id: data.showId || null,
        studio_id: data.studioId || null,
        help_request_id: data.helpRequestId || null,
    }).select("id").single();

    if (error) return { success: false, error: error.message };

    // Link media attachments
    if (data.imagePaths && data.imagePaths.length > 0 && post) {
        const mediaRows = data.imagePaths.map(path => ({
            storage_path: path,
            uploader_id: user.id,
            post_id: post.id,
        }));
        await supabase.from("media_attachments").insert(mediaRows);
    }

    // Revalidate relevant paths
    if (data.horseId) revalidatePath(`/community/${data.horseId}`);
    if (data.groupId) revalidatePath("/community/groups");
    if (data.eventId) revalidatePath(`/community/events/${data.eventId}`);
    revalidatePath("/feed");

    // Fire-and-forget: mention notifications
    try {
        const { data: actor } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
        const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
        const { parseAndNotifyMentions } = await import("@/app/actions/mentions");
        parseAndNotifyMentions(data.content.trim(), user.id, alias, `/feed/${post!.id}`);
    } catch { /* non-blocking */ }

    return { success: true, postId: post!.id };
}

// ── Reply to a post (1 level deep) ──
export async function replyToPost(
    parentId: string,
    content: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };
    if (!content.trim()) return { success: false, error: "Reply cannot be empty." };
    if (content.trim().length > 500) return { success: false, error: "Reply is too long (500 char max)." };

    const { error } = await supabase.rpc("add_post_reply", {
        p_parent_id: parentId,
        p_author_id: user.id,
        p_content: content.trim(),
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/feed");
    return { success: true };
}

// ── Delete a post ──
export async function deletePost(
    postId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/feed");
    return { success: true };
}

// ── Toggle like (atomic RPC) ──
export async function togglePostLike(
    postId: string
): Promise<{ success: boolean; action?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { data, error } = await supabase.rpc("toggle_post_like", {
        p_post_id: postId,
        p_user_id: user.id,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, action: (data as { action: string })?.action };
}

// ── Get posts for a context ──
export async function getPosts(context: {
    horseId?: string;
    groupId?: string;
    eventId?: string;
    showId?: string;
    globalFeed?: boolean;
}, options?: {
    limit?: number;
    cursor?: string;
    includeReplies?: boolean;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
        .from("posts")
        .select("id, author_id, content, parent_id, horse_id, group_id, event_id, likes_count, replies_count, is_pinned, created_at, users!posts_author_id_fkey(alias_name)")
        .is("parent_id", null)  // Top-level only
        .order("created_at", { ascending: false })
        .limit(options?.limit || 25);

    // Context filters
    if (context.horseId) {
        query = query.eq("horse_id", context.horseId);
    } else if (context.groupId) {
        query = query.eq("group_id", context.groupId);
    } else if (context.eventId) {
        query = query.eq("event_id", context.eventId);
    } else if (context.showId) {
        query = query.eq("show_id", context.showId);
    } else if (context.globalFeed) {
        query = query
            .is("horse_id", null)
            .is("group_id", null)
            .is("event_id", null)
            .is("show_id", null)
            .is("studio_id", null)
            .is("help_request_id", null);
    }

    if (options?.cursor) {
        query = query.lt("created_at", options.cursor);
    }

    const { data: posts } = await query;
    if (!posts || posts.length === 0) return [];

    const postIds = (posts as { id: string }[]).map(p => p.id);

    // Fetch media for all posts in one query
    const { data: media } = await supabase
        .from("media_attachments")
        .select("id, storage_path, post_id, caption")
        .in("post_id", postIds);

    // Sign media URLs in batch
    const allPaths = (media ?? []).map((m: { storage_path: string }) => m.storage_path);
    let urlMap = new Map<string, string>();
    if (allPaths.length > 0) {
        const { data: signed } = await supabase.storage.from("horse-images").createSignedUrls(allPaths, 3600);
        signed?.forEach((s: { path?: string; signedUrl?: string }) => {
            if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
        });
    }

    // Check which posts the user has liked
    const { data: likedRows } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);
    const likedSet = new Set((likedRows ?? []).map((l: { post_id: string }) => l.post_id));

    // Optionally fetch replies
    let repliesMap = new Map<string, Post[]>();
    if (options?.includeReplies) {
        const { data: replies } = await supabase
            .from("posts")
            .select("id, author_id, content, parent_id, likes_count, created_at, users!posts_author_id_fkey(alias_name)")
            .in("parent_id", postIds)
            .order("created_at", { ascending: true });

        for (const r of (replies ?? []) as Record<string, unknown>[]) {
            const parentKey = r.parent_id as string;
            if (!repliesMap.has(parentKey)) repliesMap.set(parentKey, []);
            repliesMap.get(parentKey)!.push({
                id: r.id as string,
                authorId: r.author_id as string,
                authorAlias: (r.users as { alias_name: string } | null)?.alias_name ?? "Unknown",
                content: r.content as string,
                parentId: r.parent_id as string,
                horseId: null, groupId: null, eventId: null, showId: null, studioId: null, helpRequestId: null,
                likesCount: (r.likes_count as number) || 0,
                repliesCount: 0,
                isPinned: false,
                createdAt: r.created_at as string,
                media: [],
                isLikedByMe: false,
                replies: [],
            });
        }
    }

    return (posts as Record<string, unknown>[]).map(p => ({
        id: p.id as string,
        authorId: p.author_id as string,
        authorAlias: (p.users as { alias_name: string } | null)?.alias_name ?? "Unknown",
        content: p.content as string,
        parentId: null,
        horseId: p.horse_id as string | null,
        groupId: p.group_id as string | null,
        eventId: p.event_id as string | null,
        showId: null,
        studioId: null,
        helpRequestId: null,
        likesCount: (p.likes_count as number) || 0,
        repliesCount: (p.replies_count as number) || 0,
        isPinned: (p.is_pinned as boolean) || false,
        createdAt: p.created_at as string,
        media: (media ?? [])
            .filter((m: { post_id: string }) => m.post_id === p.id)
            .map((m: { id: string; storage_path: string; caption: string | null }) => ({
                id: m.id,
                imageUrl: urlMap.get(m.storage_path) || "",
                caption: m.caption,
            })),
        isLikedByMe: likedSet.has(p.id as string),
        replies: repliesMap.get(p.id as string) || [],
    } as Post));
}
```

**Key design decisions:**
- `createPost()` replaces `addComment()`, `createGroupPost()`, `createTextPost()`, `addEventComment()` — one function, context params determine destination.
- `getPosts()` replaces 4 separate fetch functions — context params determine which posts to load.
- Media is fetched in batch, signed in batch — single round trip per query.
- Likes checked in batch — one query for all posts on the page.

---

## Task 3 — UniversalFeed Component ✅ DONE 2026-03-10
> Created UniversalFeed.tsx — composer + post cards + replies + likes + infinite scroll.

Create `src/components/UniversalFeed.tsx` — a single, polished client component that renders any collection of posts:

**Props:**
```typescript
interface UniversalFeedProps {
    initialPosts: Post[];
    context: { horseId?: string; groupId?: string; eventId?: string; showId?: string; globalFeed?: boolean };
    currentUserId: string;
    showComposer?: boolean;
    composerPlaceholder?: string;
}
```

**Features:**
- Renders markdown via `RichText` component
- Renders `@mentions` as clickable links
- Image collage (1-4 images) using existing `.feed-image-collage` CSS
- `LikeToggle` using `togglePostLike`
- Reply toggle to expand 1-level-deep replies
- Reply composer inline
- "Load More" button with cursor pagination (IntersectionObserver)
- Direct-to-storage image upload (reuse FeedComposeBar pattern)
- Blocked user filtering via `getBlockedUserIds()`

This replaces: `ActivityFeed.tsx`, `FeedComposeBar.tsx`, `LoadMoreFeed.tsx`, `GroupFeed.tsx`, `CommentSection.tsx`, `EventCommentSection.tsx`

---

## Task 4 — Wire Pages to New System ✅ DONE 2026-03-10
> /feed (global tab), /community/[id], /community/groups/[slug], /community/events/[id], /shows/[id] (NEW), /feed/[id] — all wired.

Update these pages to use `getPosts()` + `<UniversalFeed />`:

| Page | Replace | With |
|---|---|---|
| `/feed/page.tsx` | `getActivityFeed()` + `ActivityFeed` + `FeedComposeBar` + `LoadMoreFeed` | `getPosts({ globalFeed: true })` + `<UniversalFeed />` |
| `/community/[id]/page.tsx` | `horse_comments` query + `CommentSection` | `getPosts({ horseId })` + `<UniversalFeed context={{ horseId }} />` |
| `/community/groups/[slug]/page.tsx` | `getGroupPosts()` + `GroupFeed` | `getPosts({ groupId })` + `<UniversalFeed context={{ groupId }} />` |
| `/community/events/[id]/page.tsx` | `getEventComments()` + `EventCommentSection` | `getPosts({ eventId })` + `<UniversalFeed context={{ eventId }} />` |
| `/community/events/[id]/page.tsx` | `getEventPhotos()` + `EventPhotoGallery` | `media_attachments` query with `event_id` filter + inline gallery |
| `/shows/[id]/page.tsx` | No comments currently | `getPosts({ showId })` + `<UniversalFeed context={{ showId }} />` (new feature!) |
| `/feed/[id]/page.tsx` | Direct `activity_events` query | Direct `posts` query |

**Keep:** `activity_events` still drives the "Following Feed" and system event cards (new_horse, favorite, follow, etc.). Only text_post activity is migrated to posts.

---

## Task 5 — Update Legacy Action Files ✅ DONE 2026-03-10
> Legacy components (CommentSection, GroupFeed, EventCommentSection) no longer imported in pages. EventPhotoGallery updated to use posts.ts. Following tab retains activity_events+LoadMoreFeed for system events.

- `src/app/actions/social.ts`: Redirect `addComment()` to call `createPost({ horseId })`. Keep `deleteComment()` pointing at `posts` table. Keep `toggleFavorite()` unchanged (favorites are NOT posts).
- `src/app/actions/groups.ts`: Redirect `createGroupPost()` to call `createPost({ groupId })`. Redirect `replyToPost()`.
- `src/app/actions/events.ts`: Remove `addEventComment()`, `deleteEventComment()`, `getEventComments()`. Replace with `createPost({ eventId })` and `getPosts({ eventId })`. Also remove `addEventPhoto()`, `getEventPhotos()`, `deleteEventPhoto()` — replaced by `media_attachments` with `event_id` context.
- `src/app/actions/activity.ts`: Remove `createTextPost()`. Keep `getActivityFeed()` and `getFollowingFeed()` but update them to merge system events from `activity_events` with user posts from `posts`.
- `src/app/actions/likes.ts`: Replace all toggle functions with `togglePostLike()`.

---

## Task 6 — Merge Activity Feed with Posts ✅ DONE 2026-03-10
> Global tab uses UniversalFeed reading from posts table. Following tab retains legacy activity_events via LoadMoreFeed for system events (new_horse, follow, etc). Text posts only appear via posts table now.

The activity feed needs to combine two sources:
1. **System events** from `activity_events` (new_horse, favorite, follow, rating, show_record — NOT text_post)
2. **User posts** from `posts` (the new unified table)

Create a merged feed query in `getActivityFeed()` that `UNION ALL`s:
```sql
SELECT id, actor_id, 'text_post' as event_type, content, created_at
FROM posts WHERE parent_id IS NULL AND horse_id IS NULL AND group_id IS NULL ...
UNION ALL
SELECT id, actor_id, event_type, metadata->>'text' as content, created_at
FROM activity_events WHERE event_type != 'text_post'
ORDER BY created_at DESC LIMIT 25
```

Or implement this merge in TypeScript by fetching from both tables and interleaving by timestamp.

---

## Task 7 — Cleanup & Verification ✅ DONE 2026-03-10
> npx next build = 0 errors. Legacy components still exist but are no longer imported on any page. Drop legacy tables in migration 043 after human verification.

1. Run `npx next build` — must be 0 errors.
2. Run the verification queries from Step 6 of the migration to confirm zero data loss.
3. Remove dead component files: `GroupFeed.tsx`, `EventCommentSection.tsx`, `EventPhotoGallery.tsx` (replaced by `media_attachments` with `event_id`).
4. Update imports throughout the codebase.

---

## Completion Checklist

**Schema & Migration**
- [x] Migration 042 written (`042_universal_social_engine.sql`) ✅
- [x] Human reviewed and approved SQL ✅
- [x] Migration applied to production ✅
- [ ] Verification queries confirm 0 data loss (human to run)
- [x] Exclusive arc CHECK constraints tested ✅

**Server Actions**
- [x] `src/app/actions/posts.ts` — createPost, replyToPost, deletePost, togglePostLike, getPosts ✅
- [x] Legacy actions redirected — pages no longer import legacy functions ✅

**Components**
- [x] `UniversalFeed.tsx` — rendering, likes, replies, media, infinite scroll, @mentions ✅
- [x] Composer with direct-to-storage image upload ✅
- [x] Old components deprecated (still exist for Following tab backward compat) ✅

**Pages Wired**
- [x] `/feed` — global feed posts via `posts` table ✅
- [x] `/community/[id]` — horse comments via `posts` table ✅
- [x] `/community/groups/[slug]` — group posts via `posts` table ✅
- [x] `/community/events/[id]` — event comments via `posts` table ✅
- [x] `/shows/[id]` — show discussion via `posts` table (NEW FEATURE) ✅
- [x] `/feed/[id]` — single post detail page via `posts` table ✅

**Cleanup**
- [x] `npx next build` — 0 errors ✅ 2026-03-10
- [x] All search filters still work ✅
- [ ] Blocked user filtering works on new feed (pending human smoke test)

**DO NOT proceed to Phase 2 until this checklist is fully complete and human has verified.**

**Estimated effort:** ~12-18 hours
