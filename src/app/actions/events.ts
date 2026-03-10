"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// EVENTS — Server Actions
// ============================================================

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
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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
        .select("*")
        .order("starts_at", { ascending: true })
        .limit(50);

    if (filters?.eventType && filters.eventType !== "all") {
        query = query.eq("event_type", filters.eventType);
    }
    if (filters?.region) {
        query = query.ilike("region", `%${filters.region}%`);
    }
    if (filters?.upcoming !== false) {
        query = query.gte("starts_at", new Date().toISOString());
    }
    if (filters?.groupId) {
        query = query.eq("group_id", filters.groupId);
    }

    const { data: events } = await query;
    if (!events || events.length === 0) return [];

    // Get creator aliases
    const creatorIds = [...new Set((events as { created_by: string }[]).map(e => e.created_by))];
    const { data: creators } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", creatorIds);
    const aliasMap = new Map<string, string>();
    (creators || []).forEach((c: { id: string; alias_name: string }) => aliasMap.set(c.id, c.alias_name));

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
        creatorAlias: aliasMap.get(e.created_by as string) || "Unknown",
        isOfficial: e.is_official as boolean,
        rsvpCount: e.rsvp_count as number,
        createdAt: e.created_at as string,
        userRsvp: rsvpMap.get(e.id as string) || null,
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
    };
}

/** Set RSVP status */
export async function rsvpEvent(
    eventId: string,
    status: "going" | "interested" | "not_going"
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

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
    }));
}

/** Delete an event (creator only) */
export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("id", eventId)
        .eq("created_by", user.id)
        .maybeSingle();

    if (!event) return { success: false, error: "Event not found or not yours." };

    // Delete RSVPs first
    await supabase.from("event_rsvps").delete().eq("event_id", eventId);
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/events");
    return { success: true };
}
