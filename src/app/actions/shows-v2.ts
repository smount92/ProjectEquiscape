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
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
    addClassSchema,
    addDivisionSchema,
    addSectionSchema,
    addShowStaffSchema,
    castVoteSchema,
    combineClassesSchema,
    createShowSchema,
    enterClassSchema,
    finalizeCommunityVotesSchema,
    findUserByAliasSchema,
    firstZodError,
    getJudgeQueueSchema,
    getMyShowEntriesSchema,
    getPublicShowSchema,
    getShowConsoleSchema,
    getShowGallerySchema,
    loadTemplateSchema,
    recordPlacingsSchema,
    removeShowStaffSchema,
    removeVoteSchema,
    reorderClasslistSchema,
    scratchEntrySchema,
    splitClassSchema,
    transitionShowStatusSchema,
    updateClassSchema,
    updateShowSettingsSchema,
} from "@/lib/shows/schemas";
import {
    getAliases,
    getEntryPhotoUrls,
    getHorseNames,
    getShowRole,
    loadClassContexts,
} from "@/lib/shows/queries";
import { deriveVotePlacings, type VoteTally } from "@/lib/shows/deriveVotePlacings";
import { buildShowRecords } from "@/lib/shows/writeShowRecords";
import { issueQualificationCardsForShow } from "@/lib/shows/cardIssuance";
import {
    GALLERY_STATUSES,
    isOwnerRevealed,
    RESULTS_STATUSES,
    type GalleryClass,
    type GalleryEntry,
    type JudgeQueueClass,
    type JudgeQueueData,
    type ShowGalleryData,
} from "@/lib/shows/gallery";
import { validateEntry } from "@/lib/shows/entryRules";
import {
    PUBLIC_BROWSE_STATUSES,
    type EntrantHorse,
    type MyShowEntry,
    type PublicShow,
    type PublicShowSummary,
} from "@/lib/shows/public";
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
    CallbackScope,
    ClassStatus,
    DivisionAxis,
    EntryStatus,
    Place,
    ShowJudging,
    ShowMode,
    ShowStatus,
    StaffRole,
} from "@/lib/shows/types";

