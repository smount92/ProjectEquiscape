"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

interface FeedItem {
    id: string;
    actorAlias: string;
    actorId: string;
    eventType: string;
    horseId: string | null;
    horseName: string | null;
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

    return items.map((e) => ({
        id: e.id,
        actorAlias: aliasMap.get(e.actor_id) || "Unknown",
        actorId: e.actor_id,
        eventType: e.event_type,
        horseId: e.horse_id,
        horseName: e.horse_id ? horseMap.get(e.horse_id) || null : null,
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

    return items.map((e) => ({
        id: e.id,
        actorAlias: aliasMap.get(e.actor_id) || "Unknown",
        actorId: e.actor_id,
        eventType: e.event_type,
        horseId: e.horse_id,
        horseName: e.horse_id ? horseMap.get(e.horse_id) || null : null,
        metadata: e.metadata,
        createdAt: e.created_at,
    }));
}
