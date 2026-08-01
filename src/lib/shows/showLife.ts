/**
 * Shows domain — "My Show Life" pure builders (Wave 2).
 *
 * The first CROSS-SHOW entrant view on the platform: every other
 * show_class_entries read is single-show-scoped. The server action
 * (src/app/actions/show-life.ts) fetches raw rows scoped to
 * owner_id = me; everything here is pure shaping — testable without
 * a database.
 */

import type { ShowStatus } from "./types";

/** Shows an entrant still has something in motion at. */
export const ACTIVE_LIFE_STATUSES: ShowStatus[] = [
    "entries_open",
    "entries_closed",
    "running",
    "judging",
    "results_review",
];

/** Shows whose results are published (mirrors gallery.RESULTS_STATUSES). */
export const RESULT_LIFE_STATUSES: ShowStatus[] = ["completed", "archived"];

/** Class names listed per active show before "+N more". */
export const MAX_LISTED_CLASSES = 3;

/** Placing lines listed per recent-result show. */
export const MAX_LISTED_PLACINGS = 5;

/** Recent-result shows kept (newest first). */
export const MAX_RESULT_SHOWS = 3;

export interface ShowLifeActiveEntry {
    showId: string;
    showTitle: string;
    showStatus: ShowStatus;
    entriesCloseAt: string | null;
    myEntryCount: number;
    /** Up to MAX_LISTED_CLASSES class names, entry order. */
    myClasses: string[];
}

export interface ShowLifePlacing {
    horseName: string;
    place: number;
    className: string;
}

export interface ShowLifeResult {
    showId: string;
    showTitle: string;
    /** Up to MAX_LISTED_PLACINGS, best place first. */
    placings: ShowLifePlacing[];
}

export interface MyShowLife {
    activeEntries: ShowLifeActiveEntry[];
    recentResults: ShowLifeResult[];
}

export const EMPTY_SHOW_LIFE: MyShowLife = { activeEntries: [], recentResults: [] };

// ── raw row shapes the action feeds in ──

export interface ShowLifeEntryRow {
    id: string;
    show_id: string;
    class_id: string;
    horse_id: string;
}

export interface ShowLifeShowRow {
    id: string;
    title: string | null;
    status: string;
    entries_close_at: string | null;
    updated_at: string | null;
}

export interface ShowLifePlacingRow {
    entry_id: string;
    class_id: string;
    place: number | null;
}

/**
 * Shape raw scoped rows into the MyShowLife view.
 *
 * - activeEntries: soonest deadline first (null deadlines last).
 * - recentResults: newest show first (updated_at), capped at
 *   MAX_RESULT_SHOWS; only shows where I actually PLACED — a
 *   completed show with participation only is not a "result line".
 * - Missing names degrade to honest placeholders, never crash.
 */
export function buildShowLife(input: {
    entries: ShowLifeEntryRow[];
    shows: ShowLifeShowRow[];
    placings: ShowLifePlacingRow[];
    classNamesById: Map<string, string>;
    horseNamesById: Map<string, string>;
}): MyShowLife {
    const { entries, shows, placings, classNamesById, horseNamesById } = input;
    const showsById = new Map(shows.map((s) => [s.id, s]));
    const entriesById = new Map(entries.map((e) => [e.id, e]));

    // ── Active shows ──
    const activeByShow = new Map<string, ShowLifeEntryRow[]>();
    for (const entry of entries) {
        const show = showsById.get(entry.show_id);
        if (!show || !ACTIVE_LIFE_STATUSES.includes(show.status as ShowStatus)) continue;
        const list = activeByShow.get(entry.show_id) ?? [];
        list.push(entry);
        activeByShow.set(entry.show_id, list);
    }

    const activeEntries: ShowLifeActiveEntry[] = [...activeByShow.entries()].map(
        ([showId, showEntries]) => {
            const show = showsById.get(showId)!;
            return {
                showId,
                showTitle: show.title ?? "Untitled show",
                showStatus: show.status as ShowStatus,
                entriesCloseAt: show.entries_close_at,
                myEntryCount: showEntries.length,
                myClasses: showEntries
                    .slice(0, MAX_LISTED_CLASSES)
                    .map((e) => classNamesById.get(e.class_id) ?? "Class"),
            };
        },
    );
    activeEntries.sort((a, b) => {
        if (a.entriesCloseAt === null && b.entriesCloseAt === null) return 0;
        if (a.entriesCloseAt === null) return 1;
        if (b.entriesCloseAt === null) return -1;
        return a.entriesCloseAt.localeCompare(b.entriesCloseAt);
    });

    // ── Recent results (placed only, published shows only) ──
    const placingsByShow = new Map<string, ShowLifePlacing[]>();
    for (const placing of placings) {
        if (placing.place === null) continue;
        const entry = entriesById.get(placing.entry_id);
        if (!entry) continue;
        const show = showsById.get(entry.show_id);
        if (!show || !RESULT_LIFE_STATUSES.includes(show.status as ShowStatus)) continue;
        const list = placingsByShow.get(entry.show_id) ?? [];
        list.push({
            horseName: horseNamesById.get(entry.horse_id) ?? "One of your horses",
            place: placing.place,
            className: classNamesById.get(placing.class_id) ?? "Class",
        });
        placingsByShow.set(entry.show_id, list);
    }

    const recentResults: ShowLifeResult[] = [...placingsByShow.entries()]
        .map(([showId, showPlacings]) => {
            const show = showsById.get(showId)!;
            showPlacings.sort((a, b) => a.place - b.place);
            return {
                showId,
                showTitle: show.title ?? "Untitled show",
                placings: showPlacings.slice(0, MAX_LISTED_PLACINGS),
                updatedAt: show.updated_at ?? "",
            };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, MAX_RESULT_SHOWS)
        .map(({ showId, showTitle, placings: p }) => ({ showId, showTitle, placings: p }));

    return { activeEntries, recentResults };
}

/**
 * Relative deadline copy for an entries_close_at timestamp:
 * "entries close in 3 days" / "… tomorrow" / "… in 5 hours" /
 * "entries close soon" / "entries closed". Null in → null out
 * (live shows may carry no entry window).
 */
export function formatCloseAt(iso: string | null, now: Date = new Date()): string | null {
    if (!iso) return null;
    const closes = new Date(iso);
    if (Number.isNaN(closes.getTime())) return null;
    const diffMs = closes.getTime() - now.getTime();
    if (diffMs <= 0) return "entries closed";
    const hours = diffMs / 3_600_000;
    if (hours < 1) return "entries close soon";
    if (hours < 24) {
        const h = Math.floor(hours);
        return `entries close in ${h} hour${h === 1 ? "" : "s"}`;
    }
    const days = Math.floor(hours / 24);
    if (days === 1) return "entries close tomorrow";
    return `entries close in ${days} days`;
}

/** "1st" / "2nd" / … / "6th" for the one placing vocabulary (1..6). */
export function placeLabel(place: number): string {
    const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
    return `${place}${suffixes[place] ?? "th"}`;
}
