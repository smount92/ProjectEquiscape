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
    findUserByAliasSchema,
    firstZodError,
    getShowConsoleSchema,
    loadTemplateSchema,
    removeShowStaffSchema,
    reorderClasslistSchema,
    splitClassSchema,
    transitionShowStatusSchema,
    updateClassSchema,
    updateShowSettingsSchema,
} from "@/lib/shows/schemas";
import type {
    ConsoleClass,
    ConsoleDivision,
    ConsoleEntry,
    ConsoleSection,
    ConsoleStaffMember,
    HostedShowSummary,
    ShowConsoleData,
} from "@/lib/shows/console";
import {
    canCombineClass,
    canSplitClass,
    canTransition,
    canTransitionClass,
    isShowMutableForClasslist,
} from "@/lib/shows/stateMachine";
import { getClasslistTemplate } from "@/lib/shows/namhsaTemplate";
import type {
    ClassStatus,
    DivisionAxis,
    EntryStatus,
    ShowJudging,
    ShowMode,
    ShowStatus,
    StaffRole,
} from "@/lib/shows/types";

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

/** Uniform refusal for structural classlist edits on a frozen show. */
const CLASSLIST_FROZEN_ERROR =
    "The classlist can no longer be edited — this show has moved past its running phase.";

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
    // If the mirror fails, roll the show row back — a show without
    // its host in the roster would be half-created.
    const { error: staffError } = await supabase
        .from("show_staff")
        .insert({ show_id: show.id, user_id: user.id, role: "host" });
    if (staffError) {
        await supabase.from("shows").delete().eq("id", show.id);
        return { success: false, error: staffError.message };
    }

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
    if (!isShowMutableForClasslist(ctx.show.status)) {
        return { success: false, error: CLASSLIST_FROZEN_ERROR };
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
    if (!isShowMutableForClasslist(ctx.show.status)) {
        return { success: false, error: CLASSLIST_FROZEN_ERROR };
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
    if (!isShowMutableForClasslist(ctx.show.status)) {
        return { success: false, error: CLASSLIST_FROZEN_ERROR };
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

    // Structural edits freeze once the show leaves its running
    // phases; status flips stay open for results corrections.
    if (structuralKeys.length > 0 && !isShowMutableForClasslist(ctx.show.status)) {
        return { success: false, error: CLASSLIST_FROZEN_ERROR };
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
    if (!isShowMutableForClasslist(ctx.show.status)) {
        return { success: false, error: CLASSLIST_FROZEN_ERROR };
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
        .select("id, section_id, status")
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
    if (!isShowMutableForClasslist(ctx.show.status)) {
        return { success: false, error: CLASSLIST_FROZEN_ERROR };
    }

    const legal = canSplitClass(cls.status);
    if (!legal.ok) return { success: false, error: legal.reason };

    // One transactional RPC (SECURITY INVOKER — RLS still gates
    // every touched row): creates the lineage-linked class and
    // moves the selected entries, or does neither. The RPC
    // re-verifies class status + entry membership inside the
    // transaction; scratched entries are refused (they stay with
    // the original class as history).
    const { data: newClassId, error: rpcError } = await supabase.rpc("split_show_class", {
        p_class_id: v.classId,
        p_new_name: v.newClassName,
        p_new_class_number: v.newClassNumber ?? null,
        p_entry_ids: v.entryIdsToMove,
    });
    if (rpcError) return { success: false, error: rpcError.message };
    if (!newClassId) return { success: false, error: "Failed to create the split class." };

    return { success: true, newClassId: newClassId as string };
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
        .select("id, section_id, status")
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
    if (!isShowMutableForClasslist(ctx.show.status)) {
        return { success: false, error: CLASSLIST_FROZEN_ERROR };
    }

    // One transactional RPC (SECURITY INVOKER — RLS still gates
    // every touched row): creates the combined class (qualifying
    // only if every source did; eligibility rules inherited only
    // when uniform across sources), de-duplicates any horse entered
    // in several source classes (earliest entry wins, later ones
    // auto-scratched in place with a note), moves the live entries
    // and closes the sources with lineage — or does none of it.
    const { data: newClassId, error: rpcError } = await supabase.rpc("combine_show_classes", {
        p_class_ids: v.classIds,
        p_new_name: v.newClassName,
        p_new_class_number: v.newClassNumber ?? null,
    });
    if (rpcError) return { success: false, error: rpcError.message };
    if (!newClassId) return { success: false, error: "Failed to create the combined class." };

    return { success: true, newClassId: newClassId as string };
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

// ══════════════════════════════════════════════════════════════
// Console reads — Phase C. Same conventions as the mutations:
// zod → requireAuth → explicit role check → typed result.
// ══════════════════════════════════════════════════════════════

/** Count rows per key in JS — entry volumes are tiny until Phase D ships entering. */
function countBy(rows: { key: string }[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.key, (counts.get(row.key) ?? 0) + 1);
    return counts;
}

/** Resolve user ids to alias_name in one query. */
async function getAliases(
    supabase: SupabaseClient,
    userIds: string[],
): Promise<Map<string, string> | { error: string }> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    const { data, error } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", unique);
    if (error) return { error: error.message };
    return new Map(
        (data ?? []).map((r: { id: string; alias_name: string | null }) => [
            r.id,
            r.alias_name ?? "unknown",
        ]),
    );
}

/**
 * Shows where the caller is host or co_host, newest first —
 * the /shows/host "My Shows" list.
 */
export async function getHostedShows(): Promise<ActionResult<{ shows: HostedShowSummary[] }>> {
    const { supabase, user } = await requireAuth();

    const { data: staffRows, error: staffError } = await supabase
        .from("show_staff")
        .select("show_id, role")
        .eq("user_id", user.id)
        .in("role", MANAGER_ROLES);
    if (staffError) return { success: false, error: staffError.message };
    if (!staffRows || staffRows.length === 0) return { success: true, shows: [] };

    const roleByShow = new Map<string, StaffRole>(
        staffRows.map((r: { show_id: string; role: string }) => [r.show_id, r.role as StaffRole]),
    );
    const showIds = [...roleByShow.keys()];

    const { data: shows, error: showsError } = await supabase
        .from("shows")
        .select("id, title, mode, judging, status, show_date, entries_close_at, created_at")
        .in("id", showIds)
        .order("created_at", { ascending: false });
    if (showsError) return { success: false, error: showsError.message };

    const { data: entryRows, error: entriesError } = await supabase
        .from("show_class_entries")
        .select("show_id")
        .in("show_id", showIds);
    if (entriesError) return { success: false, error: entriesError.message };
    const entryCounts = countBy(
        (entryRows ?? []).map((r: { show_id: string }) => ({ key: r.show_id })),
    );

    return {
        success: true,
        shows: (shows ?? []).map((s) => ({
            id: s.id as string,
            title: s.title as string,
            mode: s.mode as ShowMode,
            judging: s.judging as ShowJudging,
            status: s.status as ShowStatus,
            showDate: (s.show_date as string | null) ?? null,
            entriesCloseAt: (s.entries_close_at as string | null) ?? null,
            createdAt: s.created_at as string,
            role: roleByShow.get(s.id as string) ?? "co_host",
            entryCount: entryCounts.get(s.id as string) ?? 0,
        })),
    };
}

/**
 * Everything the /shows/host/[id] console needs in one call.
 * Staff-gated: any role on the show may view; the client decides
 * which controls to render from viewerRole (actions re-check).
 */
export async function getShowConsole(
    input: z.input<typeof getShowConsoleSchema>,
): Promise<ActionResult<{ console: ShowConsoleData }>> {
    const parsed = getShowConsoleSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { showId } = parsed.data;

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role) return { success: false, error: "Only show staff can open the console." };

    const { data: show, error: showError } = await supabase
        .from("shows")
        .select(
            "id, title, mode, judging, status, venue_name, venue_address, show_date, entries_open_at, entries_close_at, judging_ends_at, rules_md, fee_info, capacity, is_mhh_qualifying, sanctioning_note, created_at",
        )
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { success: false, error: showError.message };
    if (!show) return { success: false, error: "Show not found." };

    // ── Classlist tree ──
    const { data: divisionRows, error: dErr } = await supabase
        .from("show_divisions")
        .select("id, name, axis, sort_order")
        .eq("show_id", showId)
        .order("sort_order", { ascending: true });
    if (dErr) return { success: false, error: dErr.message };
    const divisionIds = (divisionRows ?? []).map((d) => d.id as string);

    let sectionRows: { id: string; division_id: string; name: string; sort_order: number }[] = [];
    let classRows: {
        id: string;
        section_id: string;
        name: string;
        class_number: string | null;
        status: string;
        max_per_entrant: number | null;
        allowed_scales: string[] | null;
        allowed_finishes: string[] | null;
        is_qualifying: boolean;
        sort_order: number;
    }[] = [];
    if (divisionIds.length > 0) {
        const { data: sections, error: sErr } = await supabase
            .from("show_sections")
            .select("id, division_id, name, sort_order")
            .in("division_id", divisionIds)
            .order("sort_order", { ascending: true });
        if (sErr) return { success: false, error: sErr.message };
        sectionRows = sections ?? [];

        const sectionIds = sectionRows.map((s) => s.id);
        if (sectionIds.length > 0) {
            const { data: classes, error: cErr } = await supabase
                .from("show_classes")
                .select(
                    "id, section_id, name, class_number, status, max_per_entrant, allowed_scales, allowed_finishes, is_qualifying, sort_order",
                )
                .in("section_id", sectionIds)
                .order("sort_order", { ascending: true });
            if (cErr) return { success: false, error: cErr.message };
            classRows = classes ?? [];
        }
    }

    // ── Entries (read-only in Phase C) ──
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, handler_id, entry_number, status")
        .eq("show_id", showId);
    if (eErr) return { success: false, error: eErr.message };
    const entries = entryRows ?? [];

    // ── Staff roster ──
    const { data: staffRows, error: stErr } = await supabase
        .from("show_staff")
        .select("user_id, role, coi_flag, coi_note")
        .eq("show_id", showId)
        .order("created_at", { ascending: true });
    if (stErr) return { success: false, error: stErr.message };
    const staff = staffRows ?? [];

    // ── Names: staff/owner/handler aliases + horse names ──
    const aliases = await getAliases(supabase, [
        ...staff.map((s) => s.user_id as string),
        ...entries.map((e) => e.owner_id as string),
        ...entries.flatMap((e) => (e.handler_id ? [e.handler_id as string] : [])),
    ]);
    if (!(aliases instanceof Map)) return { success: false, error: aliases.error };

    const horseIds = [...new Set(entries.map((e) => e.horse_id as string))];
    const horseNames = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: horses, error: hErr } = await supabase
            .from("user_horses")
            .select("id, custom_name")
            .in("id", horseIds);
        if (hErr) return { success: false, error: hErr.message };
        for (const h of horses ?? []) {
            horseNames.set(h.id as string, (h.custom_name as string | null) ?? "Unnamed horse");
        }
    }

    // ── Assemble the tree ──
    const entryCountByClass = countBy(entries.map((e) => ({ key: e.class_id as string })));

    const classesBySection = new Map<string, ConsoleClass[]>();
    for (const c of classRows) {
        const list = classesBySection.get(c.section_id) ?? [];
        list.push({
            id: c.id,
            name: c.name,
            classNumber: c.class_number,
            status: c.status as ClassStatus,
            maxPerEntrant: c.max_per_entrant,
            allowedScales: c.allowed_scales,
            allowedFinishes: c.allowed_finishes,
            isQualifying: c.is_qualifying,
            sortOrder: c.sort_order,
            entryCount: entryCountByClass.get(c.id) ?? 0,
        });
        classesBySection.set(c.section_id, list);
    }

    const sectionsByDivision = new Map<string, ConsoleSection[]>();
    for (const s of sectionRows) {
        const list = sectionsByDivision.get(s.division_id) ?? [];
        list.push({
            id: s.id,
            name: s.name,
            sortOrder: s.sort_order,
            classes: classesBySection.get(s.id) ?? [],
        });
        sectionsByDivision.set(s.division_id, list);
    }

    const divisions: ConsoleDivision[] = (divisionRows ?? []).map((d) => ({
        id: d.id as string,
        name: d.name as string,
        axis: d.axis as DivisionAxis,
        sortOrder: d.sort_order as number,
        sections: sectionsByDivision.get(d.id as string) ?? [],
    }));

    const staffMembers: ConsoleStaffMember[] = staff.map((s) => ({
        userId: s.user_id as string,
        alias: aliases.get(s.user_id as string) ?? "unknown",
        role: s.role as StaffRole,
        coiFlag: s.coi_flag as boolean,
        coiNote: (s.coi_note as string | null) ?? null,
    }));

    const consoleEntries: ConsoleEntry[] = entries.map((e) => ({
        id: e.id as string,
        classId: e.class_id as string,
        horseName: horseNames.get(e.horse_id as string) ?? "Unnamed horse",
        ownerAlias: aliases.get(e.owner_id as string) ?? "unknown",
        handlerAlias:
            e.handler_id && e.handler_id !== e.owner_id
                ? (aliases.get(e.handler_id as string) ?? "unknown")
                : null,
        entryNumber: (e.entry_number as number | null) ?? null,
        status: e.status as EntryStatus,
    }));

    return {
        success: true,
        console: {
            show: {
                id: show.id as string,
                title: show.title as string,
                mode: show.mode as ShowMode,
                judging: show.judging as ShowJudging,
                status: show.status as ShowStatus,
                venueName: show.venue_name as string | null,
                venueAddress: show.venue_address as string | null,
                showDate: show.show_date as string | null,
                entriesOpenAt: show.entries_open_at as string | null,
                entriesCloseAt: show.entries_close_at as string | null,
                judgingEndsAt: show.judging_ends_at as string | null,
                rulesMd: show.rules_md as string | null,
                feeInfo: show.fee_info as string | null,
                capacity: show.capacity as number | null,
                isMhhQualifying: show.is_mhh_qualifying as boolean,
                sanctioningNote: show.sanctioning_note as string | null,
                createdAt: show.created_at as string,
            },
            viewerRole: ctx.role,
            divisions,
            staff: staffMembers,
            entries: consoleEntries,
        },
    };
}

/**
 * Exact-alias lookup (case-insensitive) for the staff panel's
 * add-by-alias flow. Returns null (not an error) when nobody
 * matches so the UI can show "no user found".
 */
export async function findUserByAlias(
    input: z.input<typeof findUserByAliasSchema>,
): Promise<ActionResult<{ user: { id: string; alias: string } | null }>> {
    const parsed = findUserByAliasSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase } = await requireAuth();

    // Escape LIKE wildcards so the lookup stays EXACT (case-insensitive).
    const literal = parsed.data.alias.replace(/[\\%_]/g, "\\$&");
    const { data, error } = await supabase
        .from("users")
        .select("id, alias_name")
        .ilike("alias_name", literal)
        .limit(1)
        .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, user: null };
    return {
        success: true,
        user: { id: data.id as string, alias: data.alias_name as string },
    };
}
