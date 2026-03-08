"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSignedImageUrls } from "@/lib/utils/storage";

interface FeedItem {
    id: string;
    actorAlias: string;
    actorId: string;
    eventType: string;
    horseId: string | null;
    horseName: string | null;
    thumbnailUrl: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

/**
 * Create an activity event (Service Role, fire-and-forget).
 */
export async function createActivityEvent(data: {
    actorId: string;
    eventType: string;
    horseId?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    try {
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabaseAdmin.from("activity_events").insert({
            actor_id: data.actorId,
            event_type: data.eventType,
            horse_id: data.horseId || null,
            target_id: data.targetId || null,
            metadata: data.metadata || null,
        });
    } catch {
        console.error("[Activity] Failed to log event");
    }
}

/**
 * Create a text post on the activity feed.
 */
export async function createTextPost(text: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const trimmed = text.trim();
    if (!trimmed) return { success: false, error: "Post cannot be empty." };
    if (trimmed.length > 500) return { success: false, error: "Post must be 500 characters or less." };

    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin.from("activity_events").insert({
        actor_id: user.id,
        event_type: "text_post",
        horse_id: null,
        target_id: null,
        metadata: { text: trimmed },
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Get the global activity feed (latest events from all users).
 */
export async function getActivityFeed(limit: number = 30): Promise<FeedItem[]> {
    const supabase = await createClient();

    const { data: events } = await supabase
        .from("activity_events")
        .select("id, actor_id, event_type, horse_id, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

    const items = (events ?? []) as {
        id: string;
        actor_id: string;
        event_type: string;
        horse_id: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
    }[];

    if (items.length === 0) return [];

    // Batch-fetch actor aliases
    const actorIds = [...new Set(items.map((e) => e.actor_id))];
    const aliasMap = new Map<string, string>();
    if (actorIds.length > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", actorIds);
        users?.forEach((u: { id: string; alias_name: string }) => {
            aliasMap.set(u.id, u.alias_name);
        });
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
        const signedUrls = await getSignedImageUrls(supabase, allThumbUrls);
        for (const [hId, rawUrl] of thumbUrlMap1) {
            thumbUrlMap1.set(hId, signedUrls.get(rawUrl) ?? rawUrl);
        }
    }

    return items.map((e) => ({
        id: e.id,
        actorAlias: aliasMap.get(e.actor_id) || "Unknown",
        actorId: e.actor_id,
        eventType: e.event_type,
        horseId: e.horse_id,
        horseName: e.horse_id ? horseMap.get(e.horse_id) || null : null,
        thumbnailUrl: e.horse_id ? thumbUrlMap1.get(e.horse_id) ?? null : null,
        metadata: e.metadata,
        createdAt: e.created_at,
    }));
}

/**
 * Get activity feed for users the current user follows.
 */
export async function getFollowingFeed(limit: number = 30): Promise<FeedItem[]> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    // Get who we follow
    const { data: follows } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);

    const followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);

    // Include own activity
    followingIds.push(user.id);

    if (followingIds.length === 0) return [];

    const { data: events } = await supabase
        .from("activity_events")
        .select("id, actor_id, event_type, horse_id, metadata, created_at")
        .in("actor_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(limit);

    const items = (events ?? []) as {
        id: string;
        actor_id: string;
        event_type: string;
        horse_id: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
    }[];

    if (items.length === 0) return [];

    // Batch-fetch aliases
    const actorIds = [...new Set(items.map((e) => e.actor_id))];
    const aliasMap = new Map<string, string>();
    const { data: users } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", actorIds);
    users?.forEach((u: { id: string; alias_name: string }) => {
        aliasMap.set(u.id, u.alias_name);
    });

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
        const signedUrls = await getSignedImageUrls(supabase, allThumbUrls);
        for (const [hId, rawUrl] of thumbUrlMap2) {
            thumbUrlMap2.set(hId, signedUrls.get(rawUrl) ?? rawUrl);
        }
    }

    return items.map((e) => ({
        id: e.id,
        actorAlias: aliasMap.get(e.actor_id) || "Unknown",
        actorId: e.actor_id,
        eventType: e.event_type,
        horseId: e.horse_id,
        horseName: e.horse_id ? horseMap.get(e.horse_id) || null : null,
        thumbnailUrl: e.horse_id ? thumbUrlMap2.get(e.horse_id) ?? null : null,
        metadata: e.metadata,
        createdAt: e.created_at,
    }));
}
