"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

// ── Get Timeline ──

export async function getHoofprint(horseId: string): Promise<{
    timeline: TimelineEvent[];
    ownershipChain: OwnershipRecord[];
    lifeStage: string;
}> {
    const supabase = await createClient();

    // Fetch timeline events
    const { data: rawTimeline } = await supabase
        .from("horse_timeline")
        .select("id, event_type, title, description, event_date, metadata, is_public, created_at, user_id")
        .eq("horse_id", horseId)
        .order("event_date", { ascending: false, nullsFirst: false });

    const events = (rawTimeline ?? []) as {
        id: string; event_type: string; title: string; description: string | null;
        event_date: string | null; metadata: Record<string, unknown>; is_public: boolean;
        created_at: string; user_id: string;
    }[];

    // Batch fetch user aliases
    const userIds = [...new Set(events.map(e => e.user_id))];
    const aliasMap = new Map<string, string>();
    if (userIds.length > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", userIds);
        (users ?? []).forEach((u: { id: string; alias_name: string }) => {
            aliasMap.set(u.id, u.alias_name);
        });
    }

    const timeline: TimelineEvent[] = events.map(e => ({
        id: e.id,
        eventType: e.event_type,
        title: e.title,
        description: e.description,
        eventDate: e.event_date,
        metadata: e.metadata || {},
        isPublic: e.is_public,
        createdAt: e.created_at,
        userAlias: aliasMap.get(e.user_id) || "Unknown",
        userId: e.user_id,
    }));

    // Fetch ownership chain
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

// ── Add Timeline Event ──

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

    const { error } = await supabase.from("horse_timeline").insert({
        horse_id: data.horseId,
        user_id: user.id,
        event_type: data.eventType,
        title: data.title,
        description: data.description || null,
        event_date: data.eventDate || new Date().toISOString().split("T")[0],
        metadata: data.metadata || {},
        is_public: data.isPublic ?? true,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/${data.horseId}`);
    revalidatePath(`/community/${data.horseId}`);
    return { success: true };
}

// ── Delete Timeline Event ──

export async function deleteTimelineEvent(eventId: string, horseId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("horse_timeline")
        .delete()
        .eq("id", eventId);

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}

// ── Update Life Stage ──

export async function updateLifeStage(
    horseId: string,
    newStage: "blank" | "in_progress" | "completed" | "for_sale"
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Get current stage for timeline entry
    const { data: horse } = await supabase
        .from("user_horses")
        .select("life_stage, custom_name")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();

    if (!horse) return { success: false, error: "Horse not found." };
    const current = (horse as { life_stage: string }).life_stage;
    const horseName = (horse as { custom_name: string }).custom_name;

    if (current === newStage) return { success: true };

    // Update the horse
    const { error } = await supabase
        .from("user_horses")
        .update({ life_stage: newStage })
        .eq("id", horseId)
        .eq("owner_id", user.id);

    if (error) return { success: false, error: error.message };

    // Create timeline event
    const stageLabels: Record<string, string> = {
        blank: "Blank / Unpainted",
        in_progress: "Work in Progress",
        completed: "Completed",
        for_sale: "Listed for Sale",
    };

    await supabase.from("horse_timeline").insert({
        horse_id: horseId,
        user_id: user.id,
        event_type: "stage_update",
        title: `Stage: ${stageLabels[newStage] || newStage}`,
        description: `${horseName} moved from ${stageLabels[current] || current} to ${stageLabels[newStage] || newStage}.`,
        metadata: { from_stage: current, to_stage: newStage },
    });

    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}

// ── Initialize Hoofprint (called when adding a horse) ──

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

    // Create initial ownership record
    await supabase.from("horse_ownership_history").insert({
        horse_id: data.horseId,
        owner_id: user.id,
        owner_alias: alias,
        acquisition_type: "original",
        notes: data.acquisitionNotes || null,
    });

    // Create initial timeline event
    await supabase.from("horse_timeline").insert({
        horse_id: data.horseId,
        user_id: user.id,
        event_type: "acquired",
        title: `Added to ${alias}'s stable`,
        description: `${data.horseName} was registered on Model Horse Hub.`,
        metadata: { life_stage: data.lifeStage || "completed" },
    });
}

