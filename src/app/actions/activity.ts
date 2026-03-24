"use server";

import { logger } from "@/lib/logger";
import type { Json } from "@/lib/types/database.generated";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

interface FeedItem {
    id: string;
    actorAlias: string;
    actorId: string;
    eventType: string;
    horseId: string | null;
    horseName: string | null;
    thumbnailUrl: string | null;
    metadata: Json | null;
    createdAt: string;
    likesCount: number;
    isLiked: boolean;
    imageUrls: string[];
}

/**
 * Create an activity event (Service Role, fire-and-forget).
 */
export async function createActivityEvent(data: {
    actorId: string;
    eventType: string;
    horseId?: string;
    targetId?: string;
    metadata?: Json;
}): Promise<void> {
    try {
        const supabaseAdmin = getAdminClient();

        await supabaseAdmin.from("activity_events").insert({
            actor_id: data.actorId,
            event_type: data.eventType,
            horse_id: data.horseId || null,
            target_id: data.targetId || null,
            metadata: data.metadata || null,
        });
    } catch {
        logger.error("Activity", "Failed to log event");
    }
}

/**
 * Create a text post on the activity feed.
 * Supports optional image URLs for casual image posts.
 */
export async function createTextPost(text: string, imageUrls?: string[]): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const trimmed = text.trim();
    if (!trimmed && (!imageUrls || imageUrls.length === 0)) return { success: false, error: "Post cannot be empty." };
    if (trimmed.length > 500) return { success: false, error: "Post must be 500 characters or less." };

    const supabaseAdmin = getAdminClient();

    // Fetch actor alias for mention notifications
    const { data: profile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const actorAlias = (profile as { alias_name: string } | null)?.alias_name || "Someone";

    const { error } = await supabaseAdmin.from("activity_events").insert({
        actor_id: user.id,
        event_type: "text_post",
        horse_id: null,
        target_id: null,
        metadata: { text: trimmed },
        image_urls: imageUrls && imageUrls.length > 0 ? imageUrls : [],
    });

    if (error) return { success: false, error: error.message };

    // Deferred: notify mentions after response is sent
    if (trimmed) {
        const userId = user.id;
        const actorName = actorAlias;
        after(async () => {
            try {
                const { parseAndNotifyMentions } = await import("@/app/actions/mentions");
                await parseAndNotifyMentions(trimmed, userId, actorName, "/feed");
            } catch (err) { logger.error("Activity", "Background task failed", err); }
        });
    }

    return { success: true };
}

/**
 * Get the global activity feed (latest events from all users).
 */
export async function getActivityFeed(limit: number = 30, cursor?: string): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch blocked user IDs
    let blockedIds: string[] = [];
    if (user) {
        const { data: blocks } = await supabase
            .from("user_blocks")
            .select("blocked_id")
            .eq("blocker_id", user.id);
        blockedIds = (blocks ?? []).map((b: { blocked_id: string }) => b.blocked_id);
    }

    let query = supabase
        .from("activity_events")
        .select("id, actor_id, event_type, horse_id, metadata, created_at, likes_count, image_urls, users!actor_id(alias_name)")
        .order("created_at", { ascending: false })
        .limit(limit + 1);

    if (cursor) {
        query = query.lt("created_at", cursor);
    }

    const { data: events } = await query;

    const allItems = events ?? [];

    // Filter out blocked users
    const filteredItems = blockedIds.length > 0
        ? allItems.filter((e) => !blockedIds.includes(e.actor_id))
        : allItems;

    const hasMore = filteredItems.length > limit;
    const items = hasMore ? filteredItems.slice(0, limit) : filteredItems;

    if (items.length === 0) return { items: [], nextCursor: null };

    // Batch-fetch current user's likes
    let likedSet = new Set<string>();
    if (user && items.length > 0) {
        const itemIds = items.map((e) => e.id);
        const { data: myLikes } = await supabase
            .from("activity_likes")
            .select("activity_id")
            .eq("user_id", user.id)
            .in("activity_id", itemIds);
        likedSet = new Set((myLikes ?? []).map((l: { activity_id: string }) => l.activity_id));
    }

    // Batch-fetch horse names
    const horseIds = [...new Set(items.map((e) => e.horse_id).filter(Boolean))] as string[];
    const horseMap = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: horses } = await supabase
            .from("user_horses")
            .select("id, custom_name")
            .in("id", horseIds);
        horses?.forEach((h: { id: string; custom_name: string }) => {
            horseMap.set(h.id, h.custom_name);
        });
    }
    // Batch-fetch primary thumbnails for horses
    const thumbUrlMap1 = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: thumbRows } = await supabase
            .from("horse_images")
            .select("horse_id, image_url, angle_profile")
            .in("horse_id", horseIds);
        const allThumbUrls: string[] = [];
        for (const hId of horseIds) {
            const imgs = (thumbRows ?? []).filter((r: { horse_id: string }) => r.horse_id === hId);
            const primary = imgs.find((i: { angle_profile: string }) => i.angle_profile === "Primary_Thumbnail");
            const url = (primary ?? imgs[0])?.image_url;
            if (url) {
                thumbUrlMap1.set(hId, url);
                allThumbUrls.push(url);
            }
        }
        const signedUrls = getPublicImageUrls(allThumbUrls);
        for (const [hId, rawUrl] of thumbUrlMap1) {
            thumbUrlMap1.set(hId, signedUrls.get(rawUrl) ?? rawUrl);
        }
    }

    const nextCursor = hasMore ? items[items.length - 1].created_at : null;

    return {
        items: items.map((e) => ({
            id: e.id,
            actorAlias: e.users?.alias_name || "Unknown",
            actorId: e.actor_id,
            eventType: e.event_type,
            horseId: e.horse_id,
            horseName: e.horse_id ? horseMap.get(e.horse_id) || null : null,
            thumbnailUrl: e.horse_id ? thumbUrlMap1.get(e.horse_id) ?? null : null,
            metadata: e.metadata,
            createdAt: e.created_at,
            likesCount: e.likes_count ?? 0,
            isLiked: likedSet.has(e.id),
            imageUrls: e.image_urls ?? [],
        })),
        nextCursor,
    };
}

