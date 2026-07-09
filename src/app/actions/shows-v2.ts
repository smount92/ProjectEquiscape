"use server";

/**
 * Shows v2 server actions — Phase B of the show-system rebuild.
 *
 * RLS-first: every query runs on the user's client; there is no
 * admin-client use in this file. Each action:
 *   1. zod-parses its input (src/lib/shows/schemas.ts),
 *   2. requireAuth(),
 *   3. explicit role check (host / co_host; stewards limited to
 *      day-of class-status recording per the design doc),
 *   4. returns { success, error? } — never throws for domain errors.
 *
 * NOTE: these actions target the tables from migrations 117/118,
 * which the owner applies manually. Nothing here runs against the
 * DB until then; the whole feature ships behind NEXT_PUBLIC_SHOWS_V2.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import {
    addClassSchema,
    addDivisionSchema,
    addSectionSchema,
    addShowStaffSchema,
    combineClassesSchema,
    createShowSchema,
    firstZodError,
    loadTemplateSchema,
    removeShowStaffSchema,
    reorderClasslistSchema,
    splitClassSchema,
    transitionShowStatusSchema,
    updateClassSchema,
    updateShowSettingsSchema,
} from "@/lib/shows/schemas";
import {
    canCombineClass,
    canSplitClass,
    canTransition,
    canTransitionClass,
} from "@/lib/shows/stateMachine";
import { getClasslistTemplate } from "@/lib/shows/namhsaTemplate";
import type { ShowMode, ShowStatus, StaffRole } from "@/lib/shows/types";

// ── Shared result + helpers ──

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

interface ShowCore {
    id: string;
    host_id: string;
    status: ShowStatus;
    mode: ShowMode;
}

/**
 * Load the show and resolve the caller's role on it.
 * Role 'host' comes from shows.host_id; delegated roles from show_staff.
 */
async function getShowRole(
    supabase: SupabaseClient,
    showId: string,
    userId: string,
): Promise<{ show: ShowCore; role: StaffRole | null } | { error: string }> {
    const { data: show, error } = await supabase
        .from("shows")
        .select("id, host_id, status, mode")
        .eq("id", showId)
        .maybeSingle();
    if (error) return { error: error.message };
    if (!show) return { error: "Show not found." };

    if (show.host_id === userId) return { show: show as ShowCore, role: "host" };

    const { data: staff } = await supabase
        .from("show_staff")
        .select("role")
        .eq("show_id", showId)
        .eq("user_id", userId)
        .maybeSingle();

    return { show: show as ShowCore, role: (staff?.role as StaffRole) ?? null };
}

const MANAGER_ROLES: StaffRole[] = ["host", "co_host"];

/** showId lookup for a class via its section → division chain. */
async function getShowIdOfClass(
    supabase: SupabaseClient,
    sectionId: string,
): Promise<{ showId: string; divisionId: string } | { error: string }> {
    const { data: section, error } = await supabase
        .from("show_sections")
        .select("id, division_id")
        .eq("id", sectionId)
        .maybeSingle();
    if (error) return { error: error.message };
    if (!section) return { error: "Section not found." };

    const { data: division, error: dErr } = await supabase
        .from("show_divisions")
        .select("id, show_id")
        .eq("id", section.division_id)
        .maybeSingle();
    if (dErr) return { error: dErr.message };
    if (!division) return { error: "Division not found." };

    return { showId: division.show_id as string, divisionId: division.id as string };
}

// ══════════════════════════════════════════════════════════════
// Show lifecycle
// ══════════════════════════════════════════════════════════════

export async function createShow(
    input: z.input<typeof createShowSchema>,
): Promise<ActionResult<{ showId: string }>> {
    const parsed = createShowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: show, error } = await supabase
        .from("shows")
        .insert({
            host_id: user.id,
            title: v.title,
            mode: v.mode,
            judging: v.judging,
            status: "draft",
            venue_name: v.venueName ?? null,
            venue_address: v.venueAddress ?? null,
            show_date: v.showDate ?? null,
            entries_open_at: v.entriesOpenAt ?? null,
            entries_close_at: v.entriesCloseAt ?? null,
            judging_ends_at: v.judgingEndsAt ?? null,
            rules_md: v.rulesMd ?? null,
            fee_info: v.feeInfo ?? null,
            capacity: v.capacity ?? null,
            is_mhh_qualifying: v.isMhhQualifying,
            sanctioning_note: v.sanctioningNote ?? null,
        })
        .select("id")
        .single();
    if (error || !show) return { success: false, error: error?.message ?? "Failed to create show." };

    // Mirror the host into show_staff so staff queries see one roster.
    const { error: staffError } = await supabase
        .from("show_staff")
        .insert({ show_id: show.id, user_id: user.id, role: "host" });
    if (staffError) return { success: false, error: staffError.message };

    return { success: true, showId: show.id as string };
}