// ============================================================
// TRANSFER SYSTEM
// ============================================================

import { getAdminClient } from "@/lib/supabase/admin";

function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
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

    // Look up transfer
    const { data: transfer } = await supabase
        .from("horse_transfers")
        .select("id, horse_id, sender_id, acquisition_type, sale_price, is_price_public, notes, expires_at")
        .eq("transfer_code", transferCode.toUpperCase().trim())
        .eq("status", "pending")
        .single();

    if (!transfer) {
        return { success: false, error: "Invalid or expired transfer code." };
    }

    const t = transfer as {
        id: string; horse_id: string; sender_id: string;
        acquisition_type: string; sale_price: number | null;
        is_price_public: boolean; notes: string | null; expires_at: string;
    };

    // Check expiration
    if (new Date(t.expires_at) < new Date()) {
        await supabase.from("horse_transfers").update({ status: "expired" }).eq("id", t.id);
        return { success: false, error: "This transfer code has expired." };
    }

    // Can't claim your own horse
    if (t.sender_id === user.id) {
        return { success: false, error: "You can't claim your own horse." };
    }

    // Use service role for cross-user operations
    const admin = getAdminClient();

    // Get horse name and sender alias
    const { data: horse } = await admin.from("user_horses").select("custom_name").eq("id", t.horse_id).single();
    const horseName = (horse as { custom_name: string } | null)?.custom_name || "Unknown Horse";

    const { data: senderProfile } = await admin.from("users").select("alias_name").eq("id", t.sender_id).single();
    const senderAlias = (senderProfile as { alias_name: string } | null)?.alias_name || "Unknown";

    const { data: receiverProfile } = await admin.from("users").select("alias_name").eq("id", user.id).single();
    const receiverAlias = (receiverProfile as { alias_name: string } | null)?.alias_name || "Unknown";

    // 1. Close sender's ownership record
    await admin.from("horse_ownership_history")
        .update({ released_at: new Date().toISOString() })
        .eq("horse_id", t.horse_id)
        .eq("owner_id", t.sender_id)
        .is("released_at", null);

    // 2. Create receiver's ownership record
    await admin.from("horse_ownership_history").insert({
        horse_id: t.horse_id,
        owner_id: user.id,
        owner_alias: receiverAlias,
        acquisition_type: t.acquisition_type,
        sale_price: t.sale_price,
        is_price_public: t.is_price_public,
        notes: t.notes,
    });

    // 3. Transfer ownership
    await admin.from("user_horses")
        .update({ owner_id: user.id, collection_id: null })
        .eq("id", t.horse_id);

    // 4. Create timeline events
    await admin.from("horse_timeline").insert([
        {
            horse_id: t.horse_id,
            user_id: t.sender_id,
            event_type: "transferred",
            title: `Transferred to @${receiverAlias}`,
            description: `${horseName} was transferred from @${senderAlias} to @${receiverAlias} via ${t.acquisition_type}.`,
            metadata: { from: senderAlias, to: receiverAlias, type: t.acquisition_type },
        },
        {
            horse_id: t.horse_id,
            user_id: user.id,
            event_type: "acquired",
            title: `Received from @${senderAlias}`,
            description: `${horseName} was acquired from @${senderAlias} via ${t.acquisition_type}.`,
            metadata: { from: senderAlias, to: receiverAlias, type: t.acquisition_type },
        },
    ]);

    // 5. Mark transfer as claimed
    await admin.from("horse_transfers").update({
        status: "claimed",
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
    }).eq("id", t.id);

    // 6. Notify sender
    await admin.from("notifications").insert({
        user_id: t.sender_id,
        type: "general",
        actor_id: user.id,
        content: `@${receiverAlias} claimed ${horseName}! Transfer complete.`,
        horse_id: null,
    });

    revalidatePath("/dashboard");
    revalidatePath(`/stable/${t.horse_id}`);
    revalidatePath(`/community/${t.horse_id}`);

    return { success: true, horseName, horseId: t.horse_id };
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
