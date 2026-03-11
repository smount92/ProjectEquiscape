"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSignedImageUrls } from "@/lib/utils/storage";
import { revalidatePath } from "next/cache";

// ============================================================
// UNIFIED COMPETITION — Server Actions
// Events + Event Entries + Event Votes (replaces photo_shows)
// ============================================================

interface ShowDisplay {
    id: string;
    title: string;
    description: string | null;
    theme: string | null;
    status: string;
    entryCount: number;
    createdAt: string;
    endAt: string | null;
    createdBy?: string;
}

interface ShowEntryDisplay {
    id: string;
    horseName: string;
    horseId: string;
    ownerAlias: string;
    ownerId: string;
    thumbnailUrl: string | null;
    finishType: string;
    votes: number;
    hasVoted: boolean;
    createdAt: string;
}

/**
 * Get all photo shows (latest first).
 * Now reads from `events` WHERE event_type = 'photo_show'.
 */
export async function getPhotoShows(): Promise<ShowDisplay[]> {
    const supabase = await createClient();

    const { data: shows } = await supabase
        .from("events")
        .select("id, name, description, event_type, show_status, show_theme, starts_at, ends_at, created_at")
        .eq("event_type", "photo_show")
        .order("created_at", { ascending: false });

    if (!shows || shows.length === 0) return [];

    type EventRow = {
        id: string; name: string; description: string | null;
        show_status: string; show_theme: string | null;
        starts_at: string; ends_at: string | null; created_at: string;
    };

    // Count entries per show
    const eventIds = (shows as EventRow[]).map(s => s.id);
    const { data: entries } = await supabase
        .from("event_entries")
        .select("event_id")
        .in("event_id", eventIds)
        .eq("entry_type", "entered");

    const countMap = new Map<string, number>();
    (entries ?? []).forEach((e: { event_id: string }) => {
        countMap.set(e.event_id, (countMap.get(e.event_id) || 0) + 1);
    });

    // Auto-transition expired open shows to judging
    const expiredShows = (shows as EventRow[]).filter(
        s => s.show_status === "open" && s.ends_at && new Date(s.ends_at) < new Date()
    );
    if (expiredShows.length > 0) {
        const admin = getAdminClient();
        for (const expired of expiredShows) {
            await admin.from("events")
                .update({ show_status: "judging" })
                .eq("id", expired.id);
            expired.show_status = "judging";
        }
    }

    return (shows as EventRow[]).map(s => ({
        id: s.id,
        title: s.name,
        description: s.description,
        theme: s.show_theme,
        status: s.show_status || "open",
        entryCount: countMap.get(s.id) || 0,
        createdAt: s.created_at,
        endAt: s.ends_at,
    }));
}

/**
 * Get entries for a specific show (now event-based).
 */
