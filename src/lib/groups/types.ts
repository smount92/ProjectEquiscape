/**
 * Groups forum — row types derived from the generated schema
 * (migration 122 applied 2026-07-10; columns flow in via gen-types).
 */

import type { Database } from "@/lib/types/database.generated";

type Tables = Database["public"]["Tables"];

/** posts row fields the forum reads. */
export type ForumPostRow = Pick<
    Tables["posts"]["Row"],
    | "id"
    | "author_id"
    | "content"
    | "title"
    | "parent_id"
    | "group_id"
    | "channel_id"
    | "likes_count"
    | "replies_count"
    | "is_pinned"
    | "created_at"
    | "bumped_at"
>;

/** group_last_read row (table added in 122). */
export type GroupLastReadRow = Tables["group_last_read"]["Row"];

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
