"use server";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { sanitizeText } from "@/lib/utils/validation";

// ============================================================
// EVENTS — Server Actions
// ============================================================

// ── User Search (for judge assignment autocomplete) ──

export async function searchUsers(query: string): Promise<{
    id: string;
    aliasName: string;
    avatarUrl: string | null;
}[]> {
    if (!query || query.trim().length < 2) return [];
    const supabase = await createClient();
    const { data } = await supabase
        .from("users")
        .select("id, alias_name, avatar_url")
        .ilike("alias_name", `%${query.trim()}%`)
        .order("alias_name")
        .limit(8);

    return (data || []).map((u: { id: string; alias_name: string; avatar_url: string | null }) => ({
        id: u.id,
        aliasName: u.alias_name,
        avatarUrl: u.avatar_url,
    }));
}

// ── Types ──

export interface MHHEvent {
    id: string;
    name: string;
    description: string | null;
    eventType: string;
    startsAt: string;
    endsAt: string | null;
    timezone: string;
    isAllDay: boolean;
    isVirtual: boolean;
    locationName: string | null;
    locationAddress: string | null;
    region: string | null;
    virtualUrl: string | null;
    groupId: string | null;
    groupName: string | null;
    showId: string | null;
    createdBy: string;
    creatorAlias: string;
    isOfficial: boolean;
    rsvpCount: number;
    createdAt: string;
    userRsvp: string | null;
    judgingMethod: string;
}

// ── CRUD ──

