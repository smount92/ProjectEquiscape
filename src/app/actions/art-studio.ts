"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// ART STUDIO — Server Actions
// ============================================================

// ── Status Transition Rules ──
const VALID_TRANSITIONS: Record<string, string[]> = {
    requested: ["accepted", "declined"],
    accepted: ["in_progress", "cancelled"],
    in_progress: ["review", "revision"],
    review: ["completed", "revision"],
    revision: ["in_progress"],
    completed: ["delivered"],
};

const STATUS_LABELS: Record<string, string> = {
    requested: "Requested",
    accepted: "Accepted",
    declined: "Declined",
    cancelled: "Cancelled",
    in_progress: "In Progress",
    review: "Under Review",
    revision: "Revision Requested",
    completed: "Completed",
    delivered: "Delivered",
};

// ── Types ──

export interface ArtistProfile {
    userId: string;
    studioName: string;
    studioSlug: string;
    specialties: string[];
    mediums: string[];
    scalesOffered: string[];
    bioArtist: string | null;
    portfolioVisible: boolean;
    status: string;
    maxSlots: number;
    turnaroundMinDays: number | null;
    turnaroundMaxDays: number | null;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    termsText: string | null;
    paypalMeLink: string | null;
    acceptingTypes: string[];
    ownerAlias: string;
}

export interface Commission {
    id: string;
    artistId: string;
    clientId: string | null;
    clientEmail: string | null;
    horseId: string | null;
    commissionType: string;
    description: string;
    referenceImages: string[];
    slotNumber: number | null;
    estimatedStart: string | null;
    estimatedCompletion: string | null;
    actualStart: string | null;
    actualCompletion: string | null;
    priceQuoted: number | null;
    depositAmount: number | null;
    depositPaid: boolean;
    finalPaid: boolean;
    status: string;
    statusLabel: string;
    isPublicInQueue: boolean;
    lastUpdateAt: string;
    createdAt: string;
    clientAlias: string | null;
    artistAlias: string;
}

export interface CommissionUpdate {
    id: string;
    commissionId: string;
    authorId: string;
    authorAlias: string;
    updateType: string;
    title: string | null;
    body: string | null;
    imageUrls: string[];
    oldStatus: string | null;
    newStatus: string | null;
    requiresPayment: boolean;
    isVisibleToClient: boolean;
    createdAt: string;
}

// ============================================================
// ARTIST PROFILES
// ============================================================

/** Fetch artist profile by user ID */
export async function getArtistProfile(userId: string): Promise<ArtistProfile | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (!data) return null;

    // Fetch alias
    const { data: user } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", userId)
        .single();

    const p = data as Record<string, unknown>;
    return {
        userId: p.user_id as string,
        studioName: p.studio_name as string,
        studioSlug: p.studio_slug as string,
        specialties: (p.specialties as string[]) || [],
        mediums: (p.mediums as string[]) || [],
        scalesOffered: (p.scales_offered as string[]) || [],
        bioArtist: p.bio_artist as string | null,
        portfolioVisible: p.portfolio_visible as boolean,
        status: p.status as string,
        maxSlots: (p.max_slots as number) || 5,
        turnaroundMinDays: p.turnaround_min_days as number | null,
        turnaroundMaxDays: p.turnaround_max_days as number | null,
        priceRangeMin: p.price_range_min as number | null,
        priceRangeMax: p.price_range_max as number | null,
        termsText: p.terms_text as string | null,
        paypalMeLink: p.paypal_me_link as string | null,
        acceptingTypes: (p.accepting_types as string[]) || [],
        ownerAlias: (user as { alias_name: string } | null)?.alias_name || "Unknown",
    };
}

