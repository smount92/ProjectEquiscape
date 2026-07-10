/**
 * Groups forum — interim hand-written types (Phase-B style).
 *
 * Migration 122 adds posts.title / posts.bumped_at and the
 * group_last_read table, but it is FILE-ONLY until the owner applies
 * it, so database.generated.ts does not know these columns yet.
 *
 * TODO(after migration 122 is applied + `npm run gen-types`):
 * replace the row shapes below with derivations from
 * Database["public"]["Tables"] like src/lib/shows/types.ts does.
 */

// ── Row shapes (replace after gen-types) ──

/** posts row fields the forum reads. */
export interface ForumPostRow {
    id: string;
    author_id: string;
    content: string;
    title: string | null; // added in 122
    parent_id: string | null;
    group_id: string | null;
    channel_id: string | null;
    likes_count: number;
    replies_count: number;
    is_pinned: boolean;
    created_at: string;
    bumped_at: string; // added in 122
}

/** group_last_read row (new table in 122). */
export interface GroupLastReadRow {
    group_id: string;
    user_id: string;
    last_read_at: string;
}

// ── Action view models ──

/** One row on the group notice board. */
export interface BoardThread {
    id: string;
    /** Stored title, or first-line derivation for pre-forum posts. */
    displayTitle: string;
    authorId: string;
    authorAlias: string;
    authorAvatarUrl: string | null;
    repliesCount: number;
    /** Alias of the most recent replier, if any (best effort). */
    lastReplyAlias: string | null;
    /** bumped_at — when the thread last saw activity. */
    lastActivity: string;
    isPinned: boolean;
    channelId: string | null;
    /** Bumped since the viewer's last board visit? */
    unread: boolean;
    createdAt: string;
}

/** A post inside the thread view (OP or reply). */
export interface ThreadPost {
    id: string;
    authorId: string;
    authorAlias: string;
    authorAvatarUrl: string | null;
    content: string;
    likesCount: number;
    isLikedByMe: boolean;
    createdAt: string;
}

/** Full thread view: OP + paginated replies. */
export interface ThreadViewData {
    id: string;
    groupId: string;
    channelId: string | null;
    channelName: string | null;
    displayTitle: string;
    isPinned: boolean;
    repliesCount: number;
    op: ThreadPost;
    replies: ThreadPost[];
    hasMoreReplies: boolean;
}