export async function getShowEntries(showId: string): Promise<{
    show: ShowDisplay | null;
    entries: ShowEntryDisplay[];
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch event
    const { data: eventData } = await supabase
        .from("events")
        .select("id, name, description, show_status, show_theme, ends_at, created_at, created_by")
        .eq("id", showId)
        .single();

    if (!eventData) return { show: null, entries: [] };

    const s = eventData as {
        id: string; name: string; description: string | null;
        show_status: string; show_theme: string | null;
        ends_at: string | null; created_at: string; created_by: string;
    };

    // Fetch entries with user alias via PostgREST join
    const { data: rawEntries } = await supabase
        .from("event_entries")
        .select("id, horse_id, user_id, votes_count, created_at, placing, users!user_id(alias_name)")
        .eq("event_id", showId)
        .eq("entry_type", "entered")
        .order("votes_count", { ascending: false });

    const entryList = (rawEntries as unknown as {
        id: string; horse_id: string; user_id: string; votes_count: number;
        created_at: string; placing: string | null;
        users: { alias_name: string } | null;
    }[]) ?? [];

    if (entryList.length === 0) {
        return {
            show: { id: s.id, title: s.name, description: s.description, theme: s.show_theme, status: s.show_status || "open", entryCount: 0, createdAt: s.created_at, endAt: s.ends_at, createdBy: s.created_by },
            entries: [],
        };
    }

    // Batch-fetch horse names + finishes
    const horseIds = [...new Set(entryList.map(e => e.horse_id))];
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name, finish_type")
        .in("id", horseIds);

    const horseMap = new Map<string, { name: string; finish: string }>();
    (horses ?? []).forEach((h: { id: string; custom_name: string; finish_type: string }) => {
        horseMap.set(h.id, { name: h.custom_name, finish: h.finish_type });
    });

    // Check if current user has voted on each entry
    const entryIds = entryList.map(e => e.id);
    let votedSet = new Set<string>();
    if (user) {
        const { data: votes } = await supabase
            .from("event_votes")
            .select("entry_id")
            .eq("user_id", user.id)
            .in("entry_id", entryIds);
        votedSet = new Set((votes ?? []).map((v: { entry_id: string }) => v.entry_id));
    }

    // Batch-fetch primary thumbnails
    const { data: thumbRows } = await supabase
        .from("horse_images")
        .select("horse_id, image_url, angle_profile")
        .in("horse_id", horseIds);

    const thumbUrlMap = new Map<string, string>();
    const allThumbUrls: string[] = [];
    for (const hId of horseIds) {
        const imgs = (thumbRows ?? []).filter((r: { horse_id: string }) => r.horse_id === hId);
        const primary = imgs.find((i: { angle_profile: string }) => i.angle_profile === "Primary_Thumbnail");
        const url = (primary ?? imgs[0])?.image_url;
        if (url) {
            thumbUrlMap.set(hId, url);
            allThumbUrls.push(url);
        }
    }
    const signedUrls = await getSignedImageUrls(supabase, allThumbUrls);

    return {
        show: { id: s.id, title: s.name, description: s.description, theme: s.show_theme, status: s.show_status || "open", entryCount: entryList.length, createdAt: s.created_at, endAt: s.ends_at, createdBy: s.created_by },
        entries: entryList.map(e => ({
            id: e.id,
            horseName: horseMap.get(e.horse_id)?.name || "Unknown",
            horseId: e.horse_id,
            ownerAlias: e.users?.alias_name || "Unknown",
            ownerId: e.user_id,
            thumbnailUrl: thumbUrlMap.has(e.horse_id) ? (signedUrls.get(thumbUrlMap.get(e.horse_id)!) ?? null) : null,
            finishType: horseMap.get(e.horse_id)?.finish || "OF",
            votes: e.votes_count,
            hasVoted: votedSet.has(e.id),
            createdAt: e.created_at,
        })),
    };
}

/**
 * Enter a horse in a show.
 */
