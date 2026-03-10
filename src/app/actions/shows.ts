"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSignedImageUrls } from "@/lib/utils/storage";
import { revalidatePath } from "next/cache";

// ============================================================
// PHOTO SHOWS — Server Actions
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
 */
export async function getPhotoShows(): Promise<ShowDisplay[]> {
    const supabase = await createClient();

    const { data: shows } = await supabase
        .from("photo_shows")
        .select("id, title, description, theme, status, created_at, end_at")
        .order("created_at", { ascending: false });

    if (!shows || shows.length === 0) return [];

    // Count entries per show
    const showIds = shows.map((s: { id: string }) => s.id);
    const { data: entries } = await supabase
        .from("show_entries")
        .select("show_id")
        .in("show_id", showIds);

    const countMap = new Map<string, number>();
    (entries ?? []).forEach((e: { show_id: string }) => {
        countMap.set(e.show_id, (countMap.get(e.show_id) || 0) + 1);
    });

    // Auto-close shows past their end date (lazy)
    const expiredShows = shows.filter(
        (s: { id: string; status: string; end_at: string | null }) =>
            s.status === "open" && s.end_at && new Date(s.end_at) < new Date()
    );
    if (expiredShows.length > 0) {
        const admin = getAdminClient();
        for (const expired of expiredShows) {
            await admin.from("photo_shows")
                .update({ status: "judging" })
                .eq("id", (expired as { id: string }).id);
            // Update local reference so return reflects new status
            (expired as { status: string }).status = "judging";
        }
    }

    return shows.map((s: { id: string; title: string; description: string | null; theme: string | null; status: string; created_at: string; end_at: string | null }) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        theme: s.theme,
        status: s.status,
        entryCount: countMap.get(s.id) || 0,
        createdAt: s.created_at,
        endAt: s.end_at,
    }));
}

/**
 * Get entries for a specific show.
 */