export async function updateShowSettings(
    input: z.input<typeof updateShowSettingsSchema>,
): Promise<ActionResult> {
    const parsed = updateShowSettingsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { showId, patch } = parsed.data;

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can edit show settings." };
    }
    if (patch.mode && patch.mode !== ctx.show.mode && ctx.show.status !== "draft") {
        return { success: false, error: "A show's mode can only change while it is a draft." };
    }

    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.mode !== undefined) update.mode = patch.mode;
    if (patch.judging !== undefined) update.judging = patch.judging;
    if (patch.venueName !== undefined) update.venue_name = patch.venueName;
    if (patch.venueAddress !== undefined) update.venue_address = patch.venueAddress;
    if (patch.showDate !== undefined) update.show_date = patch.showDate;
    if (patch.entriesOpenAt !== undefined) update.entries_open_at = patch.entriesOpenAt;
    if (patch.entriesCloseAt !== undefined) update.entries_close_at = patch.entriesCloseAt;
    if (patch.judgingEndsAt !== undefined) update.judging_ends_at = patch.judgingEndsAt;
    if (patch.rulesMd !== undefined) update.rules_md = patch.rulesMd;
    if (patch.feeInfo !== undefined) update.fee_info = patch.feeInfo;
    if (patch.capacity !== undefined) update.capacity = patch.capacity;
    if (patch.isMhhQualifying !== undefined) update.is_mhh_qualifying = patch.isMhhQualifying;
    if (patch.sanctioningNote !== undefined) update.sanctioning_note = patch.sanctioningNote;

    const { error } = await supabase.from("shows").update(update).eq("id", showId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function transitionShowStatus(
    input: z.input<typeof transitionShowStatusSchema>,
): Promise<ActionResult> {
    const parsed = transitionShowStatusSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { showId, to } = parsed.data;

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can change the show status." };
    }

    const legal = canTransition(ctx.show.status, to, ctx.show.mode);
    if (!legal.ok) return { success: false, error: legal.reason };

    const { error } = await supabase.from("shows").update({ status: to }).eq("id", showId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// Classlist structure
// ══════════════════════════════════════════════════════════════

export async function addDivision(
    input: z.input<typeof addDivisionSchema>,
): Promise<ActionResult<{ divisionId: string }>> {
    const parsed = addDivisionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const ctx = await getShowRole(supabase, v.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can edit the classlist." };
    }

    const { data, error } = await supabase
        .from("show_divisions")
        .insert({
            show_id: v.showId,
            name: v.name,
            axis: v.axis,
            sort_order: v.sortOrder ?? 0,
        })
        .select("id")
        .single();
    if (error || !data) return { success: false, error: error?.message ?? "Failed to add division." };
    return { success: true, divisionId: data.id as string };
}

export async function addSection(
    input: z.input<typeof addSectionSchema>,
): Promise<ActionResult<{ sectionId: string }>> {
    const parsed = addSectionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: division, error: dErr } = await supabase
        .from("show_divisions")
        .select("id, show_id")
        .eq("id", v.divisionId)
        .maybeSingle();
    if (dErr) return { success: false, error: dErr.message };
    if (!division) return { success: false, error: "Division not found." };

    const ctx = await getShowRole(supabase, division.show_id as string, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can edit the classlist." };
    }

    const { data, error } = await supabase
        .from("show_sections")
        .insert({
            division_id: v.divisionId,
            name: v.name,
            sort_order: v.sortOrder ?? 0,
        })
        .select("id")
        .single();
    if (error || !data) return { success: false, error: error?.message ?? "Failed to add section." };
    return { success: true, sectionId: data.id as string };
}

export async function addClass(
    input: z.input<typeof addClassSchema>,
): Promise<ActionResult<{ classId: string }>> {
    const parsed = addClassSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const located = await getShowIdOfClass(supabase, v.sectionId);
    if ("error" in located) return { success: false, error: located.error };

    const ctx = await getShowRole(supabase, located.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can edit the classlist." };
    }

    const { data, error } = await supabase
        .from("show_classes")
        .insert({
            section_id: v.sectionId,
            name: v.name,
            class_number: v.classNumber ?? null,
            status: "scheduled",
            max_per_entrant: v.maxPerEntrant ?? null,
            allowed_scales: v.allowedScales ?? null,
            allowed_finishes: v.allowedFinishes ?? null,
            is_qualifying: v.isQualifying ?? true,
            sort_order: v.sortOrder ?? 0,
        })
        .select("id")
        .single();
    if (error || !data) return { success: false, error: error?.message ?? "Failed to add class." };
    return { success: true, classId: data.id as string };
}

export async function updateClass(
    input: z.input<typeof updateClassSchema>,
): Promise<ActionResult> {
    const parsed = updateClassSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { classId, patch } = parsed.data;

    const { data: cls, error: cErr } = await supabase
        .from("show_classes")
        .select("id, section_id, status")
        .eq("id", classId)
        .maybeSingle();
    if (cErr) return { success: false, error: cErr.message };
    if (!cls) return { success: false, error: "Class not found." };

    const located = await getShowIdOfClass(supabase, cls.section_id as string);
    if ("error" in located) return { success: false, error: located.error };

    const ctx = await getShowRole(supabase, located.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };

    const structuralKeys = Object.keys(patch).filter((k) => k !== "status");
    const isManager = !!ctx.role && MANAGER_ROLES.includes(ctx.role);
    const isSteward = ctx.role === "steward";

    // Stewards RECORD (day-of status flips) but never edit structure.
    if (!isManager && !(isSteward && structuralKeys.length === 0)) {
        return {
            success: false,
            error: isSteward
                ? "Stewards can update class status, not class details."
                : "Only show staff can update classes.",
        };
    }

    if (patch.status && patch.status !== cls.status) {
        const legal = canTransitionClass(cls.status, patch.status);
        if (!legal.ok) return { success: false, error: legal.reason };
    }

    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.classNumber !== undefined) update.class_number = patch.classNumber;
    if (patch.maxPerEntrant !== undefined) update.max_per_entrant = patch.maxPerEntrant;
    if (patch.allowedScales !== undefined) update.allowed_scales = patch.allowedScales;
    if (patch.allowedFinishes !== undefined) update.allowed_finishes = patch.allowedFinishes;
    if (patch.isQualifying !== undefined) update.is_qualifying = patch.isQualifying;
    if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
    if (patch.status !== undefined) update.status = patch.status;

    const { error } = await supabase.from("show_classes").update(update).eq("id", classId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Batch reorder of divisions/sections/classes — one RPC call
 * (reorder_show_nodes, SECURITY INVOKER so RLS still gates every
 * row), not a per-row update loop.
 */
export async function reorderClasslist(
    input: z.input<typeof reorderClasslistSchema>,
): Promise<ActionResult<{ updated: number }>> {
    const parsed = reorderClasslistSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const ctx = await getShowRole(supabase, v.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can reorder the classlist." };
    }

    const { data, error } = await supabase.rpc("reorder_show_nodes", {
        p_kind: v.kind,
        p_ids: v.items.map((i) => i.id),
        p_sort_orders: v.items.map((i) => i.sortOrder),
    });
    if (error) return { success: false, error: error.message };
    return { success: true, updated: (data as number) ?? v.items.length };
}

// ══════════════════════════════════════════════════════════════
// Split / combine — the day-of pressure valves.
// New class rows linked by split_from/combined_into; entries are
// MOVED, lineage preserved. The published classlist is never
// destructively edited.
// ══════════════════════════════════════════════════════════════

export async function splitClass(
    input: z.input<typeof splitClassSchema>,
): Promise<ActionResult<{ newClassId: string }>> {
    const parsed = splitClassSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: cls, error: cErr } = await supabase
        .from("show_classes")
        .select("id, section_id, name, class_number, status, max_per_entrant, allowed_scales, allowed_finishes, is_qualifying, sort_order")
        .eq("id", v.classId)
        .maybeSingle();
    if (cErr) return { success: false, error: cErr.message };
    if (!cls) return { success: false, error: "Class not found." };

    const located = await getShowIdOfClass(supabase, cls.section_id as string);
    if ("error" in located) return { success: false, error: located.error };

    const ctx = await getShowRole(supabase, located.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can split a class." };
    }

    const legal = canSplitClass(cls.status);
    if (!legal.ok) return { success: false, error: legal.reason };

    // Every moved entry must belong to the class being split.
    const { data: moveable, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id")
        .eq("class_id", v.classId)
        .in("id", v.entryIdsToMove);
    if (eErr) return { success: false, error: eErr.message };
    if ((moveable?.length ?? 0) !== v.entryIdsToMove.length) {
        return { success: false, error: "Some selected entries do not belong to this class." };
    }

    // New class inherits the original's eligibility rules; lineage
    // via split_from_class_id.
    const { data: newClass, error: nErr } = await supabase
        .from("show_classes")
        .insert({
            section_id: cls.section_id,
            name: v.newClassName,
            class_number: v.newClassNumber ?? null,
            status: "scheduled",
            split_from_class_id: v.classId,
            max_per_entrant: cls.max_per_entrant,
            allowed_scales: cls.allowed_scales,
            allowed_finishes: cls.allowed_finishes,
            is_qualifying: cls.is_qualifying,
            sort_order: (cls.sort_order as number) + 1,
        })
        .select("id")
        .single();
    if (nErr || !newClass) return { success: false, error: nErr?.message ?? "Failed to create the split class." };

    // Move the selected entries in one batch update.
    const { error: mErr } = await supabase
        .from("show_class_entries")
        .update({ class_id: newClass.id })
        .in("id", v.entryIdsToMove);
    if (mErr) return { success: false, error: mErr.message };

    return { success: true, newClassId: newClass.id as string };
}

export async function combineClasses(
    input: z.input<typeof combineClassesSchema>,
): Promise<ActionResult<{ newClassId: string }>> {
    const parsed = combineClassesSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: classes, error: cErr } = await supabase
        .from("show_classes")
        .select("id, section_id, status, is_qualifying")
        .in("id", v.classIds);
    if (cErr) return { success: false, error: cErr.message };
    if (!classes || classes.length !== v.classIds.length) {
        return { success: false, error: "One or more classes were not found." };
    }

    for (const cls of classes) {
        const legal = canCombineClass(cls.status);
        if (!legal.ok) return { success: false, error: legal.reason };
    }

    // All classes must live in the same show; the combined class
    // lands in the first class's section.
    const sectionIds = [...new Set(classes.map((c) => c.section_id as string))];
    const showIds = new Set<string>();
    let firstSection: { showId: string } | null = null;
    for (const sectionId of sectionIds) {
        const located = await getShowIdOfClass(supabase, sectionId);
        if ("error" in located) return { success: false, error: located.error };
        showIds.add(located.showId);
        if (sectionId === (classes[0].section_id as string)) firstSection = located;
    }
    if (showIds.size > 1) {
        return { success: false, error: "Classes from different shows cannot be combined." };
    }
    const showId = firstSection ? firstSection.showId : [...showIds][0];

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can combine classes." };
    }

    // The combined class qualifies only if every source did.
    const { data: newClass, error: nErr } = await supabase
        .from("show_classes")
        .insert({
            section_id: classes[0].section_id,
            name: v.newClassName,
            class_number: v.newClassNumber ?? null,
            status: "scheduled",
            is_qualifying: classes.every((c) => c.is_qualifying === true),
        })
        .select("id")
        .single();
    if (nErr || !newClass) return { success: false, error: nErr?.message ?? "Failed to create the combined class." };

    // Move all live entries; scratched entries stay behind as history.
    const { error: mErr } = await supabase
        .from("show_class_entries")
        .update({ class_id: newClass.id })
        .in("class_id", v.classIds)
        .neq("status", "scratched");
    if (mErr) return { success: false, error: mErr.message };

    // Close out the source classes with lineage.
    const { error: sErr } = await supabase
        .from("show_classes")
        .update({ status: "combined", combined_into_class_id: newClass.id })
        .in("id", v.classIds);
    if (sErr) return { success: false, error: sErr.message };

    return { success: true, newClassId: newClass.id as string };
}

