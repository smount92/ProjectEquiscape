"use server";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

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
    judgingMethod?: string;
    creatorAlias?: string;
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
    placing: string | null;
    className: string | null;
    divisionName: string | null;
    caption: string | null;
}

/**
 * Get all photo shows (latest first).
 * Now reads from `events` WHERE event_type = 'photo_show'.
 */
export async function getPhotoShows(): Promise<ShowDisplay[]> {
    const supabase = await createClient();

    const { data: shows } = await supabase
        .from("events")
        .select("id, name, description, event_type, show_status, show_theme, starts_at, ends_at, created_at, created_by, users!created_by(alias_name)")
        .in("event_type", ["photo_show", "live_show"])
        .order("created_at", { ascending: false });

    if (!shows || shows.length === 0) return [];

    type EventRow = {
        id: string; name: string; description: string | null;
        show_status: string; show_theme: string | null;
        starts_at: string; ends_at: string | null; created_at: string;
        created_by: string; users: { alias_name: string } | { alias_name: string }[] | null;
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


    return (shows as EventRow[]).map(s => {
        // Derive effective status: if entries closed but still marked open, treat as judging
        let effectiveStatus = s.show_status || "open";
        if (effectiveStatus === "open" && s.ends_at && new Date(s.ends_at) < new Date()) {
            effectiveStatus = "judging";
        }
        return {
            id: s.id,
            title: s.name,
            description: s.description,
            theme: s.show_theme,
            status: effectiveStatus,
            entryCount: countMap.get(s.id) || 0,
            createdAt: s.created_at,
            endAt: s.ends_at,
            createdBy: s.created_by,
            creatorAlias: (Array.isArray(s.users) ? s.users[0]?.alias_name : s.users?.alias_name) || "Unknown",
        };
    });
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

    // Fetch event (include judging_method for expert judge flow)
    const { data: eventData } = await supabase
        .from("events")
        .select("id, name, description, show_status, show_theme, ends_at, created_at, created_by, judging_method")
        .eq("id", showId)
        .single();

    if (!eventData) return { show: null, entries: [] };

    const s = eventData as {
        id: string; name: string; description: string | null;
        show_status: string; show_theme: string | null;
        ends_at: string | null; created_at: string; created_by: string;
        judging_method: string | null;
    };

    // Auto-transition: open → judging when entry deadline has passed
    if (s.show_status === "open" && s.ends_at && new Date(s.ends_at) < new Date()) {
        const admin = getAdminClient();
        await admin.from("events")
            .update({ show_status: "judging" })
            .eq("id", showId)
            .eq("show_status", "open"); // CAS guard — only update if still open
        s.show_status = "judging"; // Update in-memory for this render
    }

    const isExpertJudged = s.judging_method === "expert_judge";

    // Fetch entries with user alias via PostgREST join
    const { data: rawEntries } = await supabase
        .from("event_entries")
        .select("id, horse_id, user_id, votes_count, created_at, placing, class_id, entry_image_path, caption, users!user_id(alias_name)")
        .eq("event_id", showId)
        .eq("entry_type", "entered")
        .order("votes_count", { ascending: false });

    const entryList = (rawEntries as unknown as {
        id: string; horse_id: string; user_id: string; votes_count: number;
        created_at: string; placing: string | null; class_id: string | null;
        entry_image_path: string | null; caption: string | null;
        users: { alias_name: string } | null;
    }[]) ?? [];

    if (entryList.length === 0) {
        return {
            show: { id: s.id, title: s.name, description: s.description, theme: s.show_theme, status: s.show_status || "open", entryCount: 0, createdAt: s.created_at, endAt: s.ends_at, createdBy: s.created_by, judgingMethod: s.judging_method || "community_vote" },
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
    const signedUrls = getPublicImageUrls(allThumbUrls);

    // Batch-fetch class names + division names for entries
    const classIds = [...new Set(entryList.filter(e => e.class_id).map(e => e.class_id!))];
    const classMap = new Map<string, { className: string; divisionName: string }>();
    if (classIds.length > 0) {
        const { data: classRows } = await supabase
            .from("event_classes")
            .select("id, name, event_divisions!division_id(name)")
            .in("id", classIds);
        (classRows ?? []).forEach((cr: { id: string; name: string; event_divisions: { name: string } | { name: string }[] | null }) => {
            const divObj = Array.isArray(cr.event_divisions) ? cr.event_divisions[0] : cr.event_divisions;
            classMap.set(cr.id, { className: cr.name, divisionName: divObj?.name || "General" });
        });
    }

    let finalEntries = entryList.map(e => {
        // Entry image takes priority: custom entry photo > horse thumbnail
        let displayThumb: string | null = null;
        if (e.entry_image_path) {
            // entry_image_path is a storage path — resolve to public URL
            const entryUrl = `${e.entry_image_path}`;
            displayThumb = getPublicImageUrls([entryUrl]).get(entryUrl) ?? null;
        } else if (thumbUrlMap.has(e.horse_id)) {
            displayThumb = signedUrls.get(thumbUrlMap.get(e.horse_id)!) ?? null;
        }

        return {
            id: e.id,
            horseName: horseMap.get(e.horse_id)?.name || "Unknown",
            horseId: e.horse_id,
            ownerAlias: e.users?.alias_name || "Unknown",
            ownerId: e.user_id,
            thumbnailUrl: displayThumb,
            finishType: horseMap.get(e.horse_id)?.finish || "OF",
            votes: e.votes_count,
            hasVoted: votedSet.has(e.id),
            createdAt: e.created_at,
            placing: e.placing,
            className: e.class_id ? (classMap.get(e.class_id)?.className || null) : null,
            divisionName: e.class_id ? (classMap.get(e.class_id)?.divisionName || null) : null,
            caption: e.caption || null,
        };
    });

    // For expert-judged closed shows, sort by placing (1st, 2nd, 3rd...) instead of votes
    if (isExpertJudged && s.show_status === "closed") {
        const placingOrder: Record<string, number> = { "1st": 1, "2nd": 2, "3rd": 3, "HM": 4 };
        finalEntries = finalEntries.sort((a, b) => {
            const aOrder = a.placing ? (placingOrder[a.placing] ?? 99) : 99;
            const bOrder = b.placing ? (placingOrder[b.placing] ?? 99) : 99;
            return aOrder - bOrder;
        });
    }

    return {
        show: { id: s.id, title: s.name, description: s.description, theme: s.show_theme, status: s.show_status || "open", entryCount: entryList.length, createdAt: s.created_at, endAt: s.ends_at, createdBy: s.created_by, judgingMethod: s.judging_method || "community_vote" },
        entries: finalEntries,
    };
}

/**
 * Enter a horse in a show.
 */
export async function enterShow(
    showId: string,
    horseId: string,
    classId?: string,
    entryImagePath?: string,
    caption?: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify show is open
    const { data: event } = await supabase
        .from("events")
        .select("show_status, ends_at")
        .eq("id", showId)
        .single();
    if (!event) {
        return { success: false, error: "This show is not accepting entries." };
    }
    const currentStatus = (event as { show_status: string | null }).show_status || "open";
    if (currentStatus !== "open") {
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

    // Scale enforcement: if entering a class with allowed_scales, verify the horse matches
    if (classId) {
        const { data: classData } = await supabase
            .from("event_classes")
            .select("allowed_scales")
            .eq("id", classId)
            .single();

        const allowedScales = (classData as { allowed_scales: string[] | null } | null)?.allowed_scales;
        if (allowedScales && allowedScales.length > 0) {
            // Get horse's scale via catalog_items
            const { data: horseRef } = await supabase
                .from("user_horses")
                .select("catalog_items:catalog_id(scale)")
                .eq("id", horseId)
                .single();

            const horseScale = (horseRef as { catalog_items: { scale: string } | null } | null)?.catalog_items?.scale;
            if (horseScale && !allowedScales.includes(horseScale)) {
                return { success: false, error: `This class only accepts: ${allowedScales.join(", ")}. Your horse is a ${horseScale}.` };
            }
        }
    }

    const insertData: Record<string, unknown> = {
        event_id: showId,
        horse_id: horseId,
        user_id: user.id,
        entry_type: "entered",
    };
    if (classId) insertData.class_id = classId;
    if (entryImagePath) insertData.entry_image_path = entryImagePath;
    if (caption?.trim()) insertData.caption = caption.trim().slice(0, 280);

    const { error } = await supabase.from("event_entries").insert(insertData);

    if (error) {
        if (error.code === "23505") return { success: false, error: "This horse is already entered." };
        return { success: false, error: error.message };
    }

    // Deferred: evaluate show achievements
    const showUserId = user.id;
    after(async () => {
        try {
            const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
            await evaluateUserAchievements(showUserId, "show_entered");
        } catch { /* non-blocking */ }
    });

    return { success: true };
}

/**
 * Vote for a show entry (uses atomic RPC).
 */
export async function voteForEntry(
    entryId: string
): Promise<{ success: boolean; newVotes?: number; error?: string }> {
    const { supabase, user } = await requireAuth();

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
    revalidateTag("shows", "max");
    return { success: true };
}

/** Update show status. If closing, calls close_virtual_show RPC. */
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
    revalidateTag("shows", "max");

    // Notify all entrants when show results are announced — personalized
    if (newStatus === "closed") {
        const closingShowId = showId;
        after(async () => {
            try {
                const adminClient = getAdminClient();
                const { data: show } = await adminClient
                    .from("events")
                    .select("name")
                    .eq("id", closingShowId)
                    .single();
                const showName = (show as { name: string } | null)?.name || "the show";

                // Get entries with placing + horse names
                const { data: entries } = await adminClient
                    .from("event_entries")
                    .select("user_id, placing, horse_id")
                    .eq("event_id", closingShowId)
                    .eq("entry_type", "entered");

                if (!entries || entries.length === 0) return;

                // Batch-fetch horse names
                const horseIds = [...new Set((entries as { horse_id: string }[]).map(e => e.horse_id))];
                const { data: horses } = await adminClient
                    .from("user_horses")
                    .select("id, custom_name")
                    .in("id", horseIds);
                const horseNameMap = new Map<string, string>();
                (horses ?? []).forEach((h: { id: string; custom_name: string }) => horseNameMap.set(h.id, h.custom_name));

                const MEDAL_EMOJI: Record<string, string> = {
                    "1st": "🥇", "2nd": "🥈", "3rd": "🥉",
                    "Champion": "🏆", "Reserve Champion": "🥈",
                    "Grand Champion": "🏆", "Reserve Grand Champion": "🥈",
                };

                const { createNotification } = await import("@/app/actions/notifications");

                for (const entry of entries as { user_id: string; placing: string | null; horse_id: string }[]) {
                    const horseName = horseNameMap.get(entry.horse_id) || "your horse";
                    if (entry.placing) {
                        const medal = MEDAL_EMOJI[entry.placing] || "🏅";
                        await createNotification({
                            userId: entry.user_id,
                            type: "show_result",
                            actorId: entry.user_id,
                            content: `${medal} Congratulations! ${horseName} took ${entry.placing} in "${showName}"!`,
                        });
                    } else {
                        await createNotification({
                            userId: entry.user_id,
                            type: "show_result",
                            actorId: entry.user_id,
                            content: `📸 Results are in for "${showName}"! Thanks for entering ${horseName}.`,
                        });
                    }
                }
            } catch { /* non-blocking */ }
        });
    }

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
    const { supabase, user } = await requireAuth();

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

/**
 * Batch-record show results from the Show String Planner.
 * Creates show_records entries for each result.
 */
export async function batchRecordResults(records: {
    horseId: string;
    showName: string;
    showDate: string | null;
    division: string | null;
    className: string;
    placing: string | null;
    ribbonColor: string | null;
}[]): Promise<{ success: boolean; error?: string; count?: number }> {
    const { supabase, user } = await requireAuth();

    if (records.length === 0) return { success: true, count: 0 };

    // Verify all horses belong to user
    const horseIds = [...new Set(records.map(r => r.horseId))];
    const { data: ownedHorses } = await supabase
        .from("user_horses")
        .select("id")
        .eq("owner_id", user.id)
        .in("id", horseIds);

    const ownedSet = new Set((ownedHorses ?? []).map((h: { id: string }) => h.id));
    const validRecords = records.filter(r => ownedSet.has(r.horseId));

    if (validRecords.length === 0) {
        return { success: false, error: "No valid horses found." };
    }

    const inserts = validRecords.map(r => ({
        horse_id: r.horseId,
        show_name: r.showName,
        show_date: r.showDate,
        division: r.division,
        placing: r.placing,
        ribbon_color: r.ribbonColor,
    }));

    const { error } = await supabase.from("show_records").insert(inserts);
    if (error) return { success: false, error: error.message };

    revalidatePath("/shows/planner");
    return { success: true, count: validRecords.length };
}

/**
 * Save expert-judged placings for event entries.
 * Only the event creator (show host) or assigned judges can assign placings.
 * After saving, auto-generates show_records for placed entries.
 */
export async function saveExpertPlacings(
    eventId: string,
    placings: { entryId: string; placing: string }[]
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify user is the event creator or assigned judge
    const { data: event } = await supabase
        .from("events")
        .select("created_by, judging_method, name, starts_at")
        .eq("id", eventId)
        .single();

    if (!event) return { success: false, error: "Event not found." };
    const ev = event as { created_by: string; judging_method: string | null; name: string; starts_at: string };

    // Check if host or assigned judge
    let authorized = ev.created_by === user.id;
    if (!authorized) {
        const { data: judgeRecord } = await supabase
            .from("event_judges")
            .select("id")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();
        authorized = !!judgeRecord;
    }

    if (!authorized) {
        return { success: false, error: "Only the event host or assigned judges can assign placings." };
    }
    if (ev.judging_method !== "expert_judge") {
        return { success: false, error: "This event uses community voting, not expert judging." };
    }

    // Update each entry's placing
    for (const p of placings) {
        const { error } = await supabase
            .from("event_entries")
            .update({ placing: p.placing })
            .eq("id", p.entryId)
            .eq("event_id", eventId);

        if (error) return { success: false, error: error.message };
    }

    // Auto-generate show_records for placed entries
    const PLACING_TO_RIBBON: Record<string, string> = {
        "1st": "Blue",
        "2nd": "Red",
        "3rd": "Yellow",
        "4th": "White",
        "5th": "Pink",
        "6th": "Green",
        "HM": "Green",
        "Champion": "Grand Champion",
        "Reserve Champion": "Reserve Grand Champion",
        "Grand Champion": "Grand Champion",
        "Reserve Grand Champion": "Reserve Grand Champion",
        "Top 3": "Blue",
        "Top 5": "Blue",
        "Top 10": "Blue",
    };

    try {
        // Fetch placed entries with horse + user details
        const entryIds = placings.map(p => p.entryId);
        const { data: entries } = await supabase
            .from("event_entries")
            .select("id, horse_id, user_id, placing")
            .in("id", entryIds)
            .eq("event_id", eventId);

        if (entries && entries.length > 0) {
            const showDate = ev.starts_at ? ev.starts_at.split("T")[0] : null;
            // Use admin client for show_records — the judge's auth context
            // can't insert rows with another user's user_id (RLS blocks it)
            const admin = getAdminClient();

            for (const entry of entries as { id: string; horse_id: string; user_id: string; placing: string | null }[]) {
                if (!entry.placing) continue;

                const ribbonColor = PLACING_TO_RIBBON[entry.placing] || null;

                // Check if a show_record already exists for this combination
                const { data: existing } = await admin
                    .from("show_records")
                    .select("id")
                    .eq("horse_id", entry.horse_id)
                    .eq("show_name", ev.name)
                    .eq("placing", entry.placing)
                    .maybeSingle();

                if (!existing) {
                    await admin.from("show_records").insert({
                        horse_id: entry.horse_id,
                        user_id: entry.user_id,
                        show_name: ev.name,
                        show_date: showDate,
                        placing: entry.placing,
                        ribbon_color: ribbonColor,
                        is_nan: false,
                        notes: "Auto-generated from expert judging",
                    });
                }
            }
        }
    } catch {
        // Non-blocking — placing updates already saved
    }

    revalidatePath(`/community/events/${eventId}`);
    return { success: true };
}

// ============================================================
// Show History for Current User
// ============================================================

interface ShowHistoryRecord {
    horseName: string;
    horseId: string;
    showName: string;
    placing: string;
    ribbonColor: string | null;
    showDate: string;
}

interface ShowHistoryYear {
    year: number;
    records: ShowHistoryRecord[];
}

/** Get show history summary for the current user */
export async function getShowHistory(): Promise<{
    years: ShowHistoryYear[];
    totalShows: number;
    totalRibbons: number;
}> {
    const { user } = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("show_records")
        .select("horse_id, show_name, placing, ribbon_color, show_date")
        .eq("user_id", user.id)
        .order("show_date", { ascending: false });

    if (error || !data) return { years: [], totalShows: 0, totalRibbons: 0 };

    // Get horse names
    const horseIds = [...new Set((data as { horse_id: string }[]).map(r => r.horse_id))];
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .in("id", horseIds);
    const horseNameMap = new Map<string, string>();
    (horses ?? []).forEach((h: { id: string; custom_name: string }) => horseNameMap.set(h.id, h.custom_name));

    // Group by year
    const yearMap = new Map<number, ShowHistoryRecord[]>();
    const showNames = new Set<string>();

    for (const r of data as { horse_id: string; show_name: string; placing: string; ribbon_color: string | null; show_date: string }[]) {
        const year = new Date(r.show_date).getFullYear();
        const records = yearMap.get(year) || [];
        records.push({
            horseName: horseNameMap.get(r.horse_id) || "Unknown Horse",
            horseId: r.horse_id,
            showName: r.show_name,
            placing: r.placing,
            ribbonColor: r.ribbon_color,
            showDate: r.show_date,
        });
        yearMap.set(year, records);
        showNames.add(r.show_name);
    }

    const years = Array.from(yearMap.entries())
        .sort(([a], [b]) => b - a)
        .map(([year, records]) => ({ year, records }));

    return {
        years,
        totalShows: showNames.size,
        totalRibbons: data.length,
    };
}
