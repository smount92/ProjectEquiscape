"use server";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { sanitizeText } from "@/lib/utils/validation";

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
}): Promise<{ success: boolean; postId?: string; error?: string }> {
    const { supabase, user } = await requireAuth();
    if (!data.content.trim() && (!data.imagePaths || data.imagePaths.length === 0)) {
        return { success: false, error: "Post cannot be empty." };
    }
    if (data.content.trim().length > 2000) {
        return { success: false, error: "Post is too long (2000 char max)." };
    }

    const { data: post, error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: sanitizeText(data.content),
        horse_id: data.horseId || null,
        group_id: data.groupId || null,
        event_id: data.eventId || null,
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
    after(async () => {
        try {
            const supabaseDeferred = await (await import("@/lib/supabase/server")).createClient();
            const { data: actor } = await supabaseDeferred.from("users").select("alias_name").eq("id", userId).single();
            const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
            const { createNotification } = await import("@/app/actions/notifications");
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
        } catch { /* non-blocking */ }
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
                const { createNotification } = await import("@/app/actions/notifications");
                await createNotification({
                    userId: (parentPost as { author_id: string }).author_id,
                    type: "reply",
                    actorId: userId,
                    content: `@${alias} replied to your post`,
                    linkUrl: `/feed`,
                });
            }

            // @mentions in reply
            const { parseAndNotifyMentions } = await import("@/app/actions/mentions");
            await parseAndNotifyMentions(trimmedContent, userId, alias, `/feed`);
        } catch { /* non-blocking */ }
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

    // Clean up storage files for attached media
    try {
        const { data: media } = await supabase
            .from("media_attachments")
            .select("image_url")
            .eq("post_id", postId);

        if (media && media.length > 0) {
            const paths = (media as { image_url: string }[])
                .map(m => {
                    const match = m.image_url.match(/horse-images\/(.+?)(\?|$)/);
                    return match ? match[1] : null;
                })
                .filter(Boolean) as string[];

            if (paths.length > 0) {
                await supabase.storage.from("horse-images").remove(paths);
            }
        }
    } catch { /* best effort — don't block deletion */ }

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

    const { error } = await supabase
        .from("posts")
        .update({
            content: newContent.trim(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .eq("author_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/feed");
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
                    const { createNotification } = await import("@/app/actions/notifications");
                    await createNotification({
                        userId: (post as { author_id: string }).author_id,
                        type: "like",
                        actorId: userId,
                        content: `@${alias} liked your post`,
                        linkUrl: `/feed`,
                    });
                }
            } catch { /* non-blocking */ }
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
        .select("id, author_id, content, parent_id, horse_id, group_id, event_id, likes_count, replies_count, is_pinned, created_at, updated_at, users!posts_author_id_fkey(alias_name)")
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

    const { data: posts } = await query;
    if (!posts || posts.length === 0) return [];

    const postIds = (posts as { id: string }[]).map(p => p.id);

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

    return (posts as Record<string, unknown>[]).map(p => ({
        id: p.id as string,
        authorId: p.author_id as string,
        authorAlias: (p.users as { alias_name: string } | null)?.alias_name ?? "Unknown",
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
    } as Post));
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

    const items = ((data ?? []) as unknown as {
        id: string; storage_path: string; caption: string | null;
        created_at: string; uploader_id: string;
        users: { alias_name: string } | null;
    }[]);

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

    // Fetch the image URL before deleting the row
    try {
        const { data: media } = await supabase
            .from("media_attachments")
            .select("image_url")
            .eq("id", mediaId)
            .maybeSingle();

        if (media) {
            const url = (media as { image_url: string }).image_url;
            const match = url.match(/horse-images\/(.+?)(\?|$)/);
            if (match) {
                await supabase.storage.from("horse-images").remove([match[1]]);
            }
        }
    } catch { /* best effort */ }

    const { error } = await supabase.from("media_attachments").delete().eq("id", mediaId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/community/events");
    return { success: true };
}
