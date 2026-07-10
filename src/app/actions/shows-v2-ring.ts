"use server";

/**
 * Shows v2 server actions — Phase E2: the LIVE RING CONSOLE and
 * the callback (champion) ladder.
 *
 * Same conventions as shows-v2.ts: zod-parse → requireAuth (except
 * the two PUBLIC reads, which run anon on the RLS-gated server
 * client) → explicit role check → { success, error? }.
 *
 * RLS-first: no admin client anywhere in this file.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
    getRingBoardSchema,
    getRingConsoleSchema,
    getShowChampionsSchema,
    firstZodError,
    recordCallbackSchema,
} from "@/lib/shows/schemas";
import {
    getAliases,
    getHorseNames,
    getShowRole,
    loadClassContexts,
    type ClassContextTree,
} from "@/lib/shows/queries";
import {
    buildCallbackLadder,
    findLadderRound,
    validateCallbackSelection,
    type CallbackRecord,
    type LadderClass,
} from "@/lib/shows/callbacks";
import { RESULTS_STATUSES } from "@/lib/shows/gallery";
import {
    deriveRunOrder,
    type BoardResult,
    type ChampionAward,
    type ChampionEntry,
    type RingBoardData,
    type RingClass,
    type RingConsoleData,
    type ShowChampionsData,
} from "@/lib/shows/ring";
import type {
    CallbackScope,
    EntryStatus,
    Place,
    ShowMode,
    ShowStatus,
    StaffRole,
} from "@/lib/shows/types";

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

/** Everyone who works the table may open the ring console and
 *  record callbacks — matches the RLS policy on show_callbacks (118). */
const RING_ROLES: StaffRole[] = ["host", "co_host", "steward", "judge"];

// ── Shared loaders ──

interface LiveEntryRow {
    id: string;
    class_id: string;
    horse_id: string;
    owner_id: string;
    entry_number: number | null;
    status: string;
}

/** Live (non-scratched) entries of the show, arrival-ordered. */
async function loadLiveEntries(
    supabase: SupabaseClient,
    showId: string,
): Promise<LiveEntryRow[] | { error: string }> {
    const { data, error } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, entry_number, status, created_at")
        .eq("show_id", showId)
        .order("created_at", { ascending: true });
    if (error) return { error: error.message };
    return ((data ?? []) as (LiveEntryRow & { created_at: string })[]).filter(
        (e) => e.status !== "scratched",
    );
}

/** place + recency per entry across the given classes. */
async function loadPlacings(
    supabase: SupabaseClient,
    classIds: string[],
): Promise<
    | { byEntry: Map<string, Place>; latestByClass: Map<string, string> }
    | { error: string }
> {
    const byEntry = new Map<string, Place>();
    const latestByClass = new Map<string, string>();
    if (classIds.length === 0) return { byEntry, latestByClass };
    const { data, error } = await supabase
        .from("show_placings")
        .select("entry_id, class_id, place, created_at")
        .in("class_id", classIds);
    if (error) return { error: error.message };
    for (const p of data ?? []) {
        if (p.place !== null) byEntry.set(p.entry_id as string, p.place as Place);
        const classId = p.class_id as string;
        const at = p.created_at as string;
        const prev = latestByClass.get(classId);
        if (!prev || at > prev) latestByClass.set(classId, at);
    }
    return { byEntry, latestByClass };
}

async function loadCallbacks(
    supabase: SupabaseClient,
    showId: string,
): Promise<CallbackRecord[] | { error: string }> {
    const { data, error } = await supabase
        .from("show_callbacks")
        .select("scope, scope_id, champion_entry_id, reserve_entry_id")
        .eq("show_id", showId);
    if (error) return { error: error.message };
    return (data ?? []).map((r) => ({
        scope: r.scope as CallbackScope,
        scopeId: (r.scope_id as string | null) ?? null,
        championEntryId: (r.champion_entry_id as string | null) ?? null,
        reserveEntryId: (r.reserve_entry_id as string | null) ?? null,
    }));
}