export async function getShowEntries(showId: string): Promise<{
    show: ShowDisplay | null;
    entries: ShowEntryDisplay[];
}> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Fetch show
    const { data: showData } = await supabase
        .from("photo_shows")
        .select("id, title, description, theme, status, created_at, end_at")
        .eq("id", showId)
        .single();

    if (!showData) return { show: null, entries: [] };

    const s = showData as { id: string; title: string; description: string | null; theme: string | null; status: string; created_at: string; end_at: string | null };

    // Fetch entries with horse + user data
    const { data: rawEntries } = await supabase
        .from("show_entries")
        .select("id, horse_id, user_id, votes, created_at")
        .eq("show_id", showId)
        .order("votes", { ascending: false });

    const entryList = (rawEntries ?? []) as { id: string; horse_id: string; user_id: string; votes: number; created_at: string }[];

    if (entryList.length === 0) {
        return {
            show: { id: s.id, title: s.title, description: s.description, theme: s.theme, status: s.status, entryCount: 0, createdAt: s.created_at, endAt: s.end_at },
            entries: [],
        };
    }

    // Batch-fetch horse names + finishes
    const horseIds = [...new Set(entryList.map((e) => e.horse_id))];
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name, finish_type")
        .in("id", horseIds);

    const horseMap = new Map<string, { name: string; finish: string }>();
    (horses ?? []).forEach((h: { id: string; custom_name: string; finish_type: string }) => {
        horseMap.set(h.id, { name: h.custom_name, finish: h.finish_type });
    });

    // Batch-fetch user aliases
    const userIds = [...new Set(entryList.map((e) => e.user_id))];
    const { data: users } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", userIds);

    const aliasMap = new Map<string, string>();
    (users ?? []).forEach((u: { id: string; alias_name: string }) => {
        aliasMap.set(u.id, u.alias_name);
    });

    // Check if current user has voted on each entry
    const entryIds = entryList.map((e) => e.id);
    let votedSet = new Set<string>();
    if (user) {
        const { data: votes } = await supabase
            .from("show_votes")
            .select("entry_id")
            .eq("user_id", user.id)
            .in("entry_id", entryIds);
        votedSet = new Set((votes ?? []).map((v: { entry_id: string }) => v.entry_id));
    }

    // Batch-fetch primary thumbnails for entered horses
    const { data: thumbRows } = await supabase
        .from("horse_images")
        .select("horse_id, image_url, angle_profile")
        .in("horse_id", horseIds);

    // Pick Primary_Thumbnail or first image per horse
    const thumbUrlMap = new Map<string, string>();
    const allThumbUrls: string[] = [];
    for (const hId of horseIds) {
        const imgs = (thumbRows ?? []).filter((r: { horse_id: string; image_url: string; angle_profile: string }) => r.horse_id === hId);
        const primary = imgs.find((i: { angle_profile: string }) => i.angle_profile === "Primary_Thumbnail");
        const url = (primary ?? imgs[0])?.image_url;
        if (url) {
            thumbUrlMap.set(hId, url);
            allThumbUrls.push(url);
        }
    }
    const signedUrls = await getSignedImageUrls(supabase, allThumbUrls);

    return {
        show: { id: s.id, title: s.title, description: s.description, theme: s.theme, status: s.status, entryCount: entryList.length, createdAt: s.created_at, endAt: s.end_at },
        entries: entryList.map((e) => ({
            id: e.id,
            horseName: horseMap.get(e.horse_id)?.name || "Unknown",
            horseId: e.horse_id,
            ownerAlias: aliasMap.get(e.user_id) || "Unknown",
            ownerId: e.user_id,
            thumbnailUrl: thumbUrlMap.has(e.horse_id) ? (signedUrls.get(thumbUrlMap.get(e.horse_id)!) ?? null) : null,
            finishType: horseMap.get(e.horse_id)?.finish || "OF",
            votes: e.votes,
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
    const { data: show } = await supabase
        .from("photo_shows")
        .select("status, end_at")
        .eq("id", showId)
        .single();
    if (!show || (show as { status: string }).status !== "open") {
        return { success: false, error: "This show is not accepting entries." };
    }

    // Check deadline
    const showData = show as { status: string; end_at: string | null };
    if (showData.end_at && new Date(showData.end_at) < new Date()) {
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
        .from("show_entries")
        .select("id", { count: "exact", head: true })
        .eq("show_id", showId)
        .eq("user_id", user.id);

    if ((existingEntries ?? 0) >= 3) {
        return { success: false, error: "Maximum 3 entries per show." };
    }

    const { error } = await supabase.from("show_entries").insert({
        show_id: showId,
        horse_id: horseId,
        user_id: user.id,
    });

    if (error) {
        if (error.code === "23505") return { success: false, error: "This horse is already entered." };
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Vote for a show entry.
 */
export async function voteForEntry(
    entryId: string
): Promise<{ success: boolean; newVotes?: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "You must be logged in." };

    // Single atomic RPC — handles self-vote check, toggle, count update
    const admin = getAdminClient();
    const { data, error } = await admin.rpc("toggle_show_vote", {
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

    // Send notification on upvote (not on unvote)
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
 * Admin: Create a photo show.
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

    const { error } = await admin.from("photo_shows").insert({
        title: data.title.trim(),
        description: data.description?.trim() || null,
        theme: data.theme?.trim() || null,
        end_at: data.endAt || null,
        created_by: user.id,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Admin: Update show status.
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

    const { error } = await admin.from("photo_shows")
        .update({ status: newStatus })
        .eq("id", showId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Admin: Delete a show.
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

    const { error } = await admin.from("photo_shows").delete().eq("id", showId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Remove your own entry from a show.
 */
export async function withdrawEntry(
    entryId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not logged in." };

    // Verify ownership
    const { data: entry } = await supabase
        .from("show_entries")
        .select("user_id")
        .eq("id", entryId)
        .single();

    if (!entry || (entry as { user_id: string }).user_id !== user.id) {
        return { success: false, error: "Not your entry." };
    }

    const { error } = await supabase
        .from("show_entries")
        .delete()
        .eq("id", entryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