// ══════════════════════════════════════════════════════════════
// NAMHSA template — 1-click core classlist (free tier)
// ══════════════════════════════════════════════════════════════

export async function loadNamhsaTemplate(
    input: z.input<typeof loadTemplateSchema>,
): Promise<ActionResult<{ divisions: number; sections: number; classes: number }>> {
    const parsed = loadTemplateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const template = getClasslistTemplate(v.templateKey);
    if (!template) return { success: false, error: `Unknown template: ${v.templateKey}` };

    const ctx = await getShowRole(supabase, v.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can load a template." };
    }
    if (ctx.show.status !== "draft" && ctx.show.status !== "published") {
        return { success: false, error: "Templates can only be loaded before entries open." };
    }

    // Three batch inserts (divisions → sections → classes), not
    // per-row loops. IDs map back by name / (division_id, name).
    const { data: divisionRows, error: dErr } = await supabase
        .from("show_divisions")
        .insert(
            template.divisions.map((d, i) => ({
                show_id: v.showId,
                name: d.name,
                axis: d.axis,
                sort_order: i,
            })),
        )
        .select("id, name");
    if (dErr || !divisionRows) return { success: false, error: dErr?.message ?? "Failed to create divisions." };

    const divisionIdByName = new Map<string, string>(
        divisionRows.map((r: { id: string; name: string }) => [r.name, r.id]),
    );

    const sectionInserts: { division_id: string; name: string; sort_order: number }[] = [];
    for (const division of template.divisions) {
        const divisionId = divisionIdByName.get(division.name);
        if (!divisionId) return { success: false, error: `Division mapping failed for "${division.name}".` };
        division.sections.forEach((section, i) => {
            sectionInserts.push({ division_id: divisionId, name: section.name, sort_order: i });
        });
    }

    const { data: sectionRows, error: sErr } = await supabase
        .from("show_sections")
        .insert(sectionInserts)
        .select("id, name, division_id");
    if (sErr || !sectionRows) return { success: false, error: sErr?.message ?? "Failed to create sections." };

    const sectionIdByKey = new Map<string, string>(
        sectionRows.map((r: { id: string; name: string; division_id: string }) => [
            `${r.division_id}:${r.name}`,
            r.id,
        ]),
    );

    const classInserts: Record<string, unknown>[] = [];
    for (const division of template.divisions) {
        const divisionId = divisionIdByName.get(division.name);
        for (const section of division.sections) {
            const sectionId = sectionIdByKey.get(`${divisionId}:${section.name}`);
            if (!sectionId) return { success: false, error: `Section mapping failed for "${section.name}".` };
            section.classes.forEach((cls, i) => {
                classInserts.push({
                    section_id: sectionId,
                    name: cls.name,
                    class_number: cls.classNumber ?? null,
                    status: "scheduled",
                    is_qualifying: cls.isQualifying ?? true,
                    sort_order: i,
                });
            });
        }
    }

    const { error: clErr } = await supabase.from("show_classes").insert(classInserts);
    if (clErr) return { success: false, error: clErr.message };

    return {
        success: true,
        divisions: template.divisions.length,
        sections: sectionInserts.length,
        classes: classInserts.length,
    };
}