/** tree + entries + placings → the ladder's class inputs. */
function toLadderClasses(
    tree: ClassContextTree,
    entries: LiveEntryRow[],
    placeByEntry: Map<string, Place>,
): LadderClass[] {
    const entriesByClass = new Map<string, { id: string; place: Place | null }[]>();
    for (const e of entries) {
        const list = entriesByClass.get(e.class_id) ?? [];
        list.push({ id: e.id, place: placeByEntry.get(e.id) ?? null });
        entriesByClass.set(e.class_id, list);
    }
    return tree.contexts.map((c) => ({
        classId: c.classId,
        sectionId: c.sectionId,
        divisionId: c.divisionId,
        status: c.status,
        entries: entriesByClass.get(c.classId) ?? [],
    }));
}

// ══════════════════════════════════════════════════════════════
// The ring console read — /shows/host/[id]/ring
// ══════════════════════════════════════════════════════════════

/**
 * Everything the ring console needs in one call. Staff-gated
 * (host/co-host/steward/judge); LIVE shows only — online shows
 * judge from the queue. Any status is readable: the console
 * itself renders run-of-day guidance when the show isn't running.
 */
export async function getRingConsole(
    input: z.input<typeof getRingConsoleSchema>,
): Promise<ActionResult<{ console: RingConsoleData }>> {
    const parsed = getRingConsoleSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { showId } = parsed.data;

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !RING_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only show staff can open the ring console." };
    }
    if (ctx.show.mode !== "live") {
        return {
            success: false,
            error: "The ring console is for live shows — online shows judge from the judge queue.",
        };
    }

    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, title, mode, status, venue_name, show_date")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { success: false, error: showError.message };
    if (!show) return { success: false, error: "Show not found." };

    const tree = await loadClassContexts(supabase, showId);
    if ("error" in tree) return { success: false, error: tree.error };

    const entries = await loadLiveEntries(supabase, showId);
    if ("error" in entries) return { success: false, error: entries.error };

    const horseNames = await getHorseNames(supabase, entries.map((e) => e.horse_id));
    if (!(horseNames instanceof Map)) return { success: false, error: horseNames.error };

    const placings = await loadPlacings(
        supabase,
        tree.contexts.map((c) => c.classId),
    );
    if ("error" in placings) return { success: false, error: placings.error };

    const callbacks = await loadCallbacks(supabase, showId);
    if ("error" in callbacks) return { success: false, error: callbacks.error };

    const entriesByClass = new Map<string, LiveEntryRow[]>();
    for (const e of entries) {
        const list = entriesByClass.get(e.class_id) ?? [];
        list.push(e);
        entriesByClass.set(e.class_id, list);
    }

    const classes: RingClass[] = tree.contexts.map((c) => ({
        classId: c.classId,
        className: c.className,
        classNumber: c.classNumber,
        status: c.status,
        sectionId: c.sectionId,
        sectionName: c.sectionName,
        divisionId: c.divisionId,
        divisionName: c.divisionName,
        entries: (entriesByClass.get(c.classId) ?? []).map((e) => ({
            id: e.id,
            entryNumber: e.entry_number,
            horseName: horseNames.get(e.horse_id) ?? "Unnamed horse",
            place: placings.byEntry.get(e.id) ?? null,
        })),
    }));

    return {
        success: true,
        console: {
            show: {
                id: show.id as string,
                title: show.title as string,
                mode: show.mode as ShowMode,
                status: show.status as ShowStatus,
                venueName: (show.venue_name as string | null) ?? null,
                showDate: (show.show_date as string | null) ?? null,
            },
            viewerRole: ctx.role,
            classes,
            sections: tree.sections,
            divisions: tree.divisions,
            callbacks,
        },
    };
}

// ══════════════════════════════════════════════════════════════
// recordCallback — the champion ladder write
// ══════════════════════════════════════════════════════════════