// ── Shared result + helpers ──
// The query helpers (getShowRole, getAliases, getHorseNames,
// getEntryPhotoUrls, loadClassContexts) moved to
// src/lib/shows/queries.ts in Phase E2 so the ring-console action
// file can share them — "use server" files may only export async
// server actions.

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

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
    if (patch.blindBrowsing !== undefined) update.blind_browsing = patch.blindBrowsing;

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

    // RESULTS PUBLISH (results_review → completed): every placed
    // entry becomes a permanent trophy-case row. Records are
    // written BEFORE the status flips — writeShowRecords is
    // idempotent, so a failure here leaves the show safely in
    // results_review and the host simply retries.
    if (to === "completed") {
        const published = await writeShowRecordsForShow(supabase, showId);
        if ("error" in published) {
            return {
                success: false,
                error: `Results could not be written to the horses' records — the show stays in results review. (${published.error})`,
            };
        }

        // QUALIFICATION CARDS (Phase F): 1st/2nd in qualifying
        // classes at an is_mhh_qualifying show mint bearer cards on
        // the horses' Hoofprints. Runs as the PUBLISHING HOST on the
        // user client — migration 118's INSERT policy (host/co_host
        // + class-belongs-to-show + real 1st/2nd placing) was built
        // for exactly this; no admin client. Same failure semantics
        // as the records write: idempotent, so the show stays in
        // results_review and the host retries.
        const cards = await issueQualificationCardsForShow(supabase, showId);
        if ("error" in cards) {
            return {
                success: false,
                error: `Qualification cards could not be issued — the show stays in results review. (${cards.error})`,
            };
        }
    }

    const { error } = await supabase.from("shows").update({ status: to }).eq("id", showId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Load the placed results of a show and write them to the legacy
 * show_records ledger (trophy case) via buildShowRecords — the
 * single vocabulary→legacy mapping. Idempotent: already-written
 * rows are skipped by (horse, class name) within this show.
 */
async function writeShowRecordsForShow(
    supabase: SupabaseClient,
    showId: string,
): Promise<{ written: number; skipped: number } | { error: string }> {
    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, title, mode, show_date, entries_close_at, judging_ends_at")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { error: showError.message };
    if (!show) return { error: "Show not found." };

    // ── Classlist tree (ids + names only) ──
    const { data: divisionRows, error: dErr } = await supabase
        .from("show_divisions")
        .select("id, name")
        .eq("show_id", showId);
    if (dErr) return { error: dErr.message };
    const divisions = (divisionRows ?? []) as { id: string; name: string }[];

    let sections: { id: string; name: string; division_id: string }[] = [];
    let classes: { id: string; name: string; section_id: string }[] = [];
    if (divisions.length > 0) {
        const { data: sectionRows, error: sErr } = await supabase
            .from("show_sections")
            .select("id, name, division_id")
            .in("division_id", divisions.map((d) => d.id));
        if (sErr) return { error: sErr.message };
        sections = sectionRows ?? [];
        if (sections.length > 0) {
            const { data: classRows, error: cErr } = await supabase
                .from("show_classes")
                .select("id, name, section_id")
                .in("section_id", sections.map((s) => s.id));
            if (cErr) return { error: cErr.message };
            classes = classRows ?? [];
        }
    }
    if (classes.length === 0) return { written: 0, skipped: 0 };

    // ── Live entries + placings ──
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, status")
        .eq("show_id", showId);
    if (eErr) return { error: eErr.message };
    const liveEntries = (entryRows ?? []).filter(
        (e: { status: string }) => e.status !== "scratched",
    );

    const { data: placingRows, error: pErr } = await supabase
        .from("show_placings")
        .select("entry_id, class_id, place, note")
        .in("class_id", classes.map((c) => c.id));
    if (pErr) return { error: pErr.message };
    const placings = placingRows ?? [];
    if (placings.length === 0) return { written: 0, skipped: 0 };

    // ── The callback ladder — champions/reserves become trophy-case
    // rows too (Phase E2). ──
    const { data: callbackRows, error: cbErr } = await supabase
        .from("show_callbacks")
        .select("scope, scope_id, champion_entry_id, reserve_entry_id")
        .eq("show_id", showId);
    if (cbErr) return { error: cbErr.message };

    // Admin client — REQUIRED here: show_records rows belong to the
    // entry OWNERS, and RLS (011) only lets a user insert/read their
    // own rows. The publishing host cannot write (or even see) other
    // entrants' records through their own client. Guarded above by
    // the explicit host/co-host role check in transitionShowStatus.
    const admin = getAdminClient();
    const { data: existingRows, error: exErr } = await admin
        .from("show_records")
        .select("horse_id, class_name")
        .eq("show_name", show.title as string)
        .eq("verification_tier", "platform_generated");
    if (exErr) return { error: exErr.message };

    const { rows, skipped } = buildShowRecords({
        show: {
            id: show.id as string,
            title: show.title as string,
            mode: show.mode as ShowMode,
            showDate: (show.show_date as string | null) ?? null,
            entriesCloseAt: (show.entries_close_at as string | null) ?? null,
            judgingEndsAt: (show.judging_ends_at as string | null) ?? null,
        },
        placings: placings.map((p) => ({
            entryId: p.entry_id as string,
            classId: p.class_id as string,
            place: (p.place as Place | null) ?? null,
            note: (p.note as string | null) ?? null,
        })),
        entries: liveEntries.map((e) => ({
            id: e.id as string,
            classId: e.class_id as string,
            horseId: e.horse_id as string,
            ownerId: e.owner_id as string,
        })),
        classes: classes.map((c) => ({ id: c.id, name: c.name, sectionId: c.section_id })),
        sections: sections.map((s) => ({ id: s.id, name: s.name, divisionId: s.division_id })),
        divisions,
        callbacks: (callbackRows ?? []).map((r) => ({
            scope: r.scope as CallbackScope,
            scopeId: (r.scope_id as string | null) ?? null,
            championEntryId: (r.champion_entry_id as string | null) ?? null,
            reserveEntryId: (r.reserve_entry_id as string | null) ?? null,
        })),
        existing: (existingRows ?? []).map(
            (r: { horse_id: string; class_name: string | null }) => ({
                horseId: r.horse_id,
                className: r.class_name,
            }),
        ),
        fallbackDate: new Date().toISOString().slice(0, 10),
    });

    if (rows.length > 0) {
        const { error: insertError } = await admin.from("show_records").insert(rows);
        if (insertError) return { error: insertError.message };
    }
    return { written: rows.length, skipped };
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

    // Live entries only — scratched rows are audit history, not volume.
    const { data: entryRows, error: entriesError } = await supabase
        .from("show_class_entries")
        .select("show_id, status")
        .in("show_id", showIds);
    if (entriesError) return { success: false, error: entriesError.message };
    const entryCounts = countBy(
        (entryRows ?? [])
            .filter((r: { status: string }) => r.status !== "scratched")
            .map((r: { show_id: string }) => ({ key: r.show_id })),
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
            "id, title, mode, judging, status, venue_name, venue_address, show_date, entries_open_at, entries_close_at, judging_ends_at, rules_md, fee_info, capacity, is_mhh_qualifying, sanctioning_note, blind_browsing, created_at",
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

    // ── Entries — ordered by arrival so the entrant table is stable ──
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, handler_id, entry_number, status")
        .eq("show_id", showId)
        .order("created_at", { ascending: true });
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

    // ── Assemble the tree (per-class counts = LIVE entries only;
    // scratched rows still show in the entrant table as history) ──
    const entryCountByClass = countBy(
        entries
            .filter((e) => e.status !== "scratched")
            .map((e) => ({ key: e.class_id as string })),
    );

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
                blindBrowsing: show.blind_browsing as boolean,
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

    // People type aliases with or without the @ prefix, and historical
    // accounts STORE alias_name inconsistently (some with a leading @ —
    // see the watermark double-@ bug). Normalize the query, then try
    // both stored forms. Lookup stays EXACT (case-insensitive):
    // escape LIKE wildcards so % and _ can't widen it.
    const normalized = parsed.data.alias.replace(/^@+/, "").trim();
    if (!normalized) return { success: false, error: "Enter an alias to look up." };
    const literal = normalized.replace(/[\\%_]/g, "\\$&");

    for (const candidate of [literal, `@${literal}`]) {
        const { data, error } = await supabase
            .from("users")
            .select("id, alias_name")
            .ilike("alias_name", candidate)
            .limit(1)
            .maybeSingle();
        if (error) return { success: false, error: error.message };
        if (data) {
            return {
                success: true,
                user: { id: data.id as string, alias: data.alias_name as string },
            };
        }
    }
    return { success: true, user: null };
}

// ══════════════════════════════════════════════════════════════
// Public reads — Phase D. These two run on the plain server
// client WITHOUT requireAuth: browse and the show page are
// anon-visible, and the RLS public-read policies (118) are the
// gate — drafts never come back.
// ══════════════════════════════════════════════════════════════

/**
 * Non-draft v2 shows for the /shows browse ledger, newest first.
 * Completed/archived shows drop off the browse list (their pages
 * stay reachable); draft is invisible by RLS and by the filter.
 */
export async function getPublicShows(): Promise<ActionResult<{ shows: PublicShowSummary[] }>> {
    const supabase = await createClient();

    const { data: showRows, error: showsError } = await supabase
        .from("shows")
        .select(
            "id, host_id, title, mode, judging, status, venue_name, show_date, entries_open_at, entries_close_at, judging_ends_at, is_mhh_qualifying, created_at",
        )
        .in("status", PUBLIC_BROWSE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(100);
    if (showsError) return { success: false, error: showsError.message };
    const shows = showRows ?? [];
    if (shows.length === 0) return { success: true, shows: [] };

    const showIds = shows.map((s) => s.id as string);

    // Class counts (enterable classes only) via the tree chain.
    const { data: divisionRows, error: dErr } = await supabase
        .from("show_divisions")
        .select("id, show_id")
        .in("show_id", showIds);
    if (dErr) return { success: false, error: dErr.message };
    const showByDivision = new Map(
        (divisionRows ?? []).map((d: { id: string; show_id: string }) => [d.id, d.show_id]),
    );

    const classCounts = new Map<string, number>();
    if (showByDivision.size > 0) {
        const { data: sectionRows, error: sErr } = await supabase
            .from("show_sections")
            .select("id, division_id")
            .in("division_id", [...showByDivision.keys()]);
        if (sErr) return { success: false, error: sErr.message };
        const showBySection = new Map(
            (sectionRows ?? []).map((s: { id: string; division_id: string }) => [
                s.id,
                showByDivision.get(s.division_id) ?? "",
            ]),
        );

        if (showBySection.size > 0) {
            const { data: classRows, error: cErr } = await supabase
                .from("show_classes")
                .select("id, section_id, status")
                .in("section_id", [...showBySection.keys()]);
            if (cErr) return { success: false, error: cErr.message };
            for (const c of classRows ?? []) {
                if (c.status === "cancelled" || c.status === "combined") continue;
                const showId = showBySection.get(c.section_id as string);
                if (showId) classCounts.set(showId, (classCounts.get(showId) ?? 0) + 1);
            }
        }
    }

    // Live entry counts (scratched rows are history, not volume).
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("show_id, status")
        .in("show_id", showIds);
    if (eErr) return { success: false, error: eErr.message };
    const entryCounts = countBy(
        (entryRows ?? [])
            .filter((r: { status: string }) => r.status !== "scratched")
            .map((r: { show_id: string }) => ({ key: r.show_id })),
    );

    const aliases = await getAliases(supabase, shows.map((s) => s.host_id as string));
    if (!(aliases instanceof Map)) return { success: false, error: aliases.error };

    return {
        success: true,
        shows: shows.map((s) => ({
            id: s.id as string,
            title: s.title as string,
            mode: s.mode as ShowMode,
            judging: s.judging as ShowJudging,
            status: s.status as ShowStatus,
            hostAlias: aliases.get(s.host_id as string) ?? "unknown",
            showDate: (s.show_date as string | null) ?? null,
            venueName: (s.venue_name as string | null) ?? null,
            entriesOpenAt: (s.entries_open_at as string | null) ?? null,
            entriesCloseAt: (s.entries_close_at as string | null) ?? null,
            judgingEndsAt: (s.judging_ends_at as string | null) ?? null,
            isMhhQualifying: s.is_mhh_qualifying as boolean,
            classCount: classCounts.get(s.id as string) ?? 0,
            entryCount: entryCounts.get(s.id as string) ?? 0,
            createdAt: s.created_at as string,
        })),
    };
}

/**
 * Everything the public /shows/v2/[id] page needs: the show
 * header, the classlist tree with live per-class entry counts,
 * and the host alias. Drafts and missing shows are one error —
 * the page notFound()s either way.
 */
export async function getPublicShow(
    input: z.input<typeof getPublicShowSchema>,
): Promise<
    ActionResult<{ show: PublicShow; divisions: ConsoleDivision[]; entryCount: number }>
> {
    const parsed = getPublicShowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const supabase = await createClient();
    const { showId } = parsed.data;

    const { data: show, error: showError } = await supabase
        .from("shows")
        .select(
            "id, host_id, title, mode, judging, status, venue_name, venue_address, show_date, entries_open_at, entries_close_at, judging_ends_at, rules_md, fee_info, capacity, is_mhh_qualifying, sanctioning_note",
        )
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { success: false, error: showError.message };
    // RLS hides drafts from the public, but staff can read their own
    // draft — the PUBLIC page still refuses it (the console is the
    // place for drafts).
    if (!show || show.status === "draft") return { success: false, error: "Show not found." };

    // ── Classlist tree (same three-query walk as the console) ──
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

    // ── Live entry counts per class ──
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("class_id, status")
        .eq("show_id", showId);
    if (eErr) return { success: false, error: eErr.message };
    const liveEntries = (entryRows ?? []).filter(
        (r: { status: string }) => r.status !== "scratched",
    );
    const entryCountByClass = countBy(
        liveEntries.map((r: { class_id: string }) => ({ key: r.class_id })),
    );

    const aliases = await getAliases(supabase, [show.host_id as string]);
    if (!(aliases instanceof Map)) return { success: false, error: aliases.error };

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

    return {
        success: true,
        show: {
            id: show.id as string,
            title: show.title as string,
            mode: show.mode as ShowMode,
            judging: show.judging as ShowJudging,
            status: show.status as ShowStatus,
            hostAlias: aliases.get(show.host_id as string) ?? "unknown",
            venueName: (show.venue_name as string | null) ?? null,
            venueAddress: (show.venue_address as string | null) ?? null,
            showDate: (show.show_date as string | null) ?? null,
            entriesOpenAt: (show.entries_open_at as string | null) ?? null,
            entriesCloseAt: (show.entries_close_at as string | null) ?? null,
            judgingEndsAt: (show.judging_ends_at as string | null) ?? null,
            rulesMd: (show.rules_md as string | null) ?? null,
            feeInfo: (show.fee_info as string | null) ?? null,
            capacity: (show.capacity as number | null) ?? null,
            isMhhQualifying: show.is_mhh_qualifying as boolean,
            sanctioningNote: (show.sanctioning_note as string | null) ?? null,
        },
        divisions,
        entryCount: liveEntries.length,
    };
}

// ══════════════════════════════════════════════════════════════
// Entrant flow — Phase D. zod → requireAuth → load the context
// validateEntry needs → surface ALL violations verbatim → INSERT
// (RLS from 118 is the backstop on every write).
// ══════════════════════════════════════════════════════════════

/** The viewer's entries at one show, for the My Entries panel. */
export async function getMyShowEntries(
    input: z.input<typeof getMyShowEntriesSchema>,
): Promise<ActionResult<{ entries: MyShowEntry[] }>> {
    const parsed = getMyShowEntriesSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();

    const { data: rows, error } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, handler_id, entry_number, status, photo_id, created_at")
        .eq("show_id", parsed.data.showId)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });
    if (error) return { success: false, error: error.message };
    const entries = rows ?? [];

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

    const aliases = await getAliases(
        supabase,
        entries.flatMap((e) => (e.handler_id ? [e.handler_id as string] : [])),
    );
    if (!(aliases instanceof Map)) return { success: false, error: aliases.error };

    // Result stamps — published results only. Provisional placings
    // (results_review) stay with the host until the show completes.
    const placeByEntry = new Map<string, Place>();
    if (entries.length > 0) {
        const { data: show } = await supabase
            .from("shows")
            .select("status")
            .eq("id", parsed.data.showId)
            .maybeSingle();
        if (show && RESULTS_STATUSES.includes(show.status as ShowStatus)) {
            const { data: placingRows, error: pErr } = await supabase
                .from("show_placings")
                .select("entry_id, place")
                .in("entry_id", entries.map((e) => e.id as string));
            if (pErr) return { success: false, error: pErr.message };
            for (const p of placingRows ?? []) {
                if (p.place !== null) {
                    placeByEntry.set(p.entry_id as string, p.place as Place);
                }
            }
        }
    }

    return {
        success: true,
        entries: entries.map((e) => ({
            id: e.id as string,
            classId: e.class_id as string,
            horseId: e.horse_id as string,
            horseName: horseNames.get(e.horse_id as string) ?? "Unnamed horse",
            entryNumber: (e.entry_number as number | null) ?? null,
            status: e.status as EntryStatus,
            handlerAlias:
                e.handler_id && e.handler_id !== user.id
                    ? (aliases.get(e.handler_id as string) ?? "unknown")
                    : null,
            photoId: (e.photo_id as string | null) ?? null,
            place: placeByEntry.get(e.id as string) ?? null,
        })),
    };
}

/** The viewer's enterable horses (public, not deleted), for the entry dialog. */
export async function getMyEntrantHorses(): Promise<ActionResult<{ horses: EntrantHorse[] }>> {
    const { supabase, user } = await requireAuth();

    const { data: horseRows, error } = await supabase
        .from("user_horses")
        .select("id, custom_name, finish_type, catalog_items:catalog_id(scale)")
        .eq("owner_id", user.id)
        .eq("is_public", true)
        .is("deleted_at", null)
        .order("custom_name", { ascending: true });
    if (error) return { success: false, error: error.message };
    const horses = horseRows ?? [];

    // Primary thumbnails, same pattern as the legacy entry form.
    const horseIds = horses.map((h) => h.id as string);
    const thumbByHorse = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: images, error: iErr } = await supabase
            .from("horse_images")
            .select("horse_id, image_url, angle_profile")
            .in("horse_id", horseIds);
        if (iErr) return { success: false, error: iErr.message };
        for (const horseId of horseIds) {
            const mine = (images ?? []).filter((i) => i.horse_id === horseId);
            const primary = mine.find((i) => i.angle_profile === "Primary_Thumbnail") ?? mine[0];
            if (primary?.image_url) thumbByHorse.set(horseId, primary.image_url as string);
        }
    }

    return {
        success: true,
        horses: horses.map((h) => ({
            id: h.id as string,
            name: h.custom_name as string,
            thumbnailUrl: thumbByHorse.get(h.id as string) ?? null,
            // PostgREST returns the to-one catalog join as an object at
            // runtime; the client types it loosely, hence the cast.
            scale:
                ((h.catalog_items as unknown as { scale: string | null } | null)?.scale as
                    | string
                    | null) ?? null,
            finish: (h.finish_type as string | null) ?? null,
        })),
    };
}