// ══════════════════════════════════════════════════════════════
// Staff management — HOST ONLY (co-hosts cannot mint co-hosts)
// ══════════════════════════════════════════════════════════════

export async function addShowStaff(
    input: z.input<typeof addShowStaffSchema>,
): Promise<ActionResult<{ staffId: string }>> {
    const parsed = addShowStaffSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const ctx = await getShowRole(supabase, v.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (ctx.role !== "host") {
        return { success: false, error: "Only the show host can manage staff." };
    }
    if (v.userId === user.id) {
        return { success: false, error: "You are already the host of this show." };
    }

    const { data, error } = await supabase
        .from("show_staff")
        .insert({
            show_id: v.showId,
            user_id: v.userId,
            role: v.role,
            coi_flag: v.coiFlag,
            coi_note: v.coiNote ?? null,
        })
        .select("id")
        .single();
    if (error || !data) {
        return {
            success: false,
            error: error?.code === "23505"
                ? "That user already has a role on this show."
                : error?.message ?? "Failed to add staff member.",
        };
    }
    return { success: true, staffId: data.id as string };
}

export async function removeShowStaff(
    input: z.input<typeof removeShowStaffSchema>,
): Promise<ActionResult> {
    const parsed = removeShowStaffSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const ctx = await getShowRole(supabase, v.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (ctx.role !== "host") {
        return { success: false, error: "Only the show host can manage staff." };
    }
    if (v.userId === ctx.show.host_id) {
        return { success: false, error: "The host cannot be removed from their own show." };
    }

    const { error } = await supabase
        .from("show_staff")
        .delete()
        .eq("show_id", v.showId)
        .eq("user_id", v.userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}
