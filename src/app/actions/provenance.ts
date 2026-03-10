"use server";

import { createClient } from "@/lib/supabase/server";
import { createActivityEvent } from "@/app/actions/activity";

// ============================================================
// SHOW RECORDS
// ============================================================

/**
 * Add a show record to a horse.
 * Owner-only — RLS enforces horse ownership.
 */
export async function addShowRecord(data: {
    horseId: string;
    showName: string;
    showDate?: string;
    division?: string;
    placing?: string;
    ribbonColor?: string;
    judgeName?: string;
    isNan?: boolean;
    notes?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (!data.showName.trim()) return { success: false, error: "Show name is required." };

    const { error } = await supabase.from("show_records").insert({
        horse_id: data.horseId,
        user_id: user.id,
        show_name: data.showName.trim(),
        show_date: data.showDate || null,
        division: data.division?.trim() || null,
        placing: data.placing?.trim() || null,
        ribbon_color: data.ribbonColor || null,
        judge_name: data.judgeName?.trim() || null,
        is_nan: data.isNan ?? false,
        notes: data.notes?.trim() || null,
    });

    if (error) return { success: false, error: error.message };

    // Activity event
    await createActivityEvent({
        actorId: user.id,
        eventType: "show_record",
        horseId: data.horseId,
        metadata: { showName: data.showName, placing: data.placing || null },
    });

    // Hoofprint timeline event
    try {
        const { addTimelineEvent } = await import("@/app/actions/hoofprint");
        await addTimelineEvent({
            horseId: data.horseId,
            eventType: "show_result",
            title: `${data.showName}${data.placing ? ` — ${data.placing}` : ""}`,
            description: [data.division, data.ribbonColor ? `${data.ribbonColor} ribbon` : null, data.judgeName ? `Judge: ${data.judgeName}` : null]
                .filter(Boolean).join(" · ") || undefined,
            eventDate: data.showDate,
        });
    } catch { /* non-blocking */ }

    return { success: true };
}

/**
 * Update an existing show record.
 */
export async function updateShowRecord(
    recordId: string,
    data: {
        showName?: string;
        showDate?: string;
        division?: string;
        placing?: string;
        ribbonColor?: string;
        judgeName?: string;
        isNan?: boolean;
        notes?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    const updateData: Record<string, unknown> = {};
    if (data.showName !== undefined) updateData.show_name = data.showName.trim();
    if (data.showDate !== undefined) updateData.show_date = data.showDate || null;
    if (data.division !== undefined) updateData.division = data.division.trim() || null;
    if (data.placing !== undefined) updateData.placing = data.placing.trim() || null;
    if (data.ribbonColor !== undefined) updateData.ribbon_color = data.ribbonColor || null;
    if (data.judgeName !== undefined) updateData.judge_name = data.judgeName.trim() || null;
    if (data.isNan !== undefined) updateData.is_nan = data.isNan;
    if (data.notes !== undefined) updateData.notes = data.notes.trim() || null;

    const { error } = await supabase
        .from("show_records")
        .update(updateData)
        .eq("id", recordId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Delete a show record. RLS enforces owner-only.
 */
export async function deleteShowRecord(
    recordId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    const { error } = await supabase
        .from("show_records")
        .delete()
        .eq("id", recordId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ============================================================
// PEDIGREE
// ============================================================

/**
 * Upsert a pedigree card — creates if none exists, updates if one does.
 */
export async function savePedigree(data: {
    horseId: string;
    sireName?: string;
    damName?: string;
    sculptor?: string;
    castNumber?: string;
    editionSize?: string;
    lineageNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    // Check if pedigree exists
    const { data: existing } = await supabase
        .from("horse_pedigrees")
        .select("id")
        .eq("horse_id", data.horseId)
        .maybeSingle();

    const pedigreeData = {
        sire_name: data.sireName?.trim() || null,
        dam_name: data.damName?.trim() || null,
        sculptor: data.sculptor?.trim() || null,
        cast_number: data.castNumber?.trim() || null,
        edition_size: data.editionSize?.trim() || null,
        lineage_notes: data.lineageNotes?.trim() || null,
    };

    if (existing) {
        const { error } = await supabase
            .from("horse_pedigrees")
            .update({ ...pedigreeData, updated_at: new Date().toISOString() })
            .eq("id", existing.id);

        if (error) return { success: false, error: error.message };
    } else {
        const { error } = await supabase
            .from("horse_pedigrees")
            .insert({
                horse_id: data.horseId,
                user_id: user.id,
                ...pedigreeData,
            });

        if (error) return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Delete a pedigree card.
 */
export async function deletePedigree(
    horseId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    const { error } = await supabase
        .from("horse_pedigrees")
        .delete()
        .eq("horse_id", horseId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