/** Fetch artist profile by slug (for public URL) */
export async function getArtistProfileBySlug(slug: string): Promise<ArtistProfile | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("studio_slug", slug.toLowerCase().trim())
        .maybeSingle();

    if (!data) return null;

    const p = data as Record<string, unknown>;
    const userId = p.user_id as string;

    // Fetch alias
    const { data: user } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", userId)
        .single();

    return {
        userId,
        studioName: p.studio_name as string,
        studioSlug: p.studio_slug as string,
        specialties: (p.specialties as string[]) || [],
        mediums: (p.mediums as string[]) || [],
        scalesOffered: (p.scales_offered as string[]) || [],
        bioArtist: p.bio_artist as string | null,
        portfolioVisible: p.portfolio_visible as boolean,
        status: p.status as string,
        maxSlots: (p.max_slots as number) || 5,
        turnaroundMinDays: p.turnaround_min_days as number | null,
        turnaroundMaxDays: p.turnaround_max_days as number | null,
        priceRangeMin: p.price_range_min as number | null,
        priceRangeMax: p.price_range_max as number | null,
        termsText: p.terms_text as string | null,
        paypalMeLink: p.paypal_me_link as string | null,
        acceptingTypes: (p.accepting_types as string[]) || [],
        ownerAlias: (user as { alias_name: string } | null)?.alias_name || "Unknown",
    };
}