/** Create an event */
export async function createEvent(data: {
    name: string;
    description?: string;
    eventType: string;
    startsAt: string;
    endsAt?: string;
    timezone?: string;
    isAllDay?: boolean;
    isVirtual?: boolean;
    locationName?: string;
    locationAddress?: string;
    region?: string;
    virtualUrl?: string;
    groupId?: string;
    judgingMethod?: "community_vote" | "expert_judge";
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (!data.name.trim()) return { success: false, error: "Event name is required." };

    const { data: event, error } = await supabase
        .from("events")
        .insert({
            name: data.name.trim(),
            description: data.description?.trim() || null,
            event_type: data.eventType,
            starts_at: data.startsAt,
            ends_at: data.endsAt || null,
            timezone: data.timezone || "America/New_York",
            is_all_day: data.isAllDay || false,
            is_virtual: data.isVirtual || false,
            location_name: data.locationName?.trim() || null,
            location_address: data.locationAddress?.trim() || null,
            region: data.region?.trim() || null,
            virtual_url: data.virtualUrl?.trim() || null,
            group_id: data.groupId || null,
            judging_method: data.judgingMethod || "community_vote",
            created_by: user.id,
            rsvp_count: 1, // Creator auto-RSVPs
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

    const eventId = (event as { id: string }).id;

    // Auto-RSVP creator
    await supabase.from("event_rsvps").insert({
        event_id: eventId,
        user_id: user.id,
        status: "going",
    });

    revalidatePath("/community/events");
    revalidateTag("events", "max");
    return { success: true, eventId };
}

/** Browse events with filters */
export async function getEvents(filters?: {
    eventType?: string;
    region?: string;
    upcoming?: boolean;
    groupId?: string;
}): Promise<MHHEvent[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
        .from("events")
        .select("*, users!events_created_by_fkey(alias_name)")
        .order("starts_at", { ascending: true })
        .limit(50);

    if (filters?.eventType && filters.eventType !== "all") {
        query = query.eq("event_type", filters.eventType);
    }
    if (filters?.region) {
        query = query.ilike("region", `%${filters.region}%`);
    }
    if (filters?.upcoming !== false) {
        query = query.or(`ends_at.gte.${new Date().toISOString()},and(ends_at.is.null,starts_at.gte.${new Date().toISOString()})`);
    }
    if (filters?.groupId) {
        query = query.eq("group_id", filters.groupId);
    }

    const { data: events } = await query;
    if (!events || events.length === 0) return [];



    // Get group names
    const groupIds = [...new Set(
        (events as { group_id: string | null }[])
            .map(e => e.group_id)
            .filter(Boolean) as string[]
    )];
    const groupNames = new Map<string, string>();
    if (groupIds.length > 0) {
        const { data: groups } = await supabase
            .from("groups")
            .select("id, name")
            .in("id", groupIds);
        (groups || []).forEach((g: { id: string; name: string }) => groupNames.set(g.id, g.name));
    }

    // Get user's RSVPs
    const rsvpMap = new Map<string, string>();
    if (user) {
        const eventIds = (events as { id: string }[]).map(e => e.id);
        const { data: rsvps } = await supabase
            .from("event_rsvps")
            .select("event_id, status")
            .in("event_id", eventIds)
            .eq("user_id", user.id);
        for (const r of (rsvps || []) as { event_id: string; status: string }[]) {
            rsvpMap.set(r.event_id, r.status);
        }
    }

    return (events as Record<string, unknown>[]).map(e => ({
        id: e.id as string,
        name: e.name as string,
        description: e.description as string | null,
        eventType: e.event_type as string,
        startsAt: e.starts_at as string,
        endsAt: e.ends_at as string | null,
        timezone: e.timezone as string,
        isAllDay: e.is_all_day as boolean,
        isVirtual: e.is_virtual as boolean,
        locationName: e.location_name as string | null,
        locationAddress: e.location_address as string | null,
        region: e.region as string | null,
        virtualUrl: e.virtual_url as string | null,
        groupId: e.group_id as string | null,
        groupName: e.group_id ? (groupNames.get(e.group_id as string) || null) : null,
        showId: e.show_id as string | null,
        createdBy: e.created_by as string,
        creatorAlias: (e as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        isOfficial: e.is_official as boolean,
        rsvpCount: e.rsvp_count as number,
        createdAt: e.created_at as string,
        userRsvp: rsvpMap.get(e.id as string) || null,
        judgingMethod: (e.judging_method as string) || "community_vote",
    }));
}

/** Get single event */
export async function getEvent(eventId: string): Promise<MHHEvent | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

    if (!data) return null;
    const e = data as Record<string, unknown>;

    // Creator alias
    const { data: creator } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", e.created_by as string)
        .single();

    // Group name
    let groupName: string | null = null;
    if (e.group_id) {
        const { data: group } = await supabase
            .from("groups")
            .select("name")
            .eq("id", e.group_id as string)
            .single();
        groupName = (group as { name: string } | null)?.name || null;
    }

    // User RSVP
    let userRsvp: string | null = null;
    if (user) {
        const { data: rsvp } = await supabase
            .from("event_rsvps")
            .select("status")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();
        userRsvp = (rsvp as { status: string } | null)?.status || null;
    }

    return {
        id: e.id as string,
        name: e.name as string,
        description: e.description as string | null,
        eventType: e.event_type as string,
        startsAt: e.starts_at as string,
        endsAt: e.ends_at as string | null,
        timezone: e.timezone as string,
        isAllDay: e.is_all_day as boolean,
        isVirtual: e.is_virtual as boolean,
        locationName: e.location_name as string | null,
        locationAddress: e.location_address as string | null,
        region: e.region as string | null,
        virtualUrl: e.virtual_url as string | null,
        groupId: e.group_id as string | null,
        groupName,
        showId: e.show_id as string | null,
        createdBy: e.created_by as string,
        creatorAlias: (creator as { alias_name: string } | null)?.alias_name || "Unknown",
        isOfficial: e.is_official as boolean,
        rsvpCount: e.rsvp_count as number,
        createdAt: e.created_at as string,
        userRsvp,
        judgingMethod: (e.judging_method as string) || "community_vote",
    };
}

/** Set RSVP status */
export async function rsvpEvent(
    eventId: string,
    status: "going" | "interested" | "not_going"
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Upsert RSVP
    const { error } = await supabase
        .from("event_rsvps")
        .upsert({
            event_id: eventId,
            user_id: user.id,
            status,
        }, { onConflict: "event_id,user_id" });

    if (error) return { success: false, error: error.message };

    // Update RSVP count (count going + interested)
    const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("status", ["going", "interested"]);

    await supabase.from("events").update({ rsvp_count: count || 0 }).eq("id", eventId);

    revalidatePath("/community/events");
    revalidatePath(`/community/events/${eventId}`);
    return { success: true };
}

/** Dashboard widget: next 5 events user has RSVP'd to */
export async function getUpcomingEvents(): Promise<MHHEvent[]> {
    const { supabase, user } = await requireAuth();

    // Get user's RSVP'd event IDs
    const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("event_id, status")
        .eq("user_id", user.id)
        .in("status", ["going", "interested"]);

    if (!rsvps || rsvps.length === 0) return [];

    const eventIds = (rsvps as { event_id: string }[]).map(r => r.event_id);
    const rsvpMap = new Map<string, string>();
    for (const r of rsvps as { event_id: string; status: string }[]) {
        rsvpMap.set(r.event_id, r.status);
    }

    const { data: events } = await supabase
        .from("events")
        .select("*")
        .in("id", eventIds)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5);

    if (!events || events.length === 0) return [];

    return (events as Record<string, unknown>[]).map(e => ({
        id: e.id as string,
        name: e.name as string,
        description: e.description as string | null,
        eventType: e.event_type as string,
        startsAt: e.starts_at as string,
        endsAt: e.ends_at as string | null,
        timezone: e.timezone as string,
        isAllDay: e.is_all_day as boolean,
        isVirtual: e.is_virtual as boolean,
        locationName: e.location_name as string | null,
        locationAddress: e.location_address as string | null,
        region: e.region as string | null,
        virtualUrl: e.virtual_url as string | null,
        groupId: e.group_id as string | null,
        groupName: null,
        showId: e.show_id as string | null,
        createdBy: e.created_by as string,
        creatorAlias: "",
        isOfficial: e.is_official as boolean,
        rsvpCount: e.rsvp_count as number,
        createdAt: e.created_at as string,
        userRsvp: rsvpMap.get(e.id as string) || null,
        judgingMethod: (e.judging_method as string) || "community_vote",
    }));
}

/** Delete an event (creator only) */
export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("id", eventId)
        .eq("created_by", user.id)
        .maybeSingle();

    if (!event) return { success: false, error: "Event not found or not yours." };

    // Clean up event photos from storage
    try {
        const { data: photos } = await supabase
            .from("event_photos")
            .select("image_url")
            .eq("event_id", eventId);

        if (photos && photos.length > 0) {
            const paths = (photos as { image_url: string }[])
                .map(p => {
                    const match = p.image_url.match(/horse-images\/(.+?)(\?|$)/);
                    return match ? match[1] : null;
                })
                .filter(Boolean) as string[];

            if (paths.length > 0) {
                await supabase.storage.from("horse-images").remove(paths);
            }
        }

        // Also clean up any media_attachments (posts within this event)
        const { data: eventPosts } = await supabase
            .from("posts")
            .select("id")
            .eq("event_id", eventId);

        if (eventPosts && eventPosts.length > 0) {
            const postIds = (eventPosts as { id: string }[]).map(p => p.id);
            const { data: media } = await supabase
                .from("media_attachments")
                .select("image_url")
                .in("post_id", postIds);

            if (media && media.length > 0) {
                const mediaPaths = (media as { image_url: string }[])
                    .map(m => {
                        const match = m.image_url.match(/horse-images\/(.+?)(\?|$)/);
                        return match ? match[1] : null;
                    })
                    .filter(Boolean) as string[];

                if (mediaPaths.length > 0) {
                    await supabase.storage.from("horse-images").remove(mediaPaths);
                }
            }
        }
    } catch { /* best effort */ }

    // Delete RSVPs first
    await supabase.from("event_rsvps").delete().eq("event_id", eventId);
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/events");
    return { success: true };
}

/** Update an event (creator only) */
export async function updateEvent(
    eventId: string,
    data: {
        name?: string;
        description?: string;
        startsAt?: string;
        endsAt?: string;
        timezone?: string;
        isAllDay?: boolean;
        isVirtual?: boolean;
        locationName?: string;
        locationAddress?: string;
        region?: string;
        virtualUrl?: string;
        judgingMethod?: "community_vote" | "expert_judge";
    }
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify ownership
    const { data: event } = await supabase
        .from("events")
        .select("created_by")
        .eq("id", eventId)
        .single();

    if (!event || (event as { created_by: string }).created_by !== user.id) {
        return { success: false, error: "Not authorized — only the event creator can edit." };
    }

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description.trim() || null;
    if (data.startsAt !== undefined) updates.starts_at = data.startsAt;
    if (data.endsAt !== undefined) updates.ends_at = data.endsAt || null;
    if (data.timezone !== undefined) updates.timezone = data.timezone;
    if (data.isAllDay !== undefined) updates.is_all_day = data.isAllDay;
    if (data.isVirtual !== undefined) updates.is_virtual = data.isVirtual;
    if (data.locationName !== undefined) updates.location_name = data.locationName.trim() || null;
    if (data.locationAddress !== undefined) updates.location_address = data.locationAddress.trim() || null;
    if (data.region !== undefined) updates.region = data.region || null;
    if (data.virtualUrl !== undefined) updates.virtual_url = data.virtualUrl.trim() || null;
    if (data.judgingMethod !== undefined) updates.judging_method = data.judgingMethod;

    if (Object.keys(updates).length === 0) return { success: true };

    const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", eventId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/community/events/${eventId}`);
    revalidatePath(`/community/events/${eventId}/manage`);
    return { success: true };
}

// ============================================================
// EVENT JUDGES
// ============================================================

/**
 * Get all judges assigned to an event.
 */
export async function getEventJudges(eventId: string): Promise<{
    id: string;
    userId: string;
    aliasName: string;
    avatarUrl: string | null;
}[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("event_judges")
        .select("id, user_id, users!inner(alias_name, avatar_url)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (!data) return [];

    return data.map((j: Record<string, unknown>) => {
        const user = j.users as { alias_name: string; avatar_url: string | null } | null;
        return {
            id: j.id as string,
            userId: j.user_id as string,
            aliasName: user?.alias_name || "Unknown",
            avatarUrl: user?.avatar_url || null,
        };
    });
}

/**
 * Add a user as a judge to an event. Looks up by alias_name.
 */
export async function addEventJudge(
    eventId: string,
    userAlias: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify ownership
    const { data: event } = await supabase
        .from("events")
        .select("created_by")
        .eq("id", eventId)
        .single();

    if (!event || (event as { created_by: string }).created_by !== user.id) {
        return { success: false, error: "Only the event creator can assign judges." };
    }

    // Look up judge by alias (case-insensitive)
    const { data: judgeUser } = await supabase
        .from("users")
        .select("id")
        .ilike("alias_name", userAlias.trim())
        .maybeSingle();

    if (!judgeUser) return { success: false, error: `User "${userAlias}" not found. Try searching below.` };

    // Insert
    const { error } = await supabase
        .from("event_judges")
        .insert({
            event_id: eventId,
            user_id: (judgeUser as { id: string }).id,
        });

    if (error) {
        if (error.code === "23505") return { success: false, error: "This user is already a judge." };
        return { success: false, error: error.message };
    }

    revalidatePath(`/community/events/${eventId}/manage`);
    return { success: true };
}

/**
 * Remove a judge from an event.
 */
export async function removeEventJudge(
    judgeId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Fetch the judge record to verify the event ownership
    const { data: judge } = await supabase
        .from("event_judges")
        .select("event_id")
        .eq("id", judgeId)
        .single();

    if (!judge) return { success: false, error: "Judge record not found." };

    const eventId = (judge as { event_id: string }).event_id;

    const { data: event } = await supabase
        .from("events")
        .select("created_by")
        .eq("id", eventId)
        .single();

    if (!event || (event as { created_by: string }).created_by !== user.id) {
        return { success: false, error: "Only the event creator can remove judges." };
    }

    const { error } = await supabase
        .from("event_judges")
        .delete()
        .eq("id", judgeId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/community/events/${eventId}/manage`);
    return { success: true };
}

// ============================================================
// EVENT COMMENTS
// ============================================================

/**
 * Add a comment to an event.
 */
export async function addEventComment(
    eventId: string,
    content: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();
    if (!content.trim()) return { success: false, error: "Comment cannot be empty." };
    if (content.trim().length > 500) return { success: false, error: "Comment is too long (500 char max)." };

    const { error } = await supabase.from("event_comments").insert({
        event_id: eventId,
        user_id: user.id,
        content: sanitizeText(content),
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/community/events/${eventId}`);

    // Deferred: notify event creator + mentions after response is sent
    const userId = user.id;
    const trimmedContent = content.trim();
    after(async () => {
        try {
            const supabaseDeferred = await createClient();
            const { data: event } = await supabaseDeferred.from("events").select("created_by, name").eq("id", eventId).single();
            if (event && (event as { created_by: string }).created_by !== userId) {
                const { data: actor } = await supabaseDeferred.from("users").select("alias_name").eq("id", userId).single();
                const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
                const { createNotification } = await import("@/app/actions/notifications");
                await createNotification({
                    userId: (event as { created_by: string }).created_by,
                    type: "comment",
                    actorId: userId,
                    content: `@${alias} commented on your event "${(event as { name: string }).name}"`,
                });
                const { parseAndNotifyMentions } = await import("@/app/actions/mentions");
                await parseAndNotifyMentions(trimmedContent, userId, alias, `/community/events/${eventId}`);
            }
        } catch { /* non-blocking */ }
    });

    return { success: true };
}

/**
 * Delete an event comment.
 */
export async function deleteEventComment(
    commentId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { error } = await supabase
        .from("event_comments")
        .delete()
        .eq("id", commentId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/community/events");
    return { success: true };
}

/**
 * Get comments for an event, with user aliases via PostgREST join.
 */
export async function getEventComments(eventId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("event_comments")
        .select("id, content, created_at, user_id, users!event_comments_user_id_fkey(alias_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(50);

    return (data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        content: c.content as string,
        createdAt: c.created_at as string,
        userId: c.user_id as string,
        userAlias: (c.users as { alias_name: string } | null)?.alias_name ?? "Unknown",
    }));
}

// ============================================================
// EVENT ATTENDEES
// ============================================================

/**
 * Get list of users who RSVP'd "going" or "interested" to an event.
 */
export async function getEventAttendees(eventId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("event_rsvps")
        .select("user_id, status, users!event_rsvps_user_id_fkey(alias_name)")
        .eq("event_id", eventId)
        .in("status", ["going", "interested"])
        .order("created_at", { ascending: true });

    return (data ?? []).map((r: Record<string, unknown>) => ({
        userId: r.user_id as string,
        status: r.status as string,
        alias: (r.users as { alias_name: string } | null)?.alias_name ?? "Unknown",
    }));
}

// ============================================================
// EVENT PHOTOS
// ============================================================

/**
 * Add a photo to an event (direct-to-storage path).
 */
export async function addEventPhoto(
    eventId: string,
    imagePath: string,
    caption?: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { error } = await supabase.from("event_photos").insert({
        event_id: eventId,
        user_id: user.id,
        image_path: imagePath,
        caption: caption?.trim() || null,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/community/events/${eventId}`);
    return { success: true };
}

/**
 * Get photos for an event with signed URLs.
 */
export async function getEventPhotos(eventId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("event_photos")
        .select("id, image_path, caption, created_at, user_id, users!event_photos_user_id_fkey(alias_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    const photos = ((data ?? []) as unknown as {
        id: string; image_path: string; caption: string | null;
        created_at: string; user_id: string;
        users: { alias_name: string } | null;
    }[]);

    // Batch public URLs
    if (photos.length === 0) return [];
    const { getPublicImageUrls } = await import("@/lib/utils/storage");
    const paths = photos.map(p => p.image_path);
    const urlMap = getPublicImageUrls(paths);

    return photos.map(p => ({
        id: p.id,
        imageUrl: urlMap.get(p.image_path) || "",
        caption: p.caption,
        createdAt: p.created_at,
        userId: p.user_id,
        userAlias: p.users?.alias_name ?? "Unknown",
    }));
}

/**
 * Delete an event photo.
 */
export async function deleteEventPhoto(
    photoId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Fetch the photo URL before deleting
    try {
        const { data: photo } = await supabase
            .from("event_photos")
            .select("image_url")
            .eq("id", photoId)
            .maybeSingle();

        if (photo) {
            const url = (photo as { image_url: string }).image_url;
            const match = url.match(/horse-images\/(.+?)(\?|$)/);
            if (match) {
                await supabase.storage.from("horse-images").remove([match[1]]);
            }
        }
    } catch { /* best effort */ }

    const { error } = await supabase.from("event_photos").delete().eq("id", photoId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/community/events");
    return { success: true };
}