export async function enterShow(
    showId: string,
    horseId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "You must be logged in." };

    // Verify show is open
    const { data: event } = await supabase
        .from("events")
        .select("show_status, ends_at")
        .eq("id", showId)
        .single();
    if (!event || (event as { show_status: string }).show_status !== "open") {
        return { success: false, error: "This show is not accepting entries." };
    }

    const eventData = event as { show_status: string; ends_at: string | null };
    if (eventData.ends_at && new Date(eventData.ends_at) < new Date()) {
        return { success: false, error: "This show's entry deadline has passed." };
    }

    // Verify horse belongs to user and is public
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, is_public")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();
    if (!horse) return { success: false, error: "Horse not found or not yours." };
    if (!(horse as { is_public: boolean }).is_public) {
        return { success: false, error: "Horse must be public to enter." };
    }

    // Check entry limit (max 3 per user per show)
    const { count: existingEntries } = await supabase
        .from("event_entries")
        .select("id", { count: "exact", head: true })
        .eq("event_id", showId)
        .eq("user_id", user.id)
        .eq("entry_type", "entered");

    if ((existingEntries ?? 0) >= 3) {
        return { success: false, error: "Maximum 3 entries per show." };
    }

    const { error } = await supabase.from("event_entries").insert({
        event_id: showId,
        horse_id: horseId,
        user_id: user.id,
        entry_type: "entered",
    });

    if (error) {
        if (error.code === "23505") return { success: false, error: "This horse is already entered." };
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Vote for a show entry (uses atomic RPC).
 */
export async function voteForEntry(
    entryId: string
): Promise<{ success: boolean; newVotes?: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "You must be logged in." };

    const admin = getAdminClient();
    const { data, error } = await admin.rpc("vote_for_entry", {
        p_entry_id: entryId,
        p_user_id: user.id,
    });

    if (error) return { success: false, error: error.message };

    const result = data as {
        success: boolean;
        error?: string;
        new_votes?: number;
        action?: string;
        entry_owner?: string;
    };

    if (!result.success) return { success: false, error: result.error };

    // Send notification on upvote
    if (result.action === "voted" && result.entry_owner) {
        try {
            const { data: voter } = await supabase
                .from("users")
                .select("alias_name")
                .eq("id", user.id)
                .single();
            const voterAlias = (voter as { alias_name: string } | null)?.alias_name || "Someone";

            await admin.from("notifications").insert({
                user_id: result.entry_owner,
                type: "show_vote",
                actor_id: user.id,
                content: `@${voterAlias} voted for your show entry!`,
            });
        } catch { /* Non-blocking */ }
    }

    revalidatePath("/shows");
    return { success: true, newVotes: result.new_votes };
}

/**
 * Create a photo show (now inserts into events).
 */
export async function createPhotoShow(data: {
    title: string;
    description?: string;
    theme?: string;
    endAt?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
        return { success: false, error: "Unauthorized." };
    }

    const admin = getAdminClient();

    const { error } = await admin.from("events").insert({
        name: data.title.trim(),
        description: data.description?.trim() || null,
        event_type: "photo_show",
        show_status: "open",
        show_theme: data.theme?.trim() || null,
        starts_at: new Date().toISOString(),
        ends_at: data.endAt || null,
        is_virtual: true,
        created_by: user.id,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/shows");
    revalidatePath("/community/events");
    return { success: true };
}

/**
 * Update show status. If closing, calls close_virtual_show RPC.
 */
export async function updateShowStatus(
    showId: string,
    newStatus: "open" | "judging" | "closed"
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
        return { success: false, error: "Unauthorized." };
    }

    const admin = getAdminClient();

    if (newStatus === "closed") {
        // Use atomic RPC to assign placings and auto-generate show_records
        const { data, error } = await admin.rpc("close_virtual_show", {
            p_event_id: showId,
            p_user_id: user.id,
        });

        if (error) return { success: false, error: error.message };

        const result = data as { success: boolean; error?: string };
        if (!result.success) return { success: false, error: result.error };
    } else {
        const { error } = await admin.from("events")
            .update({ show_status: newStatus })
            .eq("id", showId);
        if (error) return { success: false, error: error.message };
    }

    revalidatePath("/shows");
    revalidatePath(`/shows/${showId}`);
    return { success: true };
}

/**
 * Delete a show (now deletes from events).
 */
export async function deleteShow(
    showId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
        return { success: false, error: "Unauthorized." };
    }

    const admin = getAdminClient();

    const { error } = await admin.from("events").delete().eq("id", showId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/shows");
    return { success: true };
}

/**
 * Withdraw your own entry from a show.
 */
export async function withdrawEntry(
    entryId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not logged in." };

    const { data: entry } = await supabase
        .from("event_entries")
        .select("user_id")
        .eq("id", entryId)
        .single();

    if (!entry || (entry as { user_id: string }).user_id !== user.id) {
        return { success: false, error: "Not your entry." };
    }

    const { error } = await supabase
        .from("event_entries")
        .delete()
        .eq("id", entryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