/** enterClass failure carries the FULL violation list for the dialog. */
export type EnterClassResult =
    | { success: true; entryId: string; entryNumber: number }
    | { success: false; error: string; violations?: string[] };

/** Entry row + its class's division axis, via one nested select. */
interface ShowEntryWithAxis {
    class_id: string;
    horse_id: string;
    owner_id: string;
    status: string;
    entry_number: number | null;
    show_classes: {
        show_sections: { show_divisions: { axis: string } };
    };
}

/**
 * Enter one horse in one class — the core of Phase D.
 * Class-first: the UI picks the class, then the horse (and photo
 * for online shows, handler for proxy showing). All rule checks
 * live in src/lib/shows/entryRules.validateEntry; this action only
 * loads its context and persists on success.
 */
export async function enterClass(
    input: z.input<typeof enterClassSchema>,
): Promise<EnterClassResult> {
    const parsed = enterClassSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    // ── Target class + its division axis + the show ──
    const { data: cls, error: cErr } = await supabase
        .from("show_classes")
        .select("id, section_id, status, max_per_entrant, allowed_scales, allowed_finishes")
        .eq("id", v.classId)
        .maybeSingle();
    if (cErr) return { success: false, error: cErr.message };
    if (!cls) return { success: false, error: "Class not found." };

    const { data: section, error: sErr } = await supabase
        .from("show_sections")
        .select("id, division_id")
        .eq("id", cls.section_id as string)
        .maybeSingle();
    if (sErr) return { success: false, error: sErr.message };
    if (!section) return { success: false, error: "Section not found." };

    const { data: division, error: dErr } = await supabase
        .from("show_divisions")
        .select("id, show_id, axis")
        .eq("id", section.division_id as string)
        .maybeSingle();
    if (dErr) return { success: false, error: dErr.message };
    if (!division) return { success: false, error: "Division not found." };

    const showId = division.show_id as string;
    const { data: show, error: shErr } = await supabase
        .from("shows")
        .select("id, mode, status, entries_close_at")
        .eq("id", showId)
        .maybeSingle();
    if (shErr) return { success: false, error: shErr.message };
    if (!show) return { success: false, error: "Show not found." };

    // ── The horse: ownership, visibility, scale/finish facts ──
    const { data: horse, error: hErr } = await supabase
        .from("user_horses")
        .select("id, owner_id, is_public, deleted_at, finish_type, catalog_items:catalog_id(scale)")
        .eq("id", v.horseId)
        .maybeSingle();
    if (hErr) return { success: false, error: hErr.message };
    if (!horse || horse.deleted_at) return { success: false, error: "Horse not found." };
    if (!horse.is_public) {
        return {
            success: false,
            error: "Only public horses can be entered — make this horse public in your stable first.",
        };
    }

    // ── Everything already entered at this show (rule context).
    // One nested select so each entry carries its class's division
    // axis — the halter-declaration rule needs it. ──
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select(
            "class_id, horse_id, owner_id, status, entry_number, show_classes!inner(show_sections!inner(show_divisions!inner(axis)))",
        )
        .eq("show_id", showId);
    if (eErr) return { success: false, error: eErr.message };
    const allEntries = (entryRows ?? []) as unknown as ShowEntryWithAxis[];

    // ── The rules — surface EVERY violation verbatim ──
    const result = validateEntry({
        candidate: {
            horseId: v.horseId,
            ownerId: user.id,
            handlerId: v.handlerId && v.handlerId !== user.id ? v.handlerId : null,
            photoId: v.photoId ?? null,
        },
        horse: {
            id: horse.id as string,
            ownerId: horse.owner_id as string,
            scale:
                ((horse.catalog_items as unknown as { scale: string | null } | null)?.scale as
                    | string
                    | null) ?? null,
            finish: (horse.finish_type as string | null) ?? null,
        },
        show: {
            id: showId,
            mode: show.mode as ShowMode,
            status: show.status as ShowStatus,
            entriesCloseAt: (show.entries_close_at as string | null) ?? null,
        },
        targetClass: {
            id: cls.id as string,
            status: cls.status as ClassStatus,
            maxPerEntrant: (cls.max_per_entrant as number | null) ?? null,
            allowedScales: (cls.allowed_scales as string[] | null) ?? null,
            allowedFinishes: (cls.allowed_finishes as string[] | null) ?? null,
            divisionAxis: division.axis as DivisionAxis,
        },
        existingEntries: allEntries.map((e) => ({
            classId: e.class_id,
            horseId: e.horse_id,
            ownerId: e.owner_id,
            status: e.status as EntryStatus,
            divisionAxis: e.show_classes.show_sections.show_divisions
                .axis as DivisionAxis,
        })),
    });

    const violations = result.ok ? [] : [...result.errors];

    // ── Mode rules the domain fn treats as soft: online shows judge
    // a photo, so the entry needs one; live shows judge the model. ──
    let photoId: string | null = null;
    if (show.mode === "online") {
        if (!v.photoId) {
            violations.push(
                "Online shows judge a photo — pick one of this horse's photos for the entry.",
            );
        } else {
            const { data: photo, error: pErr } = await supabase
                .from("horse_images")
                .select("id, horse_id")
                .eq("id", v.photoId)
                .maybeSingle();
            if (pErr) return { success: false, error: pErr.message };
            if (!photo || photo.horse_id !== v.horseId) {
                violations.push("That photo does not belong to the selected horse.");
            } else {
                photoId = photo.id as string;
            }
        }
    }

    if (violations.length > 0) {
        return { success: false, error: violations.join(" "), violations };
    }

    // ── Entry number: the leg tag. The same horse keeps its number
    // across classes at one show (scratched rows keep theirs too, so
    // a re-entered horse gets its old tag back); a new horse takes
    // max+1 across the show. Two entrants submitting in the same
    // instant can race to the same number — acceptable at beta
    // scale: numbers are labels, not keys, and hosts can renumber. ──
    const existingNumber = allEntries.find(
        (e) => e.horse_id === v.horseId && e.entry_number !== null,
    )?.entry_number;
    const entryNumber =
        existingNumber ??
        Math.max(0, ...allEntries.map((e) => e.entry_number ?? 0)) + 1;

    const { data: inserted, error: insertError } = await supabase
        .from("show_class_entries")
        .insert({
            show_id: showId,
            class_id: v.classId,
            horse_id: v.horseId,
            owner_id: user.id,
            handler_id: v.handlerId && v.handlerId !== user.id ? v.handlerId : null,
            entry_number: entryNumber,
            photo_id: photoId,
            status: "entered",
        })
        .select("id")
        .single();
    if (insertError || !inserted) {
        return {
            success: false,
            // 23505 = the partial unique index (one LIVE row per
            // class+horse) — someone double-clicked or double-tabbed.
            error:
                insertError?.code === "23505"
                    ? "This horse is already entered in this class."
                    : insertError?.message ?? "Failed to enter the class.",
        };
    }

    return { success: true, entryId: inserted.id as string, entryNumber };
}

