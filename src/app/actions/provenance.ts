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
    // NEW: Beta feedback fields
    showLocation?: string;
    sectionName?: string;
    awardCategory?: string;
    competitionLevel?: string;
    showDateText?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (!data.showName.trim()) return { success: false, error: "Show name is required." };

    // Fuzzy date fallback — extract a year for sorting if exact date is missing
    let resolvedShowDate = data.showDate || null;
    if (!resolvedShowDate && data.showDateText) {
        const yearMatch = data.showDateText.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            resolvedShowDate = `${yearMatch[0]}-01-01`;
        }
    }

    const { error } = await supabase.from("show_records").insert({
        horse_id: data.horseId,
        user_id: user.id,
        show_name: data.showName.trim(),
        show_date: resolvedShowDate,
        division: data.division?.trim() || null,
        placing: data.placing?.trim() || null,
        ribbon_color: data.ribbonColor || null,
        judge_name: data.judgeName?.trim() || null,
        is_nan: data.isNan ?? false,
        notes: data.notes?.trim() || null,
        show_location: data.showLocation?.trim() || null,
        section_name: data.sectionName?.trim() || null,
        award_category: data.awardCategory?.trim() || null,
        competition_level: data.competitionLevel?.trim() || null,
        show_date_text: data.showDateText?.trim() || null,
    });

    if (error) return { success: false, error: error.message };

    // Activity event
    await createActivityEvent({
        actorId: user.id,
        eventType: "show_record",
        horseId: data.horseId,
        metadata: { showName: data.showName, placing: data.placing || null },
    });

    // ⚡ REMOVED: addTimelineEvent call — show results are now derived
    // automatically by v_horse_hoofprint from the show_records table.

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
        // NEW: Beta feedback fields
        showLocation?: string;
        sectionName?: string;
        awardCategory?: string;
        competitionLevel?: string;
        showDateText?: string;
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
    if (data.showLocation !== undefined) updateData.show_location = data.showLocation.trim() || null;
    if (data.sectionName !== undefined) updateData.section_name = data.sectionName.trim() || null;
    if (data.awardCategory !== undefined) updateData.award_category = data.awardCategory.trim() || null;
    if (data.competitionLevel !== undefined) updateData.competition_level = data.competitionLevel.trim() || null;
    if (data.showDateText !== undefined) updateData.show_date_text = data.showDateText.trim() || null;

    // Fuzzy date fallback for updates
    if (data.showDateText !== undefined && !data.showDate) {
        const yearMatch = data.showDateText.match(/\b(19|20)\d{2}\b/);
        if (yearMatch && !updateData.show_date) {
            updateData.show_date = `${yearMatch[0]}-01-01`;
        }
    }

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