/**
 * Record one callback round (champion + optional reserve). The
 * ladder is re-derived server-side from freshly loaded rows, so:
 *   - section champions must be entries placed 1st in that section,
 *   - division champions must be that division's section champions,
 *   - the grand champion must be a division champion,
 *   - a round only opens when everything below it is decided.
 * One row per (show, scope, scope_id): re-recording replaces the
 * pick — corrections at the table stay legal. The 117 trigger
 * (same-show integrity) and 118 RLS are the backstops.
 */
export async function recordCallback(
    input: z.input<typeof recordCallbackSchema>,
): Promise<ActionResult> {
    const parsed = recordCallbackSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const ctx = await getShowRole(supabase, v.showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !RING_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only show staff can record callbacks." };
    }

    // Callbacks are recorded while judging happens: 'running' for
    // live shows, 'judging' for online — mirrors recordPlacings.
    const recordingStatus: ShowStatus = ctx.show.mode === "online" ? "judging" : "running";
    if (ctx.show.status !== recordingStatus) {
        return {
            success: false,
            error:
                ctx.show.mode === "online"
                    ? "Callbacks can only be recorded while the show is judging."
                    : "Callbacks can only be recorded while the show is running.",
        };
    }

    const tree = await loadClassContexts(supabase, v.showId);
    if ("error" in tree) return { success: false, error: tree.error };

    const entries = await loadLiveEntries(supabase, v.showId);
    if ("error" in entries) return { success: false, error: entries.error };

    const placings = await loadPlacings(
        supabase,
        tree.contexts.map((c) => c.classId),
    );
    if ("error" in placings) return { success: false, error: placings.error };

    const callbacks = await loadCallbacks(supabase, v.showId);
    if ("error" in callbacks) return { success: false, error: callbacks.error };

    const ladder = buildCallbackLadder({
        classes: toLadderClasses(tree, entries, placings.byEntry),
        sections: tree.sections,
        divisions: tree.divisions,
        callbacks,
    });

    const scopeId = v.scope === "show" ? null : (v.scopeId as string);
    const round = findLadderRound(ladder, v.scope, scopeId);
    if (!round) {
        return {
            success: false,
            error:
                v.scope === "section"
                    ? "That section does not belong to this show (or has no classes)."
                    : v.scope === "division"
                      ? "That division does not belong to this show (or has no classes)."
                      : "This show has no divisions to call back.",
        };
    }

    const legal = validateCallbackSelection(
        round,
        v.championEntryId,
        v.reserveEntryId ?? null,
    );
    if (!legal.ok) return { success: false, error: legal.reason };

    // One row per round: update in place when it exists (corrections),
    // insert otherwise. The (scope, scope_id) pair has no unique
    // index, so we look the row up first — staff volumes make a race
    // here vanishingly rare, and a duplicate would only mean the
    // newest row wins at read time (loadCallbacks takes them in order).
    let existing = supabase
        .from("show_callbacks")
        .select("id")
        .eq("show_id", v.showId)
        .eq("scope", v.scope);
    existing =
        scopeId === null ? existing.is("scope_id", null) : existing.eq("scope_id", scopeId);
    const { data: existingRow, error: exErr } = await existing.maybeSingle();
    if (exErr) return { success: false, error: exErr.message };

    if (existingRow) {
        const { error } = await supabase
            .from("show_callbacks")
            .update({
                champion_entry_id: v.championEntryId,
                reserve_entry_id: v.reserveEntryId ?? null,
                judge_id: user.id,
            })
            .eq("id", existingRow.id as string);
        if (error) return { success: false, error: error.message };
    } else {
        const { error } = await supabase.from("show_callbacks").insert({
            show_id: v.showId,
            scope: v.scope,
            scope_id: scopeId,
            champion_entry_id: v.championEntryId,
            reserve_entry_id: v.reserveEntryId ?? null,
            judge_id: user.id,
        });
        if (error) return { success: false, error: error.message };
    }

    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// PUBLIC reads — the announcer board and the champions ladder.
// No requireAuth: both run on the anon-capable server client and
// the 118 public-read policies are the gate. They expose only
// class names and placed results — public data on the results
// page anyway.
// ══════════════════════════════════════════════════════════════

/**
 * The announcer board — /shows/host/[id]/ring/board. Meant to be
 * PROJECTED at the venue, so it is deliberately public: live shows
 * only, any non-draft status (the board itself renders a quiet
 * state outside 'running').
 */
export async function getRingBoard(
    input: z.input<typeof getRingBoardSchema>,
): Promise<ActionResult<{ board: RingBoardData }>> {
    const parsed = getRingBoardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const supabase = await createClient();
    const { showId } = parsed.data;

    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, title, mode, status")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { success: false, error: showError.message };
    if (!show || show.status === "draft") return { success: false, error: "Show not found." };
    if (show.mode !== "live") {
        return { success: false, error: "The announcer board is for live shows." };
    }

    const tree = await loadClassContexts(supabase, showId);
    if ("error" in tree) return { success: false, error: tree.error };
    const { contexts } = tree;

    const placings = await loadPlacings(
        supabase,
        contexts.map((c) => c.classId),
    );
    if ("error" in placings) return { success: false, error: placings.error };

    const entries = await loadLiveEntries(supabase, showId);
    if ("error" in entries) return { success: false, error: entries.error };

    // Horse names only for entries the board actually shows (the
    // placed ones) — the board never lists unplaced entries.
    const placedEntryIds = new Set([...placings.byEntry.keys()]);
    const placedEntries = entries.filter((e) => placedEntryIds.has(e.id));
    const horseNames = await getHorseNames(
        supabase,
        placedEntries.map((e) => e.horse_id),
    );
    if (!(horseNames instanceof Map)) return { success: false, error: horseNames.error };
    const entryById = new Map(placedEntries.map((e) => [e.id, e]));

    const { currentIndex, onDeckIndex } = deriveRunOrder(contexts);
    const toRef = (i: number | null) =>
        i === null
            ? null
            : {
                  classNumber: contexts[i].classNumber,
                  className: contexts[i].className,
                  sectionName: contexts[i].sectionName,
                  divisionName: contexts[i].divisionName,
              };

    // Latest placed classes, newest placing first, capped for the wall.
    const placedContexts = contexts
        .filter((c) => c.status === "placed")
        .sort(
            (a, b) =>
                (placings.latestByClass.get(b.classId) ?? "").localeCompare(
                    placings.latestByClass.get(a.classId) ?? "",
                ),
        )
        .slice(0, 4);

    const entriesByClass = new Map<string, LiveEntryRow[]>();
    for (const e of placedEntries) {
        const list = entriesByClass.get(e.class_id) ?? [];
        list.push(e);
        entriesByClass.set(e.class_id, list);
    }

    const latestResults: BoardResult[] = placedContexts.map((c) => ({
        classNumber: c.classNumber,
        className: c.className,
        sectionName: c.sectionName,
        divisionName: c.divisionName,
        placings: (entriesByClass.get(c.classId) ?? [])
            .flatMap((e) => {
                const place = placings.byEntry.get(e.id);
                if (!place) return [];
                return [
                    {
                        place,
                        entryNumber: e.entry_number,
                        horseName:
                            horseNames.get((entryById.get(e.id) as LiveEntryRow).horse_id) ??
                            "Unnamed horse",
                    },
                ];
            })
            .sort((a, b) => a.place - b.place),
    }));

    return {
        success: true,
        board: {
            show: {
                id: show.id as string,
                title: show.title as string,
                status: show.status as ShowStatus,
            },
            nowJudging: toRef(currentIndex),
            onDeck: toRef(onDeckIndex),
            placedCount: contexts.filter((c) => c.status === "placed").length,
            totalCount: contexts.length,
            latestResults,
        },
    };
}

/**
 * The champions ladder for the PUBLIC results view — published
 * results only (completed/archived): champions are provisional
 * until the host publishes, exactly like class placings.
 */
export async function getShowChampions(
    input: z.input<typeof getShowChampionsSchema>,
): Promise<ActionResult<{ champions: ShowChampionsData }>> {
    const parsed = getShowChampionsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const supabase = await createClient();
    const { showId } = parsed.data;

    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, title, status")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { success: false, error: showError.message };
    if (!show || show.status === "draft") return { success: false, error: "Show not found." };
    if (!RESULTS_STATUSES.includes(show.status as ShowStatus)) {
        return { success: false, error: "Champions publish with the show's results." };
    }

    const callbacks = await loadCallbacks(supabase, showId);
    if ("error" in callbacks) return { success: false, error: callbacks.error };
    if (callbacks.length === 0) {
        return {
            success: true,
            champions: { sections: [], divisions: [], show: null },
        };
    }

    const tree = await loadClassContexts(supabase, showId);
    if ("error" in tree) return { success: false, error: tree.error };

    // Entry facts for every referenced champion/reserve.
    const entryIds = [
        ...new Set(
            callbacks.flatMap((c) =>
                [c.championEntryId, c.reserveEntryId].filter((id): id is string => !!id),
            ),
        ),
    ];
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, horse_id, owner_id, entry_number, status")
        .in("id", entryIds);
    if (eErr) return { success: false, error: eErr.message };
    const entryById = new Map(
        ((entryRows ?? []) as {
            id: string;
            horse_id: string;
            owner_id: string;
            entry_number: number | null;
            status: EntryStatus;
        }[]).map((e) => [e.id, e]),
    );

    const horseNames = await getHorseNames(
        supabase,
        [...entryById.values()].map((e) => e.horse_id),
    );
    if (!(horseNames instanceof Map)) return { success: false, error: horseNames.error };

    // Results are published — owner identities are public.
    const aliases = await getAliases(
        supabase,
        [...entryById.values()].map((e) => e.owner_id),
    );
    if (!(aliases instanceof Map)) return { success: false, error: aliases.error };

    const toChampionEntry = (entryId: string | null): ChampionEntry | null => {
        if (!entryId) return null;
        const entry = entryById.get(entryId);
        if (!entry) return null;
        return {
            entryId,
            horseName: horseNames.get(entry.horse_id) ?? "Unnamed horse",
            entryNumber: entry.entry_number,
            ownerAlias: aliases.get(entry.owner_id) ?? null,
        };
    };

    const divisionById = new Map(tree.divisions.map((d) => [d.id, d]));

    // Ladder order follows the classlist: sections/divisions in
    // their published sort, the show award last.
    const sections: ChampionAward[] = tree.sections.flatMap((section) => {
        const cb = callbacks.find((c) => c.scope === "section" && c.scopeId === section.id);
        if (!cb || (!cb.championEntryId && !cb.reserveEntryId)) return [];
        return [
            {
                scope: "section" as const,
                scopeLabel: section.name,
                divisionName: divisionById.get(section.divisionId)?.name ?? null,
                champion: toChampionEntry(cb.championEntryId),
                reserve: toChampionEntry(cb.reserveEntryId),
            },
        ];
    });

    const divisions: ChampionAward[] = tree.divisions.flatMap((division) => {
        const cb = callbacks.find((c) => c.scope === "division" && c.scopeId === division.id);
        if (!cb || (!cb.championEntryId && !cb.reserveEntryId)) return [];
        return [
            {
                scope: "division" as const,
                scopeLabel: division.name,
                divisionName: null,
                champion: toChampionEntry(cb.championEntryId),
                reserve: toChampionEntry(cb.reserveEntryId),
            },
        ];
    });

    const showCb = callbacks.find((c) => c.scope === "show");
    const showAward: ChampionAward | null =
        showCb && (showCb.championEntryId || showCb.reserveEntryId)
            ? {
                  scope: "show",
                  scopeLabel: show.title as string,
                  divisionName: null,
                  champion: toChampionEntry(showCb.championEntryId),
                  reserve: toChampionEntry(showCb.reserveEntryId),
              }
            : null;

    return {
        success: true,
        champions: { sections, divisions, show: showAward },
    };
}
