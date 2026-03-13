"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { randomInt } from "crypto";

// ============================================================
// HOOFPRINT™ — Living Model Horse Provenance Actions
// ============================================================

// ── Types ──

export interface TimelineEvent {
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    eventDate: string | null;
    metadata: Record<string, unknown>;
    isPublic: boolean;
    createdAt: string;
    userAlias: string;
    userId: string;
    sourceTable?: string;
}

export interface OwnershipRecord {
    id: string;
    ownerAlias: string;
    ownerId: string | null;
    acquiredAt: string;
    releasedAt: string | null;
    acquisitionType: string;
    salePrice: number | null;
    isPricePublic: boolean;
    notes: string | null;
}

// ── Get Timeline (reads from v_horse_hoofprint view) ──

export async function getHoofprint(horseId: string): Promise<{
    timeline: TimelineEvent[];
    ownershipChain: OwnershipRecord[];
    lifeStage: string;
}> {
    const supabase = await createClient();

    // Single query → the view does all the UNION ALL work
    const { data: rawTimeline } = await supabase
        .from("v_horse_hoofprint")
        .select("source_id, horse_id, user_id, event_type, title, description, event_date, metadata, is_public, created_at, source_table")
        .eq("horse_id", horseId)
        .order("event_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    // Fetch user aliases for all unique user IDs in the results
    const userIds = [...new Set((rawTimeline ?? []).map((e: { user_id: string }) => e.user_id).filter(Boolean))];
    let aliasMap = new Map<string, string>();
    if (userIds.length > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", userIds);
        (users ?? []).forEach((u: { id: string; alias_name: string }) => aliasMap.set(u.id, u.alias_name));
    }

    const timeline: TimelineEvent[] = (rawTimeline ?? []).map((e: {
        source_id: string; event_type: string; title: string; description: string | null;
        event_date: string | null; metadata: Record<string, unknown>; is_public: boolean;
        created_at: string; user_id: string; source_table: string;
    }) => ({
        id: e.source_id,
        eventType: e.event_type,
        title: e.title,
        description: e.description,
        eventDate: e.event_date,
        metadata: e.metadata || {},
        isPublic: e.is_public,
        createdAt: e.created_at,
        userAlias: aliasMap.get(e.user_id) || "Unknown",
        userId: e.user_id,
        sourceTable: e.source_table,
    }));

    // Fetch ownership chain (direct table query — unchanged)
    const { data: rawOwnership } = await supabase
        .from("horse_ownership_history")
        .select("id, owner_alias, owner_id, acquired_at, released_at, acquisition_type, sale_price, is_price_public, notes")
        .eq("horse_id", horseId)
        .order("acquired_at", { ascending: true });

    const ownershipChain: OwnershipRecord[] = (rawOwnership ?? []).map((o: {
        id: string; owner_alias: string; owner_id: string | null; acquired_at: string;
        released_at: string | null; acquisition_type: string; sale_price: number | null;
        is_price_public: boolean; notes: string | null;
    }) => ({
        id: o.id,
        ownerAlias: o.owner_alias,
        ownerId: o.owner_id,
        acquiredAt: o.acquired_at,
        releasedAt: o.released_at,
        acquisitionType: o.acquisition_type,
        salePrice: o.is_price_public ? o.sale_price : null,
        isPricePublic: o.is_price_public,
        notes: o.notes,
    }));

    // Fetch life stage
    const { data: horse } = await supabase
        .from("user_horses")
        .select("life_stage")
        .eq("id", horseId)
        .single();

    return {
        timeline,
        ownershipChain,
        lifeStage: (horse as { life_stage: string } | null)?.life_stage || "completed",
    };
}

// ── Add Timeline Event → creates a Post (user notes only) ──
// System events (condition changes, transfers, etc.) are now
// derived automatically from the v_horse_hoofprint view.

export async function addTimelineEvent(data: {
    horseId: string;
    eventType: string;
    title: string;
    description?: string;
    eventDate?: string;
    metadata?: Record<string, unknown>;
    isPublic?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Build post content from title + description
    const content = data.description
        ? data.title + "\n\n" + data.description
        : data.title;

    const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        horse_id: data.horseId,
        content,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/${data.horseId}`);
    revalidatePath(`/community/${data.horseId}`);
    return { success: true };
}

// ── Delete Timeline Event ──
// Only user notes (source_table = 'posts') can be deleted.
// System events are immutable — derived from reality.

export async function deleteTimelineEvent(eventId: string, horseId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Delete the post (RLS ensures only author or horse owner can delete)
    const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", eventId)
        .eq("author_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}

// ── Update Life Stage ──
// No longer writes to horse_timeline — condition_history trigger
// and v_horse_hoofprint view handle the timeline automatically.

export async function updateLifeStage(
    horseId: string,
    newStage: "blank" | "stripped" | "in_progress" | "completed" | "for_sale"
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Get current stage
    const { data: horse } = await supabase
        .from("user_horses")
        .select("life_stage")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();

    if (!horse) return { success: false, error: "Horse not found." };
    const current = (horse as { life_stage: string }).life_stage;
    if (current === newStage) return { success: true };

    // Update the horse — that's it! No timeline insert needed.
    const { error } = await supabase
        .from("user_horses")
        .update({ life_stage: newStage })
        .eq("id", horseId)
        .eq("owner_id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}

// ── Initialize Hoofprint (called when adding a horse) ──
// No longer writes to horse_timeline — the v_horse_hoofprint view
// derives the "Added to stable" event from the user_horses row itself.

export async function initializeHoofprint(data: {
    horseId: string;
    horseName: string;
    lifeStage?: string;
    acquisitionNotes?: string;
}): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user alias
    const { data: profile } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", user.id)
        .single();
    const alias = (profile as { alias_name: string } | null)?.alias_name || "Unknown";

    // Create initial ownership record (the only real insert needed)
    await supabase.from("horse_ownership_history").insert({
        horse_id: data.horseId,
        owner_id: user.id,
        owner_alias: alias,
        acquisition_type: "original",
        notes: data.acquisitionNotes || null,
    });

    // ⚡ REMOVED: horse_timeline INSERT — now derived from v_horse_hoofprint view
}

// ============================================================
// TRANSFER SYSTEM
// ============================================================

import { getAdminClient } from "@/lib/supabase/admin";

function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[randomInt(chars.length)];
    }
    return code;
}

/** Generate a transfer code for a horse. */
export async function generateTransferCode(data: {
    horseId: string;
    acquisitionType: "purchase" | "trade" | "gift" | "transfer";
    salePrice?: number;
    isPricePublic?: boolean;
    notes?: string;
}): Promise<{ success: boolean; code?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, owner_id")
        .eq("id", data.horseId)
        .single();
    if (!horse || (horse as { owner_id: string }).owner_id !== user.id) {
        return { success: false, error: "You don't own this horse." };
    }

    // Cancel any existing pending transfers for this horse
    await supabase
        .from("horse_transfers")
        .update({ status: "cancelled" })
        .eq("horse_id", data.horseId)
        .eq("sender_id", user.id)
        .eq("status", "pending");

    const code = generateCode();
    const { error } = await supabase.from("horse_transfers").insert({
        horse_id: data.horseId,
        sender_id: user.id,
        transfer_code: code,
        acquisition_type: data.acquisitionType,
        sale_price: data.salePrice ?? null,
        is_price_public: data.isPricePublic ?? false,
        notes: data.notes ?? null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, code };
}

/** Claim a horse using a transfer code. */
export async function claimTransfer(transferCode: string): Promise<{
    success: boolean;
    horseName?: string;
    horseId?: string;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Rate limit: 5 attempts per 15 minutes per IP
    const allowed = await checkRateLimit("claim_transfer", 5, 15);
    if (!allowed) {
        return { success: false, error: "Too many attempts. Please wait 15 minutes before trying again." };
    }

    // Single atomic RPC — handles locking, validation, ownership swap, vault clearing
    const admin = getAdminClient();
    const { data, error } = await admin.rpc("claim_transfer_atomic", {
        p_code: transferCode,
        p_claimant_id: user.id,
    });

    if (error) {
        return { success: false, error: error.message };
    }

    const result = data as {
        success: boolean;
        error?: string;
        horse_id?: string;
        horse_name?: string;
        sender_id?: string;
        sender_alias?: string;
        receiver_alias?: string;
        sale_price?: number;
    };

    if (!result.success) {
        return { success: false, error: result.error || "Transfer failed." };
    }

    // Create a completed transaction for this transfer (enables reviews)
    try {
        const { createTransaction } = await import("@/app/actions/transactions");
        await createTransaction({
            type: "transfer",
            partyAId: result.sender_id!,
            partyBId: user.id,
            horseId: result.horse_id,
            status: "completed",
            metadata: {
                transfer_code: transferCode,
                sale_price: result.sale_price || null,
            },
        });
    } catch { /* Non-blocking */ }

    // Background: Send notifications (non-critical — OK to fail)
    try {
        await admin.from("notifications").insert({
            user_id: result.sender_id,
            type: "transfer_claimed",
            actor_id: user.id,
            content: `@${result.receiver_alias} claimed ${result.horse_name}!`,
            horse_id: result.horse_id,
        });
    } catch { /* Non-blocking */ }

    revalidatePath("/dashboard");
    revalidatePath(`/stable/${result.horse_id}`);
    revalidatePath(`/community/${result.horse_id}`);

    return {
        success: true,
        horseName: result.horse_name,
        horseId: result.horse_id,
    };
}

/** Cancel a pending transfer. */
export async function cancelTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("horse_transfers")
        .update({ status: "cancelled" })
        .eq("id", transferId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Get pending outgoing transfers for the current user. */
export async function getMyPendingTransfers(): Promise<{
    id: string;
    horseId: string;
    horseName: string;
    transferCode: string;
    expiresAt: string;
    acquisitionType: string;
}[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from("horse_transfers")
        .select("id, horse_id, transfer_code, expires_at, acquisition_type")
        .eq("sender_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (!data || data.length === 0) return [];

    // Get horse names
    const horseIds = data.map((t: { horse_id: string }) => t.horse_id);
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .in("id", horseIds);

    const nameMap = new Map<string, string>();
    (horses ?? []).forEach((h: { id: string; custom_name: string }) => nameMap.set(h.id, h.custom_name));

    return data.map((t: { id: string; horse_id: string; transfer_code: string; expires_at: string; acquisition_type: string }) => ({
        id: t.id,
        horseId: t.horse_id,
        horseName: nameMap.get(t.horse_id) || "Unknown Horse",
        transferCode: t.transfer_code,
        expiresAt: t.expires_at,
        acquisitionType: t.acquisition_type,
    }));
}

/** Get horses the current user has transferred away (ghost remnants) */
export async function getTransferHistory(): Promise<{
    id: string;
    horseId: string;
    horseName: string | null;
    horseThumbnail: string | null;
    salePrice: number | null;
    isPricePublic: boolean;
    acquisitionType: string;
    releasedAt: string;
}[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: records } = await supabase
        .from("horse_ownership_history")
        .select("id, horse_id, horse_name, horse_thumbnail, sale_price, is_price_public, acquisition_type, released_at")
        .eq("owner_id", user.id)
        .not("released_at", "is", null)
        .order("released_at", { ascending: false });

    if (!records) return [];

    return (records as { id: string; horse_id: string; horse_name: string | null; horse_thumbnail: string | null; sale_price: number | null; is_price_public: boolean; acquisition_type: string; released_at: string }[]).map(r => ({
        id: r.id,
        horseId: r.horse_id,
        horseName: r.horse_name,
        horseThumbnail: r.horse_thumbnail,
        salePrice: r.sale_price,
        isPricePublic: r.is_price_public,
        acquisitionType: r.acquisition_type,
        releasedAt: r.released_at,
    }));
}
