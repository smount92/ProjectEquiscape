"use server";

import { logger } from "@/lib/logger";
import { catalogDisplayName } from "@/lib/catalog/displayName";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { resolveAvatarUrls } from "@/lib/utils/avatars.server";
import { sanitizeText } from "@/lib/utils/validation";
import { getPostColumnSupport } from "@/lib/feed/columnSupport";
import {
    mergeByCreatedAtDesc,
    takePage,
    isAuditNote,
    isGloballyVisible,
    type ContextualRow,
} from "@/lib/feed/stream";

// ============================================================
// UNIVERSAL POSTS — Server Actions
// A single post system for all text content in the platform.
// ============================================================

export type PostVisibility = "public" | "followers";

export interface Post {
    id: string;
    authorId: string;
    authorAlias: string;
    authorAvatarUrl: string | null;
    content: string;
    parentId: string | null;
    horseId: string | null;
    groupId: string | null;
    eventId: string | null;
    studioId: string | null;
    helpRequestId: string | null;
    likesCount: number;
    repliesCount: number;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string | null;
    media: { id: string; imageUrl: string; caption: string | null }[];
    isLikedByMe: boolean;
    replies: Post[];
}

// ── Create a post in any context ──
/**
 * Create a new post in the activity feed.
 * Supports optional horse attachment and @mentions.
 * @param data - Post content and optional attachments
 */
export async function createPost(data: {
    content: string;
    horseId?: string;
    groupId?: string;
    eventId?: string;
    studioId?: string;
    helpRequestId?: string;
    imagePaths?: string[];
    /**
     * Audience for a top-level post: "public" (default) or "followers".
     * Silently ignored until migration 166 adds posts.visibility — a
     * missing column must never turn a compose into a 500.
     */
    visibility?: PostVisibility;
}): Promise<{ success: boolean; postId?: string; error?: string }> {
    const { supabase, user } = await requireAuth();
    if (!data.content.trim() && (!data.imagePaths || data.imagePaths.length === 0)) {
        return { success: false, error: "Post cannot be empty." };
    }
    if (data.content.trim().length > 2000) {
        return { success: false, error: "Post is too long (2000 char max)." };
    }

    const insertRow: Record<string, unknown> = {
        author_id: user.id,
        content: sanitizeText(data.content),
        horse_id: data.horseId || null,
        group_id: data.groupId || null,
        event_id: data.eventId || null,
        studio_id: data.studioId || null,
        help_request_id: data.helpRequestId || null,
    };

    if (data.visibility === "followers") {
        const support = await getPostColumnSupport(supabase);
        if (support.visibility) insertRow.visibility = "followers";
    }

    const { data: post, error } = await supabase.from("posts").insert(insertRow).select("id").single();

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
    if (data.eventId) revalidatePath(`/shows/${data.eventId}`);
    if (data.studioId) revalidatePath(`/studio`);
    revalidatePath("/feed");
    revalidateTag("feed", "max");

    // Deferred: notify context owner + mentions after response is sent
    const userId = user.id;
    const content = data.content.trim();
    const postIdFinal = post!.id;
    const eventId = data.eventId;
    const studioId = data.studioId;
    const horseId = data.horseId;
    after(async () => {
        try {
            const supabaseDeferred = await (await import("@/lib/supabase/server")).createClient();
            const { data: actor } = await supabaseDeferred.from("users").select("alias_name").eq("id", userId).single();
            const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
            const { createNotification } = await import("@/lib/notifications/createNotification");
            const { parseAndNotifyMentions } = await import("@/app/actions/mentions");

            // Notify event creator
            if (eventId) {
                const { data: event } = await supabaseDeferred.from("events").select("created_by, name").eq("id", eventId).single();
                if (event && (event as { created_by: string }).created_by !== userId) {
                    await createNotification({
                        userId: (event as { created_by: string }).created_by,
                        type: "comment",
                        actorId: userId,
                        content: `@${alias} commented on your event "${(event as { name: string }).name}"`,
                        linkUrl: `/shows/${eventId}`,
                    });
                }
            }

            // Notify horse owner — passport comments are the most common
            // social act on the site and previously notified NOBODY: the
            // owner only discovered comments by revisiting their own page.
            if (horseId) {
                const { data: horse } = await supabaseDeferred
                    .from("user_horses")
                    .select("owner_id, custom_name")
                    .eq("id", horseId)
                    .single();
                if (horse && (horse as { owner_id: string }).owner_id !== userId) {
                    await createNotification({
                        userId: (horse as { owner_id: string }).owner_id,
                        type: "comment",
                        actorId: userId,
                        content: `@${alias} commented on ${(horse as { custom_name: string }).custom_name}`,
                        linkUrl: `/community/${horseId}`,
                    });
                }
            }

            // Notify studio owner
            if (studioId) {
                const { data: studio } = await supabaseDeferred.from("artist_profiles").select("user_id, studio_name").eq("user_id", studioId).single();
                if (studio && (studio as { user_id: string }).user_id !== userId) {
                    await createNotification({
                        userId: (studio as { user_id: string }).user_id,
                        type: "comment",
                        actorId: userId,
                        content: `@${alias} commented on your studio "${(studio as { studio_name: string }).studio_name}"`,
                        linkUrl: `/studio`,
                    });
                }
            }

            // Notify @mentions
            await parseAndNotifyMentions(content, userId, alias, `/feed/${postIdFinal}`);

            // Evaluate post achievements
            const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
            await evaluateUserAchievements(userId, "post_created");
        } catch (err) { logger.error("Posts", "Background task failed", err); }
    });

    return { success: true, postId: post!.id };
}

// ── Reply to a post (1 level deep) ──
/**
 * Reply to an existing post (creates a threaded comment).
 * Notifies the original post author.
 * @param postId - UUID of the parent post
 * @param content - Reply text content
 */