/**
 * Get activity feed for users the current user follows.
 */
export async function getFollowingFeed(limit: number = 30, cursor?: string): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { items: [], nextCursor: null };

    // Get who we follow
    const { data: follows } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);

    const followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);

    // Include own activity
    followingIds.push(user.id);

    // Remove blocked users from feed
    const { data: blocks } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
    const blockedIds2 = new Set((blocks ?? []).map((b: { blocked_id: string }) => b.blocked_id));
    const filteredFollowingIds = followingIds.filter((id) => !blockedIds2.has(id));

    if (filteredFollowingIds.length === 0) return { items: [], nextCursor: null };

    let query = supabase
        .from("activity_events")
        .select("id, actor_id, event_type, horse_id, metadata, created_at, likes_count, image_urls, users!actor_id(alias_name)")
        .in("actor_id", filteredFollowingIds)
        .order("created_at", { ascending: false })
        .limit(limit + 1);

    if (cursor) {
        query = query.lt("created_at", cursor);
    }

    const { data: events } = await query;

    const allItems = events ?? [];

    const hasMore = allItems.length > limit;
    const items = hasMore ? allItems.slice(0, limit) : allItems;

    if (items.length === 0) return { items: [], nextCursor: null };

    // Batch-fetch current user's likes
    let likedSet2 = new Set<string>();
    if (items.length > 0) {
        const itemIds = items.map((e) => e.id);
        const { data: myLikes } = await supabase
            .from("activity_likes")
            .select("activity_id")
            .eq("user_id", user.id)
            .in("activity_id", itemIds);
        likedSet2 = new Set((myLikes ?? []).map((l: { activity_id: string }) => l.activity_id));
    }

    // Batch-fetch horse names
    const horseIds = [...new Set(items.map((e) => e.horse_id).filter(Boolean))] as string[];
    const horseMap = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: horses } = await supabase
            .from("user_horses")
            .select("id, custom_name")
            .in("id", horseIds);
        horses?.forEach((h: { id: string; custom_name: string }) => {
            horseMap.set(h.id, h.custom_name);
        });
    }
    // Batch-fetch primary thumbnails for horses
    const thumbUrlMap2 = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: thumbRows } = await supabase
            .from("horse_images")
            .select("horse_id, image_url, angle_profile")
            .in("horse_id", horseIds);
        const allThumbUrls: string[] = [];
        for (const hId of horseIds) {
            const imgs = (thumbRows ?? []).filter((r: { horse_id: string }) => r.horse_id === hId);
            const primary = imgs.find((i: { angle_profile: string }) => i.angle_profile === "Primary_Thumbnail");
            const url = (primary ?? imgs[0])?.image_url;
            if (url) {
                thumbUrlMap2.set(hId, url);
                allThumbUrls.push(url);
            }
        }
        const signedUrls = getPublicImageUrls(allThumbUrls);
        for (const [hId, rawUrl] of thumbUrlMap2) {
            thumbUrlMap2.set(hId, signedUrls.get(rawUrl) ?? rawUrl);
        }
    }

    const nextCursor = hasMore ? items[items.length - 1].created_at : null;

    return {
        items: items.map((e) => ({
            id: e.id,
            actorAlias: e.users?.alias_name || "Unknown",
            actorId: e.actor_id,
            eventType: e.event_type,
            horseId: e.horse_id,
            horseName: e.horse_id ? horseMap.get(e.horse_id) || null : null,
            thumbnailUrl: e.horse_id ? thumbUrlMap2.get(e.horse_id) ?? null : null,
            metadata: e.metadata,
            createdAt: e.created_at,
            likesCount: e.likes_count ?? 0,
            isLiked: likedSet2.has(e.id),
            imageUrls: e.image_urls ?? [],
        })),
        nextCursor,
    };
}

/**
 * Delete a text post (owner only).
 */
export async function deleteTextPost(eventId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { data: event } = await supabase
        .from("activity_events")
        .select("id")
        .eq("id", eventId)
        .eq("actor_id", user.id)
        .maybeSingle();

    if (!event) return { success: false, error: "Post not found or not yours." };

    const { error } = await supabase.from("activity_events").delete().eq("id", eventId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/feed");
    return { success: true };
}