/**
 * Scratch an entry (owner, while entries are open — the RLS UPDATE
 * policy is the backstop). Scratched rows are history: re-entering
 * afterwards creates a NEW row (partial unique index, 117), which
 * is why the UI says "Scratch" / "Re-enter" rather than "undo".
 */
export async function scratchEntry(
    input: z.input<typeof scratchEntrySchema>,
): Promise<ActionResult> {
    const parsed = scratchEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();

    const { data: entry, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, owner_id, status, show_id")
        .eq("id", parsed.data.entryId)
        .maybeSingle();
    if (eErr) return { success: false, error: eErr.message };
    if (!entry) return { success: false, error: "Entry not found." };
    if (entry.owner_id !== user.id) {
        return { success: false, error: "Only the entry's owner can scratch it." };
    }
    if (entry.status === "scratched") {
        return { success: false, error: "This entry is already scratched." };
    }

    const { data: show, error: sErr } = await supabase
        .from("shows")
        .select("id, status")
        .eq("id", entry.show_id as string)
        .maybeSingle();
    if (sErr) return { success: false, error: sErr.message };
    if (!show || show.status !== "entries_open") {
        return {
            success: false,
            error: "Entries are closed — ask the host to scratch this entry for you.",
        };
    }

    const { error: uErr } = await supabase
        .from("show_class_entries")
        .update({ status: "scratched" })
        .eq("id", parsed.data.entryId)
        .eq("owner_id", user.id);
    if (uErr) return { success: false, error: uErr.message };
    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// Online judging — Phase E1. The entry gallery (blind rule
// enforced HERE, server-side — a blind payload simply does not
// contain owner identities), community voting, the judge queue,
// and the community-vote finalizer.
// ══════════════════════════════════════════════════════════════

/**
 * THE ENTRY GALLERY read — public, anon included; online shows
 * only, visible from entries_open onward.
 *
 * BLIND RULE (server-enforced): while the show sits before
 * results_review AND blind_browsing is on, owner aliases/ids are
 * NOT queried and NOT included in the payload. Blindness is a
 * property of the data, never of the CSS.
 */
export async function getShowGallery(
    input: z.input<typeof getShowGallerySchema>,
): Promise<ActionResult<{ gallery: ShowGalleryData }>> {
    const parsed = getShowGallerySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const supabase = await createClient();
    const { showId } = parsed.data;

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, mode, status, judging, blind_browsing")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { success: false, error: showError.message };
    if (!show || show.status === "draft") return { success: false, error: "Show not found." };
    if (show.mode !== "online") {
        // Live shows have no entry photos by design — their
        // spectator moment is the published results.
        return { success: false, error: "Live shows have no entry gallery." };
    }
    const status = show.status as ShowStatus;
    if (!GALLERY_STATUSES.includes(status)) {
        return { success: false, error: "The entry gallery opens when entries open." };
    }

    const tree = await loadClassContexts(supabase, showId);
    if ("error" in tree) return { success: false, error: tree.error };
    const { contexts } = tree;

    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, entry_number, photo_id, status, created_at")
        .eq("show_id", showId)
        .order("created_at", { ascending: true });
    if (eErr) return { success: false, error: eErr.message };
    const entries = (entryRows ?? []).filter(
        (e: { status: string }) => e.status !== "scratched",
    );

    const photoUrls = await getEntryPhotoUrls(
        supabase,
        entries.flatMap((e) => (e.photo_id ? [e.photo_id as string] : [])),
    );
    if (!(photoUrls instanceof Map)) return { success: false, error: photoUrls.error };

    const horseNames = await getHorseNames(
        supabase,
        entries.map((e) => e.horse_id as string),
    );
    if (!(horseNames instanceof Map)) return { success: false, error: horseNames.error };

    // ── Votes (community-vote shows only) ──
    const votingEnabled = show.judging === "community_vote";
    const voteCounts = new Map<string, number>();
    const viewerVotes = new Set<string>();
    if (votingEnabled && entries.length > 0) {
        const { data: voteRows, error: vErr } = await supabase
            .from("show_entry_votes")
            .select("entry_id, voter_id")
            .in("entry_id", entries.map((e) => e.id as string));
        if (vErr) return { success: false, error: vErr.message };
        for (const v of voteRows ?? []) {
            const entryId = v.entry_id as string;
            voteCounts.set(entryId, (voteCounts.get(entryId) ?? 0) + 1);
            if (user && v.voter_id === user.id) viewerVotes.add(entryId);
        }
    }

    // ── Published placings (completed shows — the RESULTS view) ──
    const resultsPublished = RESULTS_STATUSES.includes(status);
    const placeByEntry = new Map<string, Place>();
    if (resultsPublished && entries.length > 0) {
        const { data: placingRows, error: pErr } = await supabase
            .from("show_placings")
            .select("entry_id, place")
            .in("entry_id", entries.map((e) => e.id as string));
        if (pErr) return { success: false, error: pErr.message };
        for (const p of placingRows ?? []) {
            if (p.place !== null) placeByEntry.set(p.entry_id as string, p.place as Place);
        }
    }

    // ── The blind rule: aliases are fetched ONLY when revealed ──
    const revealed = isOwnerRevealed(status, show.blind_browsing as boolean);
    let aliases = new Map<string, string>();
    if (revealed) {
        const loaded = await getAliases(supabase, entries.map((e) => e.owner_id as string));
        if (!(loaded instanceof Map)) return { success: false, error: loaded.error };
        aliases = loaded;
    }

    const entriesByClass = new Map<string, GalleryEntry[]>();
    for (const e of entries) {
        const entryId = e.id as string;
        const ownerId = e.owner_id as string;
        const list = entriesByClass.get(e.class_id as string) ?? [];
        list.push({
            id: entryId,
            horseName: horseNames.get(e.horse_id as string) ?? "Unnamed horse",
            entryNumber: (e.entry_number as number | null) ?? null,
            photoUrl: e.photo_id ? (photoUrls.get(e.photo_id as string) ?? null) : null,
            ownerAlias: revealed ? (aliases.get(ownerId) ?? "unknown") : null,
            ownerId: revealed ? ownerId : null,
            voteCount: voteCounts.get(entryId) ?? 0,
            viewerHasVoted: viewerVotes.has(entryId),
            isOwn: !!user && ownerId === user.id,
            place: placeByEntry.get(entryId) ?? null,
        });
        entriesByClass.set(e.class_id as string, list);
    }

    // Placed entries lead once results publish; otherwise arrival order.
    if (resultsPublished) {
        for (const list of entriesByClass.values()) {
            list.sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
        }
    }

    const classes: GalleryClass[] = contexts
        .filter((ctx) => (entriesByClass.get(ctx.classId)?.length ?? 0) > 0)
        .map((ctx) => ({
            classId: ctx.classId,
            className: ctx.className,
            classNumber: ctx.classNumber,
            divisionName: ctx.divisionName,
            sectionName: ctx.sectionName,
            classStatus: ctx.status,
            entries: entriesByClass.get(ctx.classId) ?? [],
        }));

    return {
        success: true,
        gallery: {
            votingEnabled,
            votingOpen: votingEnabled && status === "judging",
            revealed,
            resultsPublished,
            classes,
        },
    };
}

// ── Community voting ──

/** Entry + show context for the vote actions. */
async function getVoteContext(
    supabase: SupabaseClient,
    entryId: string,
): Promise<
    | {
          entry: { id: string; owner_id: string; status: string; show_id: string };
          show: { status: ShowStatus; judging: ShowJudging };
      }
    | { error: string }
> {
    const { data: entry, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, owner_id, status, show_id")
        .eq("id", entryId)
        .maybeSingle();
    if (eErr) return { error: eErr.message };
    if (!entry) return { error: "Entry not found." };

    const { data: show, error: sErr } = await supabase
        .from("shows")
        .select("status, judging")
        .eq("id", entry.show_id as string)
        .maybeSingle();
    if (sErr) return { error: sErr.message };
    if (!show) return { error: "Show not found." };

    return {
        entry: entry as { id: string; owner_id: string; status: string; show_id: string },
        show: { status: show.status as ShowStatus, judging: show.judging as ShowJudging },
    };
}

/**
 * Cast a community vote — one per user per entry, never your own.
 * The RLS policies from migration 119 are the backstop for every
 * check made here.
 */
export async function castVote(
    input: z.input<typeof castVoteSchema>,
): Promise<ActionResult> {
    const parsed = castVoteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();

    const ctx = await getVoteContext(supabase, parsed.data.entryId);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (ctx.show.judging !== "community_vote") {
        return {
            success: false,
            error: "This show is expert-judged — there is no community voting.",
        };
    }
    if (ctx.show.status !== "judging") {
        return { success: false, error: "Voting is only open while the show is judging." };
    }
    if (ctx.entry.status === "scratched") {
        return { success: false, error: "This entry was scratched." };
    }
    if (ctx.entry.owner_id === user.id) {
        return { success: false, error: "You can't vote for your own entry." };
    }

    const { error } = await supabase
        .from("show_entry_votes")
        .insert({ entry_id: parsed.data.entryId, voter_id: user.id });
    if (error) {
        return {
            success: false,
            error:
                error.code === "23505"
                    ? "You already voted for this entry."
                    : error.message,
        };
    }
    return { success: true };
}

/** Remove your own vote while voting is still open. */
export async function removeVote(
    input: z.input<typeof removeVoteSchema>,
): Promise<ActionResult> {
    const parsed = removeVoteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();

    const ctx = await getVoteContext(supabase, parsed.data.entryId);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (ctx.show.status !== "judging") {
        return { success: false, error: "Voting has closed — the tally is frozen." };
    }

    const { error } = await supabase
        .from("show_entry_votes")
        .delete()
        .eq("entry_id", parsed.data.entryId)
        .eq("voter_id", user.id);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── The judge queue ──

/** Roles that may open the judge queue (the judge's bench;
 *  stewards work the entries panel). */
const JUDGE_QUEUE_ROLES: StaffRole[] = ["host", "co_host", "judge"];

/** Roles that may record placings — matches the RLS policy (118). */
const PLACING_RECORDER_ROLES: StaffRole[] = ["host", "co_host", "steward", "judge"];

/**
 * Everything the /shows/host/[id]/judge queue needs. Staff-gated
 * (judge/host/co_host). The blind rule applies to judges too —
 * the digital leg-tag convention: entry numbers, never names.
 */
export async function getJudgeQueue(
    input: z.input<typeof getJudgeQueueSchema>,
): Promise<ActionResult<{ queue: JudgeQueueData }>> {
    const parsed = getJudgeQueueSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { showId } = parsed.data;

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !JUDGE_QUEUE_ROLES.includes(ctx.role)) {
        return {
            success: false,
            error: "Only the judge, host, or a co-host can open the judge queue.",
        };
    }
    if (ctx.show.mode !== "online") {
        return {
            success: false,
            error: "The judge queue is for online shows — live shows use the ring console.",
        };
    }
    if (ctx.show.judging !== "judged") {
        return {
            success: false,
            error: "This show is judged by community vote — there is no judge queue.",
        };
    }

    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, title, status, judging, blind_browsing")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { success: false, error: showError.message };
    if (!show) return { success: false, error: "Show not found." };

    const tree = await loadClassContexts(supabase, showId);
    if ("error" in tree) return { success: false, error: tree.error };
    const { contexts } = tree;

    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, entry_number, photo_id, status, created_at")
        .eq("show_id", showId)
        .order("created_at", { ascending: true });
    if (eErr) return { success: false, error: eErr.message };
    const entries = (entryRows ?? []).filter(
        (e: { status: string }) => e.status !== "scratched",
    );

    const photoUrls = await getEntryPhotoUrls(
        supabase,
        entries.flatMap((e) => (e.photo_id ? [e.photo_id as string] : [])),
    );
    if (!(photoUrls instanceof Map)) return { success: false, error: photoUrls.error };

    const horseNames = await getHorseNames(
        supabase,
        entries.map((e) => e.horse_id as string),
    );
    if (!(horseNames instanceof Map)) return { success: false, error: horseNames.error };

    // Recorded placings (resume / corrections).
    const placingByEntry = new Map<string, { place: Place | null; note: string | null }>();
    if (entries.length > 0) {
        const { data: placingRows, error: pErr } = await supabase
            .from("show_placings")
            .select("entry_id, place, note")
            .in("entry_id", entries.map((e) => e.id as string));
        if (pErr) return { success: false, error: pErr.message };
        for (const p of placingRows ?? []) {
            placingByEntry.set(p.entry_id as string, {
                place: (p.place as Place | null) ?? null,
                note: (p.note as string | null) ?? null,
            });
        }
    }

    // Blind judging: same server-side rule as the public gallery.
    const revealed = isOwnerRevealed(
        show.status as ShowStatus,
        show.blind_browsing as boolean,
    );
    let aliases = new Map<string, string>();
    if (revealed) {
        const loaded = await getAliases(supabase, entries.map((e) => e.owner_id as string));
        if (!(loaded instanceof Map)) return { success: false, error: loaded.error };
        aliases = loaded;
    }

    const entriesByClass = new Map<string, JudgeQueueClass["entries"]>();
    for (const e of entries) {
        const list = entriesByClass.get(e.class_id as string) ?? [];
        const recorded = placingByEntry.get(e.id as string);
        list.push({
            id: e.id as string,
            horseName: horseNames.get(e.horse_id as string) ?? "Unnamed horse",
            entryNumber: (e.entry_number as number | null) ?? null,
            photoUrl: e.photo_id ? (photoUrls.get(e.photo_id as string) ?? null) : null,
            ownerAlias: revealed ? (aliases.get(e.owner_id as string) ?? "unknown") : null,
            place: recorded?.place ?? null,
            note: recorded?.note ?? null,
        });
        entriesByClass.set(e.class_id as string, list);
    }

    const classes: JudgeQueueClass[] = contexts.map((c) => ({
        classId: c.classId,
        className: c.className,
        classNumber: c.classNumber,
        divisionId: c.divisionId,
        divisionName: c.divisionName,
        sectionId: c.sectionId,
        sectionName: c.sectionName,
        status: c.status,
        entries: entriesByClass.get(c.classId) ?? [],
    }));

    // Recorded callbacks — the championship round resumes from these.
    const { data: callbackRows, error: cbErr } = await supabase
        .from("show_callbacks")
        .select("scope, scope_id, champion_entry_id, reserve_entry_id")
        .eq("show_id", showId);
    if (cbErr) return { success: false, error: cbErr.message };

    return {
        success: true,
        queue: {
            show: {
                id: show.id as string,
                title: show.title as string,
                status: show.status as ShowStatus,
                judging: show.judging as ShowJudging,
                blindBrowsing: show.blind_browsing as boolean,
            },
            viewerRole: ctx.role,
            classes,
            sections: tree.sections,
            divisions: tree.divisions,
            callbacks: (callbackRows ?? []).map((r) => ({
                scope: r.scope as CallbackScope,
                scopeId: (r.scope_id as string | null) ?? null,
                championEntryId: (r.champion_entry_id as string | null) ?? null,
                reserveEntryId: (r.reserve_entry_id as string | null) ?? null,
            })),
        },
    };
}

/**
 * Record a whole class's placings in one batch (replace-all
 * semantics: the submitted slate IS the class's result). Roles
 * per RLS 118 (+ the judge class-status policy from 119). The
 * class auto-flips to 'judging' when recording starts and to
 * 'placed' when markDone is set — every flip runs through the
 * class state machine.
 */
export async function recordPlacings(
    input: z.input<typeof recordPlacingsSchema>,
): Promise<ActionResult<{ recorded: number }>> {
    const parsed = recordPlacingsSchema.safeParse(input);
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
    if (!ctx.role || !PLACING_RECORDER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only show staff can record placings." };
    }

    // The show must be in its judging phase (running for live shows).
    const recordingStatus: ShowStatus = ctx.show.mode === "online" ? "judging" : "running";
    if (ctx.show.status !== recordingStatus) {
        return {
            success: false,
            error:
                ctx.show.mode === "online"
                    ? "Placings can only be recorded while the show is judging."
                    : "Placings can only be recorded while the show is running.",
        };
    }

    let classStatus = cls.status as ClassStatus;
    if (classStatus === "cancelled" || classStatus === "combined") {
        return { success: false, error: `This class is ${classStatus} and cannot be placed.` };
    }

    // Every placed entry must be a LIVE entry of this class (the
    // 117 placing trigger is the backstop).
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, status")
        .eq("class_id", v.classId);
    if (eErr) return { success: false, error: eErr.message };
    const liveIds = new Set(
        (entryRows ?? [])
            .filter((e: { status: string }) => e.status !== "scratched")
            .map((e: { id: string }) => e.id as string),
    );
    for (const p of v.placings) {
        if (!liveIds.has(p.entryId)) {
            return {
                success: false,
                error: "One or more entries do not belong to this class (or were scratched).",
            };
        }
    }

    // Flip to 'judging' when recording starts (scheduled/called/
    // placed all legally reach judging via the class state machine).
    if (classStatus !== "judging") {
        const legal = canTransitionClass(classStatus, "judging");
        if (!legal.ok) return { success: false, error: legal.reason };
        const { error: flipError } = await supabase
            .from("show_classes")
            .update({ status: "judging" })
            .eq("id", v.classId);
        if (flipError) return { success: false, error: flipError.message };
        classStatus = "judging";
    }

    // Replace-all: clear the class's slate, then write the new one.
    const { error: clearError } = await supabase
        .from("show_placings")
        .delete()
        .eq("class_id", v.classId);
    if (clearError) return { success: false, error: clearError.message };

    if (v.placings.length > 0) {
        const { error: insertError } = await supabase.from("show_placings").insert(
            v.placings.map((p) => ({
                class_id: v.classId,
                entry_id: p.entryId,
                place: p.place,
                judge_id: user.id,
                note: p.note?.length ? p.note : null,
            })),
        );
        if (insertError) return { success: false, error: insertError.message };
    }

    if (v.markDone) {
        const legal = canTransitionClass(classStatus, "placed");
        if (!legal.ok) return { success: false, error: legal.reason };
        const { error: doneError } = await supabase
            .from("show_classes")
            .update({ status: "placed" })
            .eq("id", v.classId);
        if (doneError) return { success: false, error: doneError.message };
    }

    return { success: true, recorded: v.placings.length };
}

/**
 * Derive provisional placings from community votes — host/co-host
 * only, only in results_review. Top 6 per class by vote count,
 * ties broken by earliest entry (deriveVotePlacings is the single
 * source of those rules). Re-runnable: each run re-derives the
 * full slate from the frozen tally.
 */
export async function finalizeCommunityVotes(
    input: z.input<typeof finalizeCommunityVotesSchema>,
): Promise<ActionResult<{ classesPlaced: number; placingsWritten: number }>> {
    const parsed = finalizeCommunityVotesSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { showId } = parsed.data;

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !MANAGER_ROLES.includes(ctx.role)) {
        return {
            success: false,
            error: "Only the host or a co-host can finalize community votes.",
        };
    }
    if (ctx.show.judging !== "community_vote") {
        return {
            success: false,
            error: "This show is expert-judged — placings come from the judge queue.",
        };
    }
    if (ctx.show.status !== "results_review") {
        return {
            success: false,
            error: "Community votes are finalized in results review — move the show there first.",
        };
    }

    const tree = await loadClassContexts(supabase, showId);
    if ("error" in tree) return { success: false, error: tree.error };
    const { contexts } = tree;
    if (contexts.length === 0) return { success: true, classesPlaced: 0, placingsWritten: 0 };

    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, class_id, status, created_at")
        .eq("show_id", showId);
    if (eErr) return { success: false, error: eErr.message };
    const entries = (entryRows ?? []).filter(
        (e: { status: string }) => e.status !== "scratched",
    );
    if (entries.length === 0) return { success: true, classesPlaced: 0, placingsWritten: 0 };

    const { data: voteRows, error: vErr } = await supabase
        .from("show_entry_votes")
        .select("entry_id")
        .in("entry_id", entries.map((e) => e.id as string));
    if (vErr) return { success: false, error: vErr.message };
    const voteCounts = new Map<string, number>();
    for (const row of voteRows ?? []) {
        const entryId = row.entry_id as string;
        voteCounts.set(entryId, (voteCounts.get(entryId) ?? 0) + 1);
    }

    // Tally per class → deriveVotePlacings (the ONE rules function).
    const talliesByClass = new Map<string, VoteTally[]>();
    for (const e of entries) {
        const list = talliesByClass.get(e.class_id as string) ?? [];
        list.push({
            entryId: e.id as string,
            voteCount: voteCounts.get(e.id as string) ?? 0,
            createdAt: e.created_at as string,
        });
        talliesByClass.set(e.class_id as string, list);
    }

    const inserts: {
        class_id: string;
        entry_id: string;
        place: number;
        judge_id: string;
        note: null;
    }[] = [];
    let classesPlaced = 0;
    for (const context of contexts) {
        const derived = deriveVotePlacings(talliesByClass.get(context.classId) ?? []);
        if (derived.length === 0) continue;
        classesPlaced += 1;
        for (const d of derived) {
            inserts.push({
                class_id: context.classId,
                entry_id: d.entryId,
                place: d.place,
                judge_id: user.id,
                note: null,
            });
        }
    }

    // Re-derive from scratch each run: clear, then insert.
    const { error: clearError } = await supabase
        .from("show_placings")
        .delete()
        .in("class_id", contexts.map((c) => c.classId));
    if (clearError) return { success: false, error: clearError.message };

    if (inserts.length > 0) {
        const { error: insertError } = await supabase.from("show_placings").insert(inserts);
        if (insertError) return { success: false, error: insertError.message };
    }

    return { success: true, classesPlaced, placingsWritten: inserts.length };
}
