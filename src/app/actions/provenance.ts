"use server";

import { createClient } from "@/lib/supabase/server";
import { safeHttpUrl } from "@/lib/papers/validate";
import { validateQualifier, type QualifierValue } from "@/lib/records/qualifiers";

/** Said when a card was entered but migration 210 isn't applied yet. */
const QUALIFIER_NOT_KEPT =
    "Saved — but card tracking isn't switched on yet, so the card wasn't kept. Edit the record to add it once it is.";

function isMissingColumn(error: { code?: string } | null): boolean {
    return error?.code === "42703" || error?.code === "PGRST204";
}

/** The 210 columns. */
function qualifierColumns(q: QualifierValue | null): Record<string, unknown> {
    return q
        ? {
              qualifier_program: q.program,
              qualifier_card: q.card,
              qualifier_year: q.year,
              qualifier_card_id: q.cardId,
          }
        : { qualifier_program: null, qualifier_card: null, qualifier_year: null, qualifier_card_id: null };
}

/** The 030 NAN columns, kept in step so the legacy readers (NAN
 *  export, studio counts) see the same card. */
function nanMirror(q: QualifierValue | null): Record<string, unknown> {
    return q?.program === "nan"
        ? { is_nan_qualifying: true, nan_card_type: q.card, nan_year: q.year }
        : { is_nan_qualifying: false, nan_card_type: null, nan_year: null };
}
import { createActivityEvent } from "@/app/actions/activity";
import { FEMALE_GENDERS, MALE_GENDERS } from "@/lib/config/genders";

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
    showDate?: string | null;
    division?: string | null;
    className?: string | null;
    placing?: string | null;
    ribbonColor?: string | null;
    judgeName?: string | null;
    isNan?: boolean;
    notes?: string | null;
    showLocation?: string | null;
    sectionName?: string | null;
    awardCategory?: string | null;
    competitionLevel?: string | null;
    showDateText?: string | null;
    /** Qualification card (210): "nan" | "omeq" | null = no card. */
    qualifierProgram?: string | null;
    qualifierCard?: string | null;
    qualifierYear?: number | string | null;
    qualifierCardId?: string | null;
}): Promise<{ success: boolean; error?: string; warning?: string }> {
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

    // Qualification card (210) — validated once; NAN mirrored into the
    // 030 columns so the legacy readers keep working.
    const qualifier = validateQualifier({
        program: data.qualifierProgram ?? null,
        card: data.qualifierCard ?? null,
        year: data.qualifierYear ?? null,
        cardId: data.qualifierCardId ?? null,
    });
    if (!qualifier.ok) return { success: false, error: qualifier.error };

    const base: Record<string, unknown> = {
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
        class_name: data.className?.trim() || null,
        show_location: data.showLocation?.trim() || null,
        section_name: data.sectionName?.trim() || null,
        award_category: data.awardCategory?.trim() || null,
        competition_level: data.competitionLevel?.trim() || null,
        show_date_text: data.showDateText?.trim() || null,
        ...nanMirror(qualifier.value),
    };

    let { error } = await supabase
        .from("show_records")
        .insert({ ...base, ...qualifierColumns(qualifier.value) } as never);
    let warning: string | undefined;
    // Before 210 is pasted the card columns don't exist: keep the
    // record, and say plainly that the card wasn't kept.
    if (error && isMissingColumn(error) && qualifier.value) {
        warning = QUALIFIER_NOT_KEPT;
        ({ error } = await supabase.from("show_records").insert(base as never));
    }

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

    return { success: true, warning };
}

/**
 * Update an existing show record.
 */