/** Create new artist profile */
export async function createArtistProfile(formData: FormData): Promise<{
    success: boolean;
    slug?: string;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const studioName = (formData.get("studioName") as string)?.trim();
    if (!studioName) return { success: false, error: "Studio name is required." };

    // Generate slug
    let slug = (formData.get("studioSlug") as string)?.trim().toLowerCase()
        .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
        slug = studioName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    }

    // Check slug uniqueness
    const { data: existing } = await supabase
        .from("artist_profiles")
        .select("user_id")
        .eq("studio_slug", slug)
        .maybeSingle();
    if (existing) return { success: false, error: `Slug "${slug}" is already taken.` };

    // Check if user already has a profile
    const { data: existingProfile } = await supabase
        .from("artist_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
    if (existingProfile) return { success: false, error: "You already have an artist profile." };

    // Parse arrays from form
    const specialties = parseArrayField(formData, "specialties");
    const mediums = parseArrayField(formData, "mediums");
    const scalesOffered = parseArrayField(formData, "scalesOffered");
    const acceptingTypes = parseArrayField(formData, "acceptingTypes");

    const { error } = await supabase.from("artist_profiles").insert({
        user_id: user.id,
        studio_name: studioName,
        studio_slug: slug,
        specialties,
        mediums,
        scales_offered: scalesOffered,
        bio_artist: (formData.get("bioArtist") as string)?.trim() || null,
        status: (formData.get("status") as string) || "closed",
        max_slots: parseInt(formData.get("maxSlots") as string) || 5,
        turnaround_min_days: parseInt(formData.get("turnaroundMinDays") as string) || null,
        turnaround_max_days: parseInt(formData.get("turnaroundMaxDays") as string) || null,
        price_range_min: parseFloat(formData.get("priceRangeMin") as string) || null,
        price_range_max: parseFloat(formData.get("priceRangeMax") as string) || null,
        terms_text: (formData.get("termsText") as string)?.trim() || null,
        paypal_me_link: (formData.get("paypalMeLink") as string)?.trim() || null,
        accepting_types: acceptingTypes,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/studio/setup");
    revalidatePath(`/studio/${slug}`);
    return { success: true, slug };
}

/** Update artist profile */
export async function updateArtistProfile(formData: FormData): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const studioName = (formData.get("studioName") as string)?.trim();
    if (!studioName) return { success: false, error: "Studio name is required." };

    // Check slug change
    const newSlug = (formData.get("studioSlug") as string)?.trim().toLowerCase()
        .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    if (newSlug) {
        const { data: existing } = await supabase
            .from("artist_profiles")
            .select("user_id")
            .eq("studio_slug", newSlug)
            .neq("user_id", user.id)
            .maybeSingle();
        if (existing) return { success: false, error: `Slug "${newSlug}" is already taken.` };
    }

    const specialties = parseArrayField(formData, "specialties");
    const mediums = parseArrayField(formData, "mediums");
    const scalesOffered = parseArrayField(formData, "scalesOffered");
    const acceptingTypes = parseArrayField(formData, "acceptingTypes");

    const { error } = await supabase
        .from("artist_profiles")
        .update({
            studio_name: studioName,
            ...(newSlug && { studio_slug: newSlug }),
            specialties,
            mediums,
            scales_offered: scalesOffered,
            bio_artist: (formData.get("bioArtist") as string)?.trim() || null,
            status: (formData.get("status") as string) || "closed",
            max_slots: parseInt(formData.get("maxSlots") as string) || 5,
            turnaround_min_days: parseInt(formData.get("turnaroundMinDays") as string) || null,
            turnaround_max_days: parseInt(formData.get("turnaroundMaxDays") as string) || null,
            price_range_min: parseFloat(formData.get("priceRangeMin") as string) || null,
            price_range_max: parseFloat(formData.get("priceRangeMax") as string) || null,
            terms_text: (formData.get("termsText") as string)?.trim() || null,
            paypal_me_link: (formData.get("paypalMeLink") as string)?.trim() || null,
            accepting_types: acceptingTypes,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/studio/setup");
    revalidatePath(`/studio/${newSlug}`);
    revalidatePath("/studio/dashboard");
    return { success: true };
}

// ============================================================
// COMMISSIONS
// ============================================================

/** Fetch all commissions where artist_id = current user */
export async function getArtistCommissions(): Promise<Commission[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: rawCommissions } = await supabase
        .from("commissions")
        .select("*")
        .eq("artist_id", user.id)
        .order("last_update_at", { ascending: false });

    if (!rawCommissions || rawCommissions.length === 0) return [];

    // Batch-fetch client aliases
    const clientIds = [...new Set(
        (rawCommissions as { client_id: string | null }[])
            .map(c => c.client_id)
            .filter(Boolean) as string[]
    )];
    const aliasMap = await batchFetchAliases(supabase, [...clientIds, user.id]);

    return (rawCommissions as Record<string, unknown>[]).map(c => mapCommission(c, aliasMap));
}

/** Fetch all commissions where client_id = current user */
export async function getClientCommissions(): Promise<Commission[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: rawCommissions } = await supabase
        .from("commissions")
        .select("*")
        .eq("client_id", user.id)
        .order("last_update_at", { ascending: false });

    if (!rawCommissions || rawCommissions.length === 0) return [];

    // Batch-fetch artist aliases
    const artistIds = [...new Set(
        (rawCommissions as { artist_id: string }[]).map(c => c.artist_id)
    )];
    const aliasMap = await batchFetchAliases(supabase, [...artistIds, user.id]);

    return (rawCommissions as Record<string, unknown>[]).map(c => mapCommission(c, aliasMap));
}

/** Client creates a commission request for an artist */
export async function createCommission(data: {
    artistId: string;
    commissionType: string;
    description: string;
    referenceImages?: string[];
    budget?: number;
}): Promise<{ success: boolean; commissionId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    if (user.id === data.artistId) {
        return { success: false, error: "You can't commission yourself." };
    }

    // Verify artist exists and is open/waitlist
    const { data: artist } = await supabase
        .from("artist_profiles")
        .select("status, studio_name")
        .eq("user_id", data.artistId)
        .single();

    if (!artist) return { success: false, error: "Artist profile not found." };
    const artistData = artist as { status: string; studio_name: string };
    if (artistData.status === "closed") {
        return { success: false, error: `${artistData.studio_name} is not accepting commissions right now.` };
    }

    const { data: commission, error } = await supabase
        .from("commissions")
        .insert({
            artist_id: data.artistId,
            client_id: user.id,
            commission_type: data.commissionType,
            description: data.description,
            reference_images: data.referenceImages || [],
            price_quoted: data.budget || null,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

    const commissionId = (commission as { id: string }).id;

    // Auto-create initial update
    await supabase.from("commission_updates").insert({
        commission_id: commissionId,
        author_id: user.id,
        update_type: "message",
        title: "Commission Requested",
        body: data.description,
    });

    // Notify artist
    await supabase.from("notifications").insert({
        user_id: data.artistId,
        type: "general",
        actor_id: user.id,
        content: `New commission request: ${data.commissionType}`,
    });

    revalidatePath("/studio/dashboard");
    revalidatePath("/studio/my-commissions");
    return { success: true, commissionId };
}

/** Artist advances commission through workflow */
export async function updateCommissionStatus(
    commissionId: string,
    newStatus: string,
    note?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Fetch current commission
    const { data: commission } = await supabase
        .from("commissions")
        .select("id, artist_id, client_id, status, commission_type, horse_id")
        .eq("id", commissionId)
        .single();

    if (!commission) return { success: false, error: "Commission not found." };
    const c = commission as { id: string; artist_id: string; client_id: string | null; status: string; commission_type: string; horse_id: string | null };

    // Only artist can change status (except revision_request from client handled separately)
    if (c.artist_id !== user.id) {
        return { success: false, error: "Only the artist can update commission status." };
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[c.status];
    if (!allowed || !allowed.includes(newStatus)) {
        return { success: false, error: `Cannot transition from "${c.status}" to "${newStatus}".` };
    }

    // Update commission
    const updates: Record<string, unknown> = {
        status: newStatus,
        last_update_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    if (newStatus === "in_progress" && !c.status.includes("revision")) {
        updates.actual_start = new Date().toISOString().split("T")[0];
    }
    if (newStatus === "completed") {
        updates.actual_completion = new Date().toISOString().split("T")[0];
    }

    const { error } = await supabase
        .from("commissions")
        .update(updates)
        .eq("id", commissionId);

    if (error) return { success: false, error: error.message };

    // Log the status change
    await supabase.from("commission_updates").insert({
        commission_id: commissionId,
        author_id: user.id,
        update_type: "status_change",
        title: `Status: ${STATUS_LABELS[newStatus] || newStatus}`,
        body: note || null,
        old_status: c.status,
        new_status: newStatus,
    });

    // ── Hoofprint Pipeline: inject WIP photos on delivery ──
    if (newStatus === "delivered" && c.horse_id) {
        try {
            // Get all visible WIP photo updates
            const { data: wipUpdates } = await supabase
                .from("commission_updates")
                .select("title, body, image_urls, created_at")
                .eq("commission_id", commissionId)
                .eq("update_type", "wip_photo")
                .eq("is_visible_to_client", true)
                .order("created_at", { ascending: true });

            if (wipUpdates && wipUpdates.length > 0) {
                // Fetch artist alias for timeline entries
                const { data: artistUser } = await supabase
                    .from("users")
                    .select("alias_name")
                    .eq("id", c.artist_id)
                    .single();
                const artistAlias = (artistUser as { alias_name: string } | null)?.alias_name || "Artist";

                // Insert each WIP as a timeline event
                const timelineEntries = (wipUpdates as { title: string | null; body: string | null; image_urls: string[]; created_at: string }[]).map((wip, i) => ({
                    horse_id: c.horse_id,
                    user_id: c.artist_id,
                    event_type: "customization",
                    title: wip.title || `${c.commission_type} — WIP ${i + 1}`,
                    description: wip.body || `Work-in-progress by @${artistAlias}`,
                    event_date: wip.created_at.split("T")[0],
                    metadata: {
                        artist: artistAlias,
                        commissionType: c.commission_type,
                        commissionId,
                        imageUrls: wip.image_urls || [],
                    },
                    is_public: true,
                }));

                await supabase.from("horse_timeline").insert(timelineEntries);
            }
        } catch {
            // Non-blocking: Hoofprint injection is best-effort
        }
    }

    // Notify client
    if (c.client_id && c.client_id !== user.id) {
        await supabase.from("notifications").insert({
            user_id: c.client_id,
            type: "general",
            actor_id: user.id,
            content: `Your ${c.commission_type} commission is now ${STATUS_LABELS[newStatus] || newStatus}.`,
        });
    }

    revalidatePath("/studio/dashboard");
    revalidatePath(`/studio/commission/${commissionId}`);
    revalidatePath("/studio/my-commissions");
    return { success: true };
}

/** Add WIP photo, message, or milestone to a commission */
export async function addCommissionUpdate(
    commissionId: string,
    data: {
        updateType: "wip_photo" | "message" | "milestone" | "revision_request" | "approval";
        title?: string;
        body?: string;
        imageUrls?: string[];
        isVisibleToClient?: boolean;
        requiresPayment?: boolean;
    }
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify participation
    const { data: commission } = await supabase
        .from("commissions")
        .select("id, artist_id, client_id")
        .eq("id", commissionId)
        .single();

    if (!commission) return { success: false, error: "Commission not found." };
    const c = commission as { id: string; artist_id: string; client_id: string | null };

    if (c.artist_id !== user.id && c.client_id !== user.id) {
        return { success: false, error: "You are not a participant in this commission." };
    }

    const { error } = await supabase.from("commission_updates").insert({
        commission_id: commissionId,
        author_id: user.id,
        update_type: data.updateType,
        title: data.title || null,
        body: data.body || null,
        image_urls: data.imageUrls || [],
        is_visible_to_client: data.isVisibleToClient ?? true,
        requires_payment: data.requiresPayment ?? false,
    });

    if (error) return { success: false, error: error.message };

    // Update last_update_at on the commission
    await supabase
        .from("commissions")
        .update({ last_update_at: new Date().toISOString() })
        .eq("id", commissionId);

    // Notify the other party
    const recipientId = c.artist_id === user.id ? c.client_id : c.artist_id;
    if (recipientId) {
        const typeLabels: Record<string, string> = {
            wip_photo: "posted a WIP photo",
            message: "sent a message",
            milestone: "marked a milestone",
            revision_request: "requested a revision",
            approval: "approved the work",
        };
        await supabase.from("notifications").insert({
            user_id: recipientId,
            type: "general",
            actor_id: user.id,
            content: `Commission update: ${typeLabels[data.updateType] || data.updateType}`,
        });
    }

    revalidatePath(`/studio/commission/${commissionId}`);
    revalidatePath("/studio/dashboard");
    return { success: true };
}

/** Get all updates for a commission */
export async function getCommissionUpdates(commissionId: string): Promise<CommissionUpdate[]> {
    const supabase = await createClient();

    const { data: rawUpdates } = await supabase
        .from("commission_updates")
        .select("*")
        .eq("commission_id", commissionId)
        .order("created_at", { ascending: true });

    if (!rawUpdates || rawUpdates.length === 0) return [];

    const authorIds = [...new Set((rawUpdates as { author_id: string }[]).map(u => u.author_id))];
    const aliasMap = await batchFetchAliases(supabase, authorIds);

    return (rawUpdates as Record<string, unknown>[]).map(u => ({
        id: u.id as string,
        commissionId: u.commission_id as string,
        authorId: u.author_id as string,
        authorAlias: aliasMap.get(u.author_id as string) || "Unknown",
        updateType: u.update_type as string,
        title: u.title as string | null,
        body: u.body as string | null,
        imageUrls: (u.image_urls as string[]) || [],
        oldStatus: u.old_status as string | null,
        newStatus: u.new_status as string | null,
        requiresPayment: u.requires_payment as boolean,
        isVisibleToClient: u.is_visible_to_client as boolean,
        createdAt: u.created_at as string,
    }));
}

/** Get a single commission by ID */
export async function getCommission(commissionId: string): Promise<Commission | null> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("commissions")
        .select("*")
        .eq("id", commissionId)
        .maybeSingle();

    if (!data) return null;

    const c = data as Record<string, unknown>;
    const userIds = [c.artist_id as string];
    if (c.client_id) userIds.push(c.client_id as string);
    const aliasMap = await batchFetchAliases(supabase, userIds);

    return mapCommission(c, aliasMap);
}

/** Browse all artists (for discovery) */
export async function browseArtists(statusFilter?: string): Promise<ArtistProfile[]> {
    const supabase = await createClient();

    let query = supabase
        .from("artist_profiles")
        .select("*")
        .eq("portfolio_visible", true)
        .order("updated_at", { ascending: false })
        .limit(50);

    if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    if (!data || data.length === 0) return [];

    const userIds = (data as { user_id: string }[]).map(p => p.user_id);
    const aliasMap = await batchFetchAliases(supabase, userIds);

    return (data as Record<string, unknown>[]).map(p => ({
        userId: p.user_id as string,
        studioName: p.studio_name as string,
        studioSlug: p.studio_slug as string,
        specialties: (p.specialties as string[]) || [],
        mediums: (p.mediums as string[]) || [],
        scalesOffered: (p.scales_offered as string[]) || [],
        bioArtist: p.bio_artist as string | null,
        portfolioVisible: p.portfolio_visible as boolean,
        status: p.status as string,
        maxSlots: (p.max_slots as number) || 5,
        turnaroundMinDays: p.turnaround_min_days as number | null,
        turnaroundMaxDays: p.turnaround_max_days as number | null,
        priceRangeMin: p.price_range_min as number | null,
        priceRangeMax: p.price_range_max as number | null,
        termsText: p.terms_text as string | null,
        paypalMeLink: p.paypal_me_link as string | null,
        acceptingTypes: (p.accepting_types as string[]) || [],
        ownerAlias: aliasMap.get(p.user_id as string) || "Unknown",
    }));
}

// ============================================================
// HELPERS
// ============================================================

function parseArrayField(formData: FormData, field: string): string[] {
    const raw = formData.get(field) as string | null;
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        // Handle comma-separated
        return raw.split(",").map(s => s.trim()).filter(Boolean);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchFetchAliases(supabase: any, userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return map;

    const { data: users } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", unique);

    if (users) {
        for (const u of users as { id: string; alias_name: string }[]) {
            map.set(u.id, u.alias_name);
        }
    }
    return map;
}

function mapCommission(c: Record<string, unknown>, aliasMap: Map<string, string>): Commission {
    return {
        id: c.id as string,
        artistId: c.artist_id as string,
        clientId: c.client_id as string | null,
        clientEmail: c.client_email as string | null,
        horseId: c.horse_id as string | null,
        commissionType: c.commission_type as string,
        description: c.description as string,
        referenceImages: (c.reference_images as string[]) || [],
        slotNumber: c.slot_number as number | null,
        estimatedStart: c.estimated_start as string | null,
        estimatedCompletion: c.estimated_completion as string | null,
        actualStart: c.actual_start as string | null,
        actualCompletion: c.actual_completion as string | null,
        priceQuoted: c.price_quoted as number | null,
        depositAmount: c.deposit_amount as number | null,
        depositPaid: c.deposit_paid as boolean,
        finalPaid: c.final_paid as boolean,
        status: c.status as string,
        statusLabel: STATUS_LABELS[c.status as string] || (c.status as string),
        isPublicInQueue: c.is_public_in_queue as boolean,
        lastUpdateAt: c.last_update_at as string,
        createdAt: c.created_at as string,
        clientAlias: c.client_id ? (aliasMap.get(c.client_id as string) || null) : null,
        artistAlias: aliasMap.get(c.artist_id as string) || "Unknown",
    };
}