export async function replyToPost(
    parentId: string,
    content: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();
    if (!content.trim()) return { success: false, error: "Reply cannot be empty." };
    if (content.trim().length > 500) return { success: false, error: "Reply is too long (500 char max)." };

    const { error } = await supabase.rpc("add_post_reply", {
        p_parent_id: parentId,
        p_author_id: user.id,
        p_content: sanitizeText(content),
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/feed");

    // Deferred: notify parent post author + handle @mentions
    const userId = user.id;
    const trimmedContent = content.trim();
    after(async () => {
        try {
            const supabaseDeferred = await (await import("@/lib/supabase/server")).createClient();
            const { data: parentPost } = await supabaseDeferred.from("posts").select("author_id").eq("id", parentId).single();
            const { data: actor } = await supabaseDeferred.from("users").select("alias_name").eq("id", userId).single();
            const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";

            if (parentPost && (parentPost as { author_id: string }).author_id !== userId) {
                const { createNotification } = await import("@/lib/notifications/createNotification");
                await createNotification({
                    userId: (parentPost as { author_id: string }).author_id,
                    type: "reply",
                    actorId: userId,
                    content: `@${alias} replied to your post`,
                    linkUrl: `/feed/${parentId}`,
                });
            }

            // @mentions in reply
            const { parseAndNotifyMentions } = await import("@/app/actions/mentions");
            await parseAndNotifyMentions(trimmedContent, userId, alias, `/feed/${parentId}`);
        } catch (err) { logger.error("Posts", "Background task failed", err); }
    });

    return { success: true };
}

export async function deletePost(
    postId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();
    const isAdmin = user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();

    // Fetch post first so we know context for revalidation + ownership check
    const { data: postRow } = await supabase
        .from("posts")
        .select("id, author_id, horse_id, group_id, event_id")
        .eq("id", postId)
        .maybeSingle();

    if (!postRow) return { success: false, error: "Post not found." };
    const pr = postRow as { id: string; author_id: string; horse_id: string | null; group_id: string | null; event_id: string | null };

    if (pr.author_id !== user.id && !isAdmin) {
        return { success: false, error: "You can only delete your own posts." };
    }

    // Clean up storage files for attached media. The table stores
    // bucket-relative storage_path (there is no image_url column — the
    // old select for one errored silently and leaked every file since
    // migration 042).
    try {
        const { data: media } = await supabase
            .from("media_attachments")
            .select("storage_path")
            .eq("post_id", postId);

        if (media && media.length > 0) {
            const paths = (media as { storage_path: string }[])
                .map(m => m.storage_path)
                .filter(Boolean);

            if (paths.length > 0) {
                await supabase.storage.from("horse-images").remove(paths);
            }
        }
    } catch (err) { logger.error("Posts", "Media cleanup failed during post deletion", err); }

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) return { success: false, error: error.message };

    // Revalidate all relevant paths
    revalidatePath("/feed");
    if (pr.horse_id) revalidatePath(`/community/${pr.horse_id}`);
    if (pr.group_id) revalidatePath("/community/groups");
    if (pr.event_id) {
        revalidatePath(`/community/events/${pr.event_id}`);
        revalidatePath(`/shows/${pr.event_id}`);
    }
    return { success: true };
}

// ── Update a post (author only) ──
/**
 * Update the content of a post the current user authored.
 * @param postId - UUID of the post to update
 * @param content - New post content
 */
export async function updatePost(
    postId: string,
    newContent: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (!newContent.trim()) return { success: false, error: "Content cannot be empty." };
    if (newContent.length > 10000) return { success: false, error: "Content is too long." };

    // .select() makes the row count observable. Under RLS, an update the
    // caller isn't allowed matches ZERO rows and returns NO error — this
    // action reported success that way for months while no UPDATE policy
    // existed on posts at all (added in migration 195). Demanding the
    // updated row back turns that silent nothing into an honest failure.
    const { data: updated, error } = await supabase
        .from("posts")
        .update({
            content: newContent.trim(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .eq("author_id", user.id)
        .select("id");

    if (error) return { success: false, error: error.message };
    if (!updated || updated.length === 0) {
        return {
            success: false,
            error: "The edit didn't save. If this keeps happening, the site's edit permission may be missing — tell an admin.",
        };
    }
    // Barn threads live in the same posts table, so an edit there must
    // bust that surface too, not just the feed.
    revalidatePath("/feed");
    revalidatePath("/community/groups");
    return { success: true };
}

// ── Toggle like (atomic RPC) ──
/**
 * Like or unlike a post. Idempotent toggle.
 * Creates a notification for the post author on like.
 * @param postId - UUID of the post to like/unlike
 */
export async function togglePostLike(
    postId: string
): Promise<{ success: boolean; action?: string; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { data, error } = await supabase.rpc("toggle_post_like", {
        p_post_id: postId,
        p_user_id: user.id,
    });

    if (error) return { success: false, error: error.message };

    const action = (data as { action: string })?.action;

    // Notify post author on like (not unlike)
    if (action === "liked") {
        const userId = user.id;
        after(async () => {
            try {
                const supabaseDeferred = await (await import("@/lib/supabase/server")).createClient();
                const { data: post } = await supabaseDeferred.from("posts").select("author_id").eq("id", postId).single();
                if (post && (post as { author_id: string }).author_id !== userId) {
                    const { data: actor } = await supabaseDeferred.from("users").select("alias_name").eq("id", userId).single();
                    const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
                    const { createNotification } = await import("@/lib/notifications/createNotification");
                    await createNotification({
                        userId: (post as { author_id: string }).author_id,
                        type: "like",
                        actorId: userId,
                        content: `@${alias} liked your post`,
                        linkUrl: `/feed`,
                    });
                }
            } catch (err) { logger.error("Posts", "Background task failed", err); }
        });
    }

    return { success: true, action };
}

// ── Get posts for a context ──
/**
 * Get posts for a given context (feed, profile, horse, or group).
 * Supports cursor-based pagination.
 * @param context - Query context: type, targetId, cursor, limit
 * @returns Array of posts with author and engagement data
 */
export async function getPosts(context: {
    horseId?: string;
    groupId?: string;
    eventId?: string;
    globalFeed?: boolean;
}, options?: {
    limit?: number;
    cursor?: string;
    includeReplies?: boolean;
}): Promise<Post[]> {
    const { supabase, user } = await requireAuth();

    let query = supabase
        .from("posts")
        .select("id, author_id, content, parent_id, horse_id, group_id, event_id, likes_count, replies_count, is_pinned, created_at, updated_at, users!posts_author_id_fkey(alias_name, avatar_url)")
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(options?.limit || 25);

    // Context filters
    if (context.horseId) {
        query = query.eq("horse_id", context.horseId);
    } else if (context.groupId) {
        query = query.eq("group_id", context.groupId);
    } else if (context.eventId) {
        query = query.eq("event_id", context.eventId);
    } else if (context.globalFeed) {
        query = query
            .is("horse_id", null)
            .is("group_id", null)
            .is("event_id", null)
            .is("studio_id", null)
            .is("help_request_id", null);
    }

    if (options?.cursor) {
        query = query.lt("created_at", options.cursor);
    }

    const { data: rawPosts } = await query;
    if (!rawPosts || rawPosts.length === 0) return [];

    // Hide blocked users' posts (house pattern: my blocks hide their
    // content from me — same one-directional filter the Show Ring
    // applies). Filtered before the id list so their replies and
    // media never load either.
    const { data: myBlocks } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
    const blockedIds = new Set((myBlocks ?? []).map((b: { blocked_id: string }) => b.blocked_id));
    const posts = (rawPosts as Record<string, unknown>[]).filter(
        (p) => !blockedIds.has(p.author_id as string),
    );
    if (posts.length === 0) return [];

    const postIds = posts.map(p => p.id as string);

    // Fetch media for all posts in one query
    const { data: media } = await supabase
        .from("media_attachments")
        .select("id, storage_path, post_id, caption")
        .in("post_id", postIds);

    // Generate public URLs for media
    const allPaths = (media ?? []).map((m: { storage_path: string }) => m.storage_path);
    const urlMap = getPublicImageUrls(allPaths);

    // Check which posts the user has liked
    const { data: likedRows } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);
    const likedSet = new Set((likedRows ?? []).map((l: { post_id: string }) => l.post_id));

    // Optionally fetch replies
    const repliesMap = new Map<string, Post[]>();
    if (options?.includeReplies) {
        const { data: replies } = await supabase
            .from("posts")
            .select("id, author_id, content, parent_id, likes_count, created_at, users!posts_author_id_fkey(alias_name, avatar_url)")
            .in("parent_id", postIds)
            .order("created_at", { ascending: true })
            .limit(100); // Global cap: ~5 replies × 20 posts = 100 max

        for (const r of (replies ?? []) as Record<string, unknown>[]) {
            if (blockedIds.has(r.author_id as string)) continue;
            const parentKey = r.parent_id as string;
            if (!repliesMap.has(parentKey)) repliesMap.set(parentKey, []);
            const replyUser = r.users as { alias_name: string; avatar_url: string | null } | null;
            repliesMap.get(parentKey)!.push({
                id: r.id as string,
                authorId: r.author_id as string,
                authorAlias: replyUser?.alias_name ?? "Unknown",
                authorAvatarUrl: replyUser?.avatar_url ?? null,
                content: r.content as string,
                parentId: r.parent_id as string,
                horseId: null, groupId: null, eventId: null, studioId: null, helpRequestId: null,
                likesCount: (r.likes_count as number) || 0,
                repliesCount: 0,
                isPinned: false,
                createdAt: r.created_at as string,
                updatedAt: null,
                media: [],
                isLikedByMe: false,
                replies: [],
            });
        }
    }

    const mapped = posts.map(p => {
        const postUser = p.users as { alias_name: string; avatar_url: string | null } | null;
        return {
            id: p.id as string,
            authorId: p.author_id as string,
            authorAlias: postUser?.alias_name ?? "Unknown",
            authorAvatarUrl: postUser?.avatar_url ?? null,
            content: p.content as string,
            parentId: null,
            horseId: p.horse_id as string | null,
            groupId: p.group_id as string | null,
            eventId: p.event_id as string | null,
            studioId: null,
            helpRequestId: null,
            likesCount: (p.likes_count as number) || 0,
            repliesCount: (p.replies_count as number) || 0,
            isPinned: (p.is_pinned as boolean) || false,
            createdAt: p.created_at as string,
            updatedAt: (p.updated_at as string | null) || null,
            media: (media ?? [])
                .filter((m: { post_id: string }) => m.post_id === p.id)
                .map((m: { id: string; storage_path: string; caption: string | null }) => ({
                    id: m.id,
                    imageUrl: urlMap.get(m.storage_path) || "",
                    caption: m.caption,
                })),
            isLikedByMe: likedSet.has(p.id as string),
            replies: repliesMap.get(p.id as string) || [],
        } as Post;
    });

    // Batch-resolve avatar storage paths → signed URLs
    const allAvatarPaths: (string | null)[] = [];
    for (const post of mapped) {
        allAvatarPaths.push(post.authorAvatarUrl);
        for (const reply of post.replies) {
            allAvatarPaths.push(reply.authorAvatarUrl);
        }
    }
    const avatarUrlMap = await resolveAvatarUrls(allAvatarPaths);
    for (const post of mapped) {
        if (post.authorAvatarUrl) {
            post.authorAvatarUrl = avatarUrlMap.get(post.authorAvatarUrl) || post.authorAvatarUrl;
        }
        for (const reply of post.replies) {
            if (reply.authorAvatarUrl) {
                reply.authorAvatarUrl = avatarUrlMap.get(reply.authorAvatarUrl) || reply.authorAvatarUrl;
            }
        }
    }

    return mapped;
}

// ── Get event media (replaces getEventPhotos) ──
/**
 * Get photos/media attached to a community event.
 * @param eventId - UUID of the event
 * @returns Array of media records with URLs and captions
 */
export async function getEventMedia(eventId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("media_attachments")
        .select("id, storage_path, event_id, caption, created_at, uploader_id, users!media_attachments_uploader_id_fkey(alias_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    const items = data ?? [];

    if (items.length === 0) return [];
    const paths = items.map(i => i.storage_path);
    const urlMap = getPublicImageUrls(paths);

    return items.map(i => ({
        id: i.id,
        imageUrl: urlMap.get(i.storage_path) || "",
        caption: i.caption,
        createdAt: i.created_at,
        userId: i.uploader_id,
        userAlias: i.users?.alias_name ?? "Unknown",
    }));
}

// ── Add event media (replaces addEventPhoto) ──
/**
 * Upload a photo to a community event's media gallery.
 * @param eventId - UUID of the event
 * @param data - Media data: imageUrl, caption
 */
export async function addEventMedia(
    eventId: string,
    imagePath: string,
    caption?: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { error } = await supabase.from("media_attachments").insert({
        event_id: eventId,
        uploader_id: user.id,
        storage_path: imagePath,
        caption: caption?.trim() || null,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/community/events/${eventId}`);
    return { success: true };
}

// ── Delete event media ──
/**
 * Delete a media item from an event's gallery (uploader or admin only).
 * @param mediaId - UUID of the media record to delete
 */
export async function deleteEventMedia(
    mediaId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Fetch the storage path before deleting the row (bucket-relative;
    // same nonexistent-column fix as deletePost).
    try {
        const { data: media } = await supabase
            .from("media_attachments")
            .select("storage_path")
            .eq("id", mediaId)
            .maybeSingle();

        const path = (media as { storage_path: string } | null)?.storage_path;
        if (path) {
            await supabase.storage.from("horse-images").remove([path]);
        }
    } catch (err) { logger.error("Posts", "Background task failed", err); }

    const { error } = await supabase.from("media_attachments").delete().eq("id", mediaId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/community/events");
    return { success: true };
}

// ── Get horse embed data for rich previews ──
/**
 * Fetch minimal horse data for rich embed cards in post content.
 * Returns public horse info only — no private data.
 * @param horseId - UUID of the horse to look up
 */
export async function getHorseEmbedData(horseId: string): Promise<{
    name: string;
    refName: string | null;
    thumbnailUrl: string | null;
    tradeStatus: string;
} | null> {
    const supabase = await createClient();

    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, custom_name, trade_status, visibility, catalog_id, catalog_items(title, maker)")
        .eq("id", horseId)
        .is("deleted_at", null)
        .maybeSingle();

    if (!horse) return null;

    const h = horse as {
        id: string;
        custom_name: string;
        trade_status: string;
        visibility: string;
        catalog_id: string | null;
        catalog_items: { title: string; maker: string } | null;
    };

    // Only show public horses in embeds
    if (h.visibility !== "public") return null;

    // Get primary thumbnail
    const { data: primaryImage } = await supabase
        .from("horse_images")
        .select("image_url")
        .eq("horse_id", horseId)
        .eq("angle_profile", "Primary_Thumbnail")
        .maybeSingle();

    let thumbnailUrl: string | null = null;
    if (primaryImage) {
        const pi = primaryImage as { image_url: string };
        thumbnailUrl = pi.image_url;
    }

    const refName = h.catalog_items ? catalogDisplayName(h.catalog_items.maker, h.catalog_items.title) : null;

    return {
        name: h.custom_name,
        refName,
        thumbnailUrl,
        tradeStatus: h.trade_status,
    };
}

// ============================================================
// THE ONE FEED
//
// /feed used to be two disconnected halves: a "Global" tab on the
// `posts` table that deliberately excluded every contextual post,
// and a "Following" tab on the legacy `activity_events` table.
// Nothing a horse, a group or a show produced ever reached either.
//
// getFeedStream is the single chronological stream that replaces
// both. It reads `posts` as the spine, interleaves the legacy
// activity_events text posts read-only (they are never written
// again, but they must never disappear either), and applies one
// visibility rule — isGloballyVisible, tested in lib/feed/stream —
// on top of RLS.
//
// The rule that cannot bend: a private or unlisted horse's posts,
// and a private or restricted group's posts, NEVER appear here.
// RLS already blocks private horses; it does NOT block a private
// group from its own members, so the app filter is load-bearing,
// not belt-and-braces.
// ============================================================

const FEED_POST_COLUMNS =
    "id, author_id, content, parent_id, horse_id, group_id, event_id, studio_id, help_request_id, channel_id, show_id, likes_count, replies_count, is_pinned, created_at, updated_at, users!posts_author_id_fkey(alias_name, avatar_url)";

export type FeedScope = "everyone" | "following";

/** A row from either store, reduced to what the merge needs. */
interface FeedShell {
    id: string;
    createdAt: string;
    row: Record<string, unknown>;
    source: "post" | "activity";
}

export interface FeedStreamItem {
    id: string;
    /** Which store this row came from. Legacy rows are read-only. */
    source: "post" | "activity";
    /** "user" for composed posts, "show_results" for a show's announcement. */
    kind: string;
    /** Admin-pinned: held above the stream on the feed's first page. */
    isPinned: boolean;
    authorId: string;
    authorAlias: string;
    authorAvatarUrl: string | null;
    content: string;
    createdAt: string;
    updatedAt: string | null;
    likesCount: number;
    isLikedByMe: boolean;
    repliesCount: number;
    replies: Post[];
    media: { id: string; imageUrl: string; caption: string | null }[];
    /** "public" | "followers". Always "public" before migration 166. */
    visibility: PostVisibility;
    /** Where this post was written, when it wasn't written in the feed. */
    context: { label: string; href: string } | null;
    /** Author-only affordances. Legacy rows can be deleted but not edited. */
    canEdit: boolean;
    canDelete: boolean;
}

export interface FeedStreamPage {
    items: FeedStreamItem[];
    nextCursor: string | null;
    /**
     * Every real alias mentioned anywhere on this page, so RichText can
     * link "@black fox farm" as one name instead of tagging "@black".
     */
    knownAliases: string[];
}

/**
 * Read one page of the unified feed.
 *
 * @param options.scope   "everyone" (default) or "following" — authors
 *                        the viewer follows, plus the viewer.
 * @param options.cursor  created_at of the last row of the previous page.
 * @param options.limit   page size (default 25, hard-capped at 50).
 */
export async function getFeedStream(options?: {
    scope?: FeedScope;
    cursor?: string | null;
    limit?: number;
}): Promise<FeedStreamPage> {
    const { supabase, user } = await requireAuth();
    const scope: FeedScope = options?.scope === "following" ? "following" : "everyone";
    const limit = Math.min(Math.max(options?.limit ?? 25, 1), 50);
    const cursor = options?.cursor || null;

    // ── Prologue: blocks, follows and column support are independent of
    //    each other, and the feed used to await all three in a row before
    //    it could even ask for a post. One wave. ──
    const [{ data: myBlocks }, followsResult, support] = await Promise.all([
        // Who is hidden from me
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
        // Who I follow (Following scope only)
        scope === "following"
            ? supabase.from("user_follows").select("following_id").eq("follower_id", user.id)
            : null,
        getPostColumnSupport(supabase),
    ]);
    const blockedIds = new Set((myBlocks ?? []).map((b: { blocked_id: string }) => b.blocked_id));

    let authorAllowList: string[] | null = null;
    if (scope === "following") {
        const ids = ((followsResult?.data ?? []) as { following_id: string }[])
            .map((f) => f.following_id)
            .filter((id: string) => !blockedIds.has(id));
        // Your own posts belong in your Following feed — the legacy
        // activity feed did this too and people expect it.
        ids.push(user.id);
        authorAllowList = [...new Set(ids)];
        if (authorAllowList.length === 0) {
            return { items: [], nextCursor: null, knownAliases: [] };
        }
    }

    let selectColumns = FEED_POST_COLUMNS;
    if (support.kind) selectColumns += ", kind";
    if (support.visibility) selectColumns += ", visibility";

    // ── Pinned announcements — held above the stream, first page only ──
    // Admin-pinned, context-free posts (setFeedPostPinned in admin.ts).
    // They ride the same visibility/block filters as everything else and
    // are excluded from the regular batches so they never appear twice.
    let pinnedRows: Record<string, unknown>[] = [];
    if (!cursor) {
        const { data: pinnedRaw } = await supabase
            .from("posts")
            .select(selectColumns)
            .is("parent_id", null)
            .eq("is_pinned", true)
            .order("created_at", { ascending: false })
            .limit(3);
        const eligible = ((pinnedRaw ?? []) as unknown as Record<string, unknown>[]).filter(
            (r) => !blockedIds.has(r.author_id as string),
        );
        pinnedRows = await filterToGloballyVisible(supabase, eligible);
    }
    const pinnedIds = new Set(pinnedRows.map((r) => r.id as string));

    // PostgREST puts `.in()` lists in the query string, so a viewer who
    // follows hundreds of people would build a URL long enough to be
    // rejected. Past that size, ask for the unfiltered page and narrow
    // it here instead.
    const authorSet = authorAllowList ? new Set(authorAllowList) : null;
    const useInFilter = !!authorAllowList && authorAllowList.length <= 300;

    // ── Spine: `posts` ────────────────────────────────────────
    // Visibility filtering happens after the fetch (it needs the
    // horses'/groups' own visibility), so a batch can come back mostly
    // empty. Re-fetch a bounded number of times rather than handing the
    // reader a near-empty page that looks like the end of the feed.
    const visiblePosts: Record<string, unknown>[] = [];
    let postCursor = cursor;
    let postsExhausted = false;
    const batchSize = Math.min(limit * 3, 100);

    for (let round = 0; round < 3 && visiblePosts.length <= limit && !postsExhausted; round++) {
        let query = supabase
            .from("posts")
            .select(selectColumns)
            .is("parent_id", null)
            .order("created_at", { ascending: false })
            .limit(batchSize);
        if (useInFilter && authorAllowList) query = query.in("author_id", authorAllowList);
        if (postCursor) query = query.lt("created_at", postCursor);

        const { data: batch } = await query;
        const rows = (batch ?? []) as unknown as Record<string, unknown>[];
        if (rows.length < batchSize) postsExhausted = true;
        if (rows.length === 0) break;

        postCursor = rows[rows.length - 1].created_at as string;

        const eligible = rows.filter(
            (r) =>
                !pinnedIds.has(r.id as string) &&
                !blockedIds.has(r.author_id as string) &&
                (useInFilter || !authorSet || authorSet.has(r.author_id as string)),
        );
        const kept = await filterToGloballyVisible(supabase, eligible);
        visiblePosts.push(...kept);
    }

    // ── Legacy: activity_events text posts, read-only ─────────
    let legacyQuery = supabase
        .from("activity_events")
        .select("id, actor_id, metadata, image_urls, created_at, likes_count, users!actor_id(alias_name, avatar_url)")
        .eq("event_type", "text_post")
        .order("created_at", { ascending: false })
        .limit(limit + 1);
    if (useInFilter && authorAllowList) legacyQuery = legacyQuery.in("actor_id", authorAllowList);
    if (cursor) legacyQuery = legacyQuery.lt("created_at", cursor);

    const { data: legacyRows } = await legacyQuery;
    const legacy = ((legacyRows ?? []) as unknown as Record<string, unknown>[]).filter(
        (e) =>
            !blockedIds.has(e.actor_id as string) &&
            (useInFilter || !authorSet || authorSet.has(e.actor_id as string)),
    );
    const legacyExhausted = (legacyRows ?? []).length <= limit;

    // ── Merge, cut to one page ────────────────────────────────
    const postShells: FeedShell[] = visiblePosts.map((p) => ({
        id: p.id as string,
        createdAt: p.created_at as string,
        row: p,
        source: "post",
    }));
    const legacyShells: FeedShell[] = legacy.map((e) => ({
        id: e.id as string,
        createdAt: e.created_at as string,
        row: e,
        source: "activity",
    }));

    const merged = mergeByCreatedAtDesc(postShells, legacyShells);
    const page = takePage(merged, limit, postsExhausted && legacyExhausted);
    if (page.items.length === 0 && pinnedRows.length === 0) {
        // Nothing survived the visibility filter, but the stores are not
        // exhausted — hand back where we got to so "Load more" can keep
        // walking rather than showing a false end of the feed.
        const stalled = !postsExhausted && postCursor && postCursor !== cursor ? postCursor : null;
        return { items: [], nextCursor: stalled, knownAliases: [] };
    }

    const pagePostRows = page.items.filter((s) => s.source === "post").map((s) => s.row);
    const pageLegacyRows = page.items.filter((s) => s.source === "activity").map((s) => s.row);

    const [postItems, legacyItems, knownAliases] = await Promise.all([
        hydratePostItems(supabase, user.id, [...pinnedRows, ...pagePostRows], blockedIds),
        hydrateLegacyItems(supabase, user.id, pageLegacyRows),
        resolvePageAliases([
            ...pinnedRows.map((r) => (r.content as string) || ""),
            ...page.items.map((s) => contentOf(s.row, s.source)),
        ]),
    ]);

    const byId = new Map<string, FeedStreamItem>();
    for (const item of [...postItems, ...legacyItems]) byId.set(item.id, item);

    const pinnedItems = pinnedRows
        .map((r) => byId.get(r.id as string))
        .filter((i): i is FeedStreamItem => !!i);
    const items = [
        ...pinnedItems,
        ...page.items.map((s) => byId.get(s.id)).filter((i): i is FeedStreamItem => !!i),
    ];

    // Batch-resolve avatar storage paths → signed URLs (posts + replies).
    const avatarPaths: (string | null)[] = [];
    for (const item of items) {
        avatarPaths.push(item.authorAvatarUrl);
        for (const reply of item.replies) avatarPaths.push(reply.authorAvatarUrl);
    }
    const avatarUrlMap = await resolveAvatarUrls(avatarPaths);
    for (const item of items) {
        if (item.authorAvatarUrl) {
            item.authorAvatarUrl = avatarUrlMap.get(item.authorAvatarUrl) || item.authorAvatarUrl;
        }
        for (const reply of item.replies) {
            if (reply.authorAvatarUrl) {
                reply.authorAvatarUrl = avatarUrlMap.get(reply.authorAvatarUrl) || reply.authorAvatarUrl;
            }
        }
    }

    return { items, nextCursor: page.nextCursor, knownAliases };
}

function contentOf(row: Record<string, unknown>, source: "post" | "activity"): string {
    if (source === "post") return (row.content as string) || "";
    return ((row.metadata as { text?: string } | null)?.text as string) || "";
}

/**
 * Drop every row whose context is not something the whole site can
 * see. Batches the two visibility lookups (horses, groups) so this
 * costs at most two extra queries per fetch round.
 */
async function filterToGloballyVisible(
    supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
    rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
    if (rows.length === 0) return [];

    const horseIds = [...new Set(rows.map((r) => r.horse_id as string | null).filter(Boolean))] as string[];
    const groupIds = [...new Set(rows.map((r) => r.group_id as string | null).filter(Boolean))] as string[];

    const publicHorseIds = new Set<string>();
    const publicGroupIds = new Set<string>();

    if (horseIds.length > 0) {
        // `visibility` is the authoritative column (migration 150):
        // 'public' only — 'unlisted' is link-viewable but listed nowhere,
        // and a feed is the definition of "listed".
        const { data } = await supabase
            .from("user_horses")
            .select("id, visibility, deleted_at")
            .in("id", horseIds);
        for (const h of (data ?? []) as { id: string; visibility: string; deleted_at: string | null }[]) {
            if (h.visibility === "public" && !h.deleted_at) publicHorseIds.add(h.id);
        }
    }

    if (groupIds.length > 0) {
        // groups.visibility is 'public' | 'restricted' | 'private'.
        // Only 'public' reaches the global feed; RLS lets a member read
        // their own private group's posts, so this filter is the only
        // thing standing between a private group and the world.
        const { data } = await supabase
            .from("groups")
            .select("id, visibility")
            .in("id", groupIds);
        for (const g of (data ?? []) as { id: string; visibility: string }[]) {
            if (g.visibility === "public") publicGroupIds.add(g.id);
        }
    }

    return rows.filter(
        (r) =>
            !isAuditNote(r.content as string | null, (r.kind as string | null) ?? null) &&
            isGloballyVisible(
                {
                    horseId: (r.horse_id as string | null) ?? null,
                    groupId: (r.group_id as string | null) ?? null,
                    eventId: (r.event_id as string | null) ?? null,
                    studioId: (r.studio_id as string | null) ?? null,
                    helpRequestId: (r.help_request_id as string | null) ?? null,
                    channelId: (r.channel_id as string | null) ?? null,
                } satisfies ContextualRow,
                publicHorseIds,
                publicGroupIds,
            ),
    );
}

/** Media, likes, replies and context labels for the `posts` half of a page. */
async function hydratePostItems(
    supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
    userId: string,
    rows: Record<string, unknown>[],
    blockedIds: ReadonlySet<string>,
): Promise<FeedStreamItem[]> {
    if (rows.length === 0) return [];
    const postIds = rows.map((r) => r.id as string);

    const [mediaRes, likedRes, repliesRes] = await Promise.all([
        supabase.from("media_attachments").select("id, storage_path, post_id, caption").in("post_id", postIds),
        supabase.from("likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase
            .from("posts")
            .select("id, author_id, content, parent_id, likes_count, created_at, users!posts_author_id_fkey(alias_name, avatar_url)")
            .in("parent_id", postIds)
            .order("created_at", { ascending: true })
            .limit(150),
    ]);

    const media = (mediaRes.data ?? []) as { id: string; storage_path: string; post_id: string; caption: string | null }[];
    const urlMap = getPublicImageUrls(media.map((m) => m.storage_path));
    const likedSet = new Set(((likedRes.data ?? []) as { post_id: string }[]).map((l) => l.post_id));

    const repliesMap = new Map<string, Post[]>();
    for (const r of (repliesRes.data ?? []) as unknown as Record<string, unknown>[]) {
        // Same one-directional block rule getPosts applies: my blocks
        // hide their content from me, replies included.
        if (blockedIds.has(r.author_id as string)) continue;
        const parentKey = r.parent_id as string;
        if (!repliesMap.has(parentKey)) repliesMap.set(parentKey, []);
        const replyUser = r.users as { alias_name: string; avatar_url: string | null } | null;
        repliesMap.get(parentKey)!.push({
            id: r.id as string,
            authorId: r.author_id as string,
            authorAlias: replyUser?.alias_name ?? "Unknown",
            authorAvatarUrl: replyUser?.avatar_url ?? null,
            content: r.content as string,
            parentId: parentKey,
            horseId: null, groupId: null, eventId: null, studioId: null, helpRequestId: null,
            likesCount: (r.likes_count as number) || 0,
            repliesCount: 0,
            isPinned: false,
            createdAt: r.created_at as string,
            updatedAt: null,
            media: [],
            isLikedByMe: false,
            replies: [],
        });
    }

    const context = await buildContextLabels(supabase, rows);

    return rows.map((p) => {
        const postUser = p.users as { alias_name: string; avatar_url: string | null } | null;
        const isMine = (p.author_id as string) === userId;
        const kind = (p.kind as string) || "user";
        return {
            id: p.id as string,
            source: "post" as const,
            kind,
            isPinned: (p.is_pinned as boolean) || false,
            authorId: p.author_id as string,
            authorAlias: postUser?.alias_name ?? "Unknown",
            authorAvatarUrl: postUser?.avatar_url ?? null,
            content: (p.content as string) || "",
            createdAt: p.created_at as string,
            updatedAt: (p.updated_at as string | null) || null,
            likesCount: (p.likes_count as number) || 0,
            isLikedByMe: likedSet.has(p.id as string),
            repliesCount: (p.replies_count as number) || 0,
            replies: repliesMap.get(p.id as string) || [],
            media: media
                .filter((m) => m.post_id === p.id)
                .map((m) => ({ id: m.id, imageUrl: urlMap.get(m.storage_path) || "", caption: m.caption })),
            visibility: (p.visibility as PostVisibility) || "public",
            context: context.get(p.id as string) ?? null,
            // A show's own announcement is not the host's to reword.
            canEdit: isMine && kind === "user",
            canDelete: isMine,
        };
    });
}

/** "Posted on <horse>" / "in <group>" / "Results" chips. Best-effort. */
async function buildContextLabels(
    supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
    rows: Record<string, unknown>[],
): Promise<Map<string, { label: string; href: string }>> {
    const out = new Map<string, { label: string; href: string }>();
    try {
        const horseIds = [...new Set(rows.map((r) => r.horse_id as string | null).filter(Boolean))] as string[];
        const groupIds = [...new Set(rows.map((r) => r.group_id as string | null).filter(Boolean))] as string[];
        const showIds = [...new Set(rows.map((r) => r.show_id as string | null).filter(Boolean))] as string[];

        const horseNames = new Map<string, string>();
        const groupNames = new Map<string, { name: string; slug: string }>();
        const showTitles = new Map<string, string>();

        await Promise.all([
            horseIds.length
                ? supabase.from("user_horses").select("id, custom_name").in("id", horseIds).then(({ data }) => {
                    for (const h of (data ?? []) as { id: string; custom_name: string }[]) horseNames.set(h.id, h.custom_name);
                })
                : Promise.resolve(),
            groupIds.length
                ? supabase.from("groups").select("id, name, slug").in("id", groupIds).then(({ data }) => {
                    for (const g of (data ?? []) as { id: string; name: string; slug: string }[]) groupNames.set(g.id, { name: g.name, slug: g.slug });
                })
                : Promise.resolve(),
            showIds.length
                ? supabase.from("shows").select("id, title").in("id", showIds).then(({ data }) => {
                    for (const s of (data ?? []) as { id: string; title: string }[]) showTitles.set(s.id, s.title);
                })
                : Promise.resolve(),
        ]);

        for (const r of rows) {
            const id = r.id as string;
            const horseId = r.horse_id as string | null;
            const groupId = r.group_id as string | null;
            const showId = r.show_id as string | null;
            if (horseId && horseNames.has(horseId)) {
                out.set(id, { label: `on ${horseNames.get(horseId)}`, href: `/community/${horseId}` });
            } else if (groupId && groupNames.has(groupId)) {
                const g = groupNames.get(groupId)!;
                out.set(id, { label: `in ${g.name}`, href: `/community/groups/${g.slug}` });
            } else if (showId && showTitles.has(showId)) {
                out.set(id, { label: showTitles.get(showId)!, href: `/shows/${showId}#results` });
            }
        }
    } catch (err) {
        logger.error("Posts", "Feed context labels failed", err);
    }
    return out;
}

/**
 * The legacy half. These rows are rendered but never written: no
 * replies, no edit, and likes live in the separate activity_likes
 * system, so the count is shown read-only rather than half-wired.
 */
async function hydrateLegacyItems(
    supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
    userId: string,
    rows: Record<string, unknown>[],
): Promise<FeedStreamItem[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id as string);

    const { data: myLikes } = await supabase
        .from("activity_likes")
        .select("activity_id")
        .eq("user_id", userId)
        .in("activity_id", ids);
    const likedSet = new Set(((myLikes ?? []) as { activity_id: string }[]).map((l) => l.activity_id));

    const allImages = rows.flatMap((r) => ((r.image_urls as string[] | null) ?? []));
    const imageUrlMap = getPublicImageUrls(allImages);

    return rows.map((e) => {
        const actor = e.users as { alias_name: string; avatar_url: string | null } | null;
        return {
            id: e.id as string,
            source: "activity" as const,
            kind: "user",
            isPinned: false,
            authorId: e.actor_id as string,
            authorAlias: actor?.alias_name ?? "Unknown",
            authorAvatarUrl: actor?.avatar_url ?? null,
            content: ((e.metadata as { text?: string } | null)?.text as string) || "",
            createdAt: e.created_at as string,
            updatedAt: null,
            likesCount: (e.likes_count as number) || 0,
            isLikedByMe: likedSet.has(e.id as string),
            repliesCount: 0,
            replies: [],
            media: ((e.image_urls as string[] | null) ?? []).map((url, i) => ({
                id: `${e.id}-img-${i}`,
                imageUrl: imageUrlMap.get(url) || url,
                caption: null,
            })),
            visibility: "public" as PostVisibility,
            context: null,
            canEdit: false,
            canDelete: (e.actor_id as string) === userId,
        };
    });
}

/**
 * Every real alias mentioned on this page, resolved once. Best-effort:
 * if it fails the feed renders with the legacy single-word mention
 * behaviour rather than not rendering at all.
 */
async function resolvePageAliases(contents: string[]): Promise<string[]> {
    try {
        const joined = contents.filter(Boolean).join("\n");
        if (!joined.includes("@")) return [];
        const { resolveMentionedAliases } = await import("@/app/actions/mentions");
        const resolved = await resolveMentionedAliases(joined);
        return resolved.map((m) => m.alias);
    } catch (err) {
        logger.error("Posts", "Feed mention resolution failed", err);
        return [];
    }
}

/**
 * What the feed UI is allowed to offer right now.
 *
 * Migration 166 is hand-pasted, so the audience control must not
 * appear before the column exists — a picker that silently does
 * nothing is worse than no picker, because the author believes they
 * limited who can see the post.
 */
export async function getFeedCapabilities(): Promise<{ visibility: boolean; kind: boolean }> {
    try {
        const { supabase } = await requireAuth();
        return await getPostColumnSupport(supabase);
    } catch {
        return { visibility: false, kind: false };
    }
}

/**
 * Typeahead for the composer's @-autocomplete.
 *
 * Returns aliases beginning with `prefix`. Aliases are already public
 * (every profile page is addressed by one), so this exposes nothing
 * new — but it still requires auth so it can't be scraped anonymously.
 */
export async function searchAliases(
    prefix: string,
): Promise<{ alias: string; avatarUrl: string | null }[]> {
    try {
        const { supabase } = await requireAuth();
        const cleaned = prefix.trim().replace(/[%_,.()]/g, "");
        if (cleaned.length < 1) return [];

        const { data } = await supabase
            .from("users")
            .select("alias_name, avatar_url")
            .ilike("alias_name", `${cleaned}%`)
            .order("alias_name", { ascending: true })
            .limit(8);

        const rows = (data ?? []) as { alias_name: string; avatar_url: string | null }[];
        if (rows.length === 0) return [];

        const avatarMap = await resolveAvatarUrls(rows.map((r) => r.avatar_url));
        return rows
            .filter((r) => !!r.alias_name)
            .map((r) => ({
                alias: r.alias_name,
                avatarUrl: r.avatar_url ? avatarMap.get(r.avatar_url) || r.avatar_url : null,
            }));
    } catch {
        return [];
    }
}

/**
 * One post, hydrated exactly like a feed page item — the permalink
 * page renders the same interactive card the feed does (replies,
 * likes, media, mentions) instead of a read-only copy. Returns null
 * for replies, blocked authors, and rows RLS hides; the permalink
 * page falls back to its legacy/notFound handling.
 */
export async function getFeedPost(
    postId: string,
): Promise<{ item: FeedStreamItem; knownAliases: string[] } | null> {
    const { supabase, user } = await requireAuth();

    const support = await getPostColumnSupport(supabase);
    let selectColumns = FEED_POST_COLUMNS;
    if (support.kind) selectColumns += ", kind";
    if (support.visibility) selectColumns += ", visibility";

    const { data: row } = await supabase
        .from("posts")
        .select(selectColumns)
        .eq("id", postId)
        .maybeSingle();
    if (!row) return null;
    const post = row as unknown as Record<string, unknown>;
    if (post.parent_id) return null;

    const { data: myBlocks } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
    const blockedIds = new Set((myBlocks ?? []).map((b: { blocked_id: string }) => b.blocked_id));
    if (blockedIds.has(post.author_id as string)) return null;

    const [items, knownAliases] = await Promise.all([
        hydratePostItems(supabase, user.id, [post], blockedIds),
        resolvePageAliases([(post.content as string) || ""]),
    ]);
    const item = items[0];
    if (!item) return null;

    if (item.authorAvatarUrl) {
        const avatarMap = await resolveAvatarUrls([item.authorAvatarUrl]);
        item.authorAvatarUrl = avatarMap.get(item.authorAvatarUrl) || item.authorAvatarUrl;
    }
    for (const reply of item.replies) {
        if (reply.authorAvatarUrl) {
            const avatarMap = await resolveAvatarUrls([reply.authorAvatarUrl]);
            reply.authorAvatarUrl = avatarMap.get(reply.authorAvatarUrl) || reply.authorAvatarUrl;
        }
    }
    return { item, knownAliases };
}