export async function updateShowRecord(
    recordId: string,
    data: {
        showName?: string | null;
        showDate?: string | null;
        division?: string | null;
        className?: string | null;
        placing?: string | null;
        ribbonColor?: string | null;
        judgeName?: string | null;
        isNan?: boolean;
        notes?: string | null;
        showLocation?: string | null;
        sectionName?: string | null;
        awardCategory?: string | null;
        competitionLevel?: string | null;
        showDateText?: string | null;
        /** Qualification card (210). Sent as null to clear the card. */
        qualifierProgram?: string | null;
        qualifierCard?: string | null;
        qualifierYear?: number | string | null;
        qualifierCardId?: string | null;
    }
): Promise<{ success: boolean; error?: string; warning?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    const updateData: Record<string, unknown> = {};
    if (data.showName !== undefined) updateData.show_name = data.showName?.trim();
    if (data.showDate !== undefined) updateData.show_date = data.showDate || null;
    if (data.division !== undefined) updateData.division = data.division?.trim() || null;
    if (data.placing !== undefined) updateData.placing = data.placing?.trim() || null;
    if (data.ribbonColor !== undefined) updateData.ribbon_color = data.ribbonColor || null;
    if (data.judgeName !== undefined) updateData.judge_name = data.judgeName?.trim() || null;
    if (data.isNan !== undefined) updateData.is_nan = data.isNan;
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
    if (data.className !== undefined) updateData.class_name = data.className?.trim() || null;
    if (data.showLocation !== undefined) updateData.show_location = data.showLocation?.trim() || null;
    if (data.sectionName !== undefined) updateData.section_name = data.sectionName?.trim() || null;
    if (data.awardCategory !== undefined) updateData.award_category = data.awardCategory?.trim() || null;
    if (data.competitionLevel !== undefined) updateData.competition_level = data.competitionLevel?.trim() || null;
    if (data.showDateText !== undefined) updateData.show_date_text = data.showDateText?.trim() || null;

    // Qualification card (210): the form always sends the program, so
    // "no card" clears it — and the NAN mirror with it.
    let qualifierTouched = false;
    let qualifierSet = false;
    if (data.qualifierProgram !== undefined) {
        const qualifier = validateQualifier({
            program: data.qualifierProgram,
            card: data.qualifierCard ?? null,
            year: data.qualifierYear ?? null,
            cardId: data.qualifierCardId ?? null,
        });
        if (!qualifier.ok) return { success: false, error: qualifier.error };
        qualifierTouched = true;
        qualifierSet = qualifier.value !== null;
        Object.assign(updateData, qualifierColumns(qualifier.value), nanMirror(qualifier.value));
    }

    // Fuzzy date fallback for updates
    if (data.showDateText !== undefined && !data.showDate) {
        const yearMatch = data.showDateText?.match(/\b(19|20)\d{2}\b/);
        if (yearMatch && !updateData.show_date) {
            updateData.show_date = `${yearMatch[0]}-01-01`;
        }
    }

    let { error } = await supabase
        .from("show_records")
        .update(updateData)
        .eq("id", recordId);
    let warning: string | undefined;
    // Pre-210: drop the card columns, keep the rest of the edit.
    if (error && isMissingColumn(error) && qualifierTouched) {
        for (const k of ["qualifier_program", "qualifier_card", "qualifier_year", "qualifier_card_id"]) {
            delete updateData[k];
        }
        if (qualifierSet) warning = QUALIFIER_NOT_KEPT;
        ({ error } = await supabase.from("show_records").update(updateData).eq("id", recordId));
    }

    if (error) return { success: false, error: error.message };
    return { success: true, warning };
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

    // A member owns what they typed in, not what the site awarded them.
    // Records minted by an MHH show (verification_tier platform_generated,
    // or anything carrying a show_id) are the reason a stranger can trust
    // a placing at all — if a bad day could be deleted from the record,
    // the record only ever shows good days and means nothing. Voiding one
    // of those is the host's call, through the strike/void path.
    const { data: record } = await supabase
        .from("show_records")
        .select("id, verification_tier, show_id")
        .eq("id", recordId)
        .eq("user_id", user.id)
        .maybeSingle<{
            id: string;
            verification_tier: string | null;
            show_id: string | null;
        }>();

    if (!record) return { success: false, error: "Record not found." };

    if (record.verification_tier === "platform_generated" || record.show_id) {
        return {
            success: false,
            error:
                "This placing was awarded in a show on Model Horse Hub, so it stays on the record. Ask the show's host if you think it's wrong.",
        };
    }

    const { error } = await supabase
        .from("show_records")
        .delete()
        .eq("id", recordId)
        .eq("user_id", user.id);

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
    sireId?: string | null;
    damId?: string | null;
    sculptor?: string;
    castNumber?: string;
    editionSize?: string;
    lineageNotes?: string;
    /** The sire's / dam's own page (213) — a sire/dam list, a registry entry. */
    sireUrl?: string | null;
    damUrl?: string | null;
    /** The breeding program named on the certificate (213). */
    bredBy?: string | null;
}): Promise<{ success: boolean; error?: string; warning?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    // Outbound links: https only, or nothing. A typed address that won't
    // parse is refused with a sentence rather than stored as dead text.
    const sireUrl = data.sireUrl?.trim() ? safeHttpUrl(data.sireUrl) : null;
    if (data.sireUrl?.trim() && !sireUrl) {
        return { success: false, error: "The sire's page should be a web address (https://…)." };
    }
    const damUrl = data.damUrl?.trim() ? safeHttpUrl(data.damUrl) : null;
    if (data.damUrl?.trim() && !damUrl) {
        return { success: false, error: "The dam's page should be a web address (https://…)." };
    }

    // ── Gender validation for linked parents ──
    if (data.sireId) {
        if (data.sireId === data.horseId) {
            return { success: false, error: "A horse cannot be its own Sire." };
        }
        const { data: sireHorse } = await supabase
            .from("user_horses")
            .select("assigned_gender")
            .eq("id", data.sireId)
            .single();

        if (sireHorse?.assigned_gender) {
            if (FEMALE_GENDERS.includes(sireHorse.assigned_gender)) {
                return { success: false, error: `A ${sireHorse.assigned_gender} cannot be assigned as a Sire.` };
            }
        }
    }

    if (data.damId) {
        if (data.damId === data.horseId) {
            return { success: false, error: "A horse cannot be its own Dam." };
        }
        const { data: damHorse } = await supabase
            .from("user_horses")
            .select("assigned_gender")
            .eq("id", data.damId)
            .single();

        if (damHorse?.assigned_gender) {
            if (MALE_GENDERS.includes(damHorse.assigned_gender)) {
                return { success: false, error: `A ${damHorse.assigned_gender} cannot be assigned as a Dam.` };
            }
        }
    }

    // Also prevent sire === dam
    if (data.sireId && data.damId && data.sireId === data.damId) {
        return { success: false, error: "Sire and Dam cannot be the same horse." };
    }

    // Check if pedigree exists
    const { data: existing } = await supabase
        .from("horse_pedigrees")
        .select("id")
        .eq("horse_id", data.horseId)
        .maybeSingle();

    const pedigreeData = {
        sire_name: data.sireName?.trim() || null,
        dam_name: data.damName?.trim() || null,
        sire_id: data.sireId || null,
        dam_id: data.damId || null,
        sculptor: data.sculptor?.trim() || null,
        cast_number: data.castNumber?.trim() || null,
        edition_size: data.editionSize?.trim() || null,
        lineage_notes: data.lineageNotes?.trim() || null,
    };
    // 213 columns — split out so a pre-paste save can drop them and keep the rest.
    const linkData: Record<string, unknown> = {
        sire_url: sireUrl,
        dam_url: damUrl,
        bred_by: data.bredBy?.trim().slice(0, 120) || null,
    };

    const missingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";
    let warning: string | undefined;
    if (existing) {
        let { error } = await supabase
            .from("horse_pedigrees")
            .update({ ...pedigreeData, ...linkData, updated_at: new Date().toISOString() } as never)
            .eq("id", existing.id);
        if (error && missingColumn(error)) {
            // Pre-213: keep the pedigree, say the links weren't kept.
            if (sireUrl || damUrl || linkData.bred_by) warning = LINKS_NOT_KEPT;
            ({ error } = await supabase
                .from("horse_pedigrees")
                .update({ ...pedigreeData, updated_at: new Date().toISOString() })
                .eq("id", existing.id));
        }
        if (error) return { success: false, error: error.message };
    } else {
        let { error } = await supabase
            .from("horse_pedigrees")
            .insert({ horse_id: data.horseId, user_id: user.id, ...pedigreeData, ...linkData } as never);
        if (error && missingColumn(error)) {
            if (sireUrl || damUrl || linkData.bred_by) warning = LINKS_NOT_KEPT;
            ({ error } = await supabase
                .from("horse_pedigrees")
                .insert({ horse_id: data.horseId, user_id: user.id, ...pedigreeData }));
        }
        if (error) return { success: false, error: error.message };
    }

    return { success: true, warning };
}

/** Said when the sire/dam links were typed but migration 213 isn't in yet. */
const LINKS_NOT_KEPT =
    "Saved — but the sire and dam links aren't switched on yet, so they weren't kept. Edit the pedigree to add them once they are.";

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
