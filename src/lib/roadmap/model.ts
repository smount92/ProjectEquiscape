/**
 * The admin roadmap — one model for goals, problems and chores.
 *
 * The owners kept their short- and long-term goals in chat threads,
 * memory notes and dated docs under docs/archive, and user-reported
 * problems in the mailbox. None of it was in one place with a status.
 * This module is the one owner of the vocabulary (kinds, horizons,
 * statuses) and of the roll-ups the Roadmap tab shows; the server action
 * and the tab both read it, and the migration's CHECKs mirror it.
 */

export const ROADMAP_KINDS = ["goal", "problem", "idea", "chore"] as const;
export type RoadmapKind = (typeof ROADMAP_KINDS)[number];

export const ROADMAP_HORIZONS = ["now", "short", "long", "someday"] as const;
export type RoadmapHorizon = (typeof ROADMAP_HORIZONS)[number];

export const ROADMAP_STATUSES = ["open", "in_progress", "blocked", "done", "dropped"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

/** 1 = must, 2 = should, 3 = could. */
export const ROADMAP_PRIORITIES = [1, 2, 3] as const;
export type RoadmapPriority = (typeof ROADMAP_PRIORITIES)[number];

export const KIND_LABELS: Record<RoadmapKind, string> = {
    goal: "Goal",
    problem: "Problem",
    idea: "Idea",
    chore: "Chore",
};

export const HORIZON_LABELS: Record<RoadmapHorizon, string> = {
    now: "Now",
    short: "Short term",
    long: "Long term",
    someday: "Someday",
};

/** What each horizon means, in the words the tab shows under the column. */
export const HORIZON_HINTS: Record<RoadmapHorizon, string> = {
    now: "This week or next",
    short: "The next month or two",
    long: "This season and beyond",
    someday: "Parked until something changes",
};

export const STATUS_LABELS: Record<RoadmapStatus, string> = {
    open: "Open",
    in_progress: "In progress",
    blocked: "Blocked",
    done: "Done",
    dropped: "Dropped",
};

export const PRIORITY_LABELS: Record<RoadmapPriority, string> = {
    1: "Must",
    2: "Should",
    3: "Could",
};

/** Free-text area tags the seed uses; the field accepts anything. */
export const ROADMAP_AREAS = [
    "shows",
    "registry",
    "stable",
    "studio",
    "market",
    "community",
    "growth",
    "ops",
    "namhsa",
    "billing",
] as const;

export const TITLE_MAX = 160;
export const DETAIL_MAX = 4000;
export const AREA_MAX = 40;
export const SOURCE_MAX = 120;
export const LINK_MAX = 500;

/** A closed item is one nobody needs to look at again. */
export const CLOSED_STATUSES: readonly RoadmapStatus[] = ["done", "dropped"];

export function isClosed(status: RoadmapStatus): boolean {
    return CLOSED_STATUSES.includes(status);
}

export interface RoadmapItem {
    id: string;
    title: string;
    detail: string;
    kind: RoadmapKind;
    horizon: RoadmapHorizon;
    status: RoadmapStatus;
    priority: RoadmapPriority;
    area: string;
    /** Who raised it or where it came from ("Nightcrow", "audit 2026-08"). */
    source: string;
    /** A URL — a doc, a thread, a commit. */
    link: string;
    /** ISO date (YYYY-MM-DD) or null. */
    dueOn: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
}

/** Days an open item may sit untouched before the tab calls it stale. */
export const STALE_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;

export function isOverdue(item: Pick<RoadmapItem, "dueOn" | "status">, today = new Date()): boolean {
    if (!item.dueOn || isClosed(item.status)) return false;
    const due = new Date(`${item.dueOn}T23:59:59`);
    return due.getTime() < today.getTime();
}

export function isStale(item: Pick<RoadmapItem, "updatedAt" | "status">, today = new Date()): boolean {
    if (isClosed(item.status)) return false;
    return today.getTime() - new Date(item.updatedAt).getTime() > STALE_AFTER_DAYS * DAY_MS;
}

/** Status first (blocked and in-progress before open), then priority, then due date, then newest. */
const STATUS_RANK: Record<RoadmapStatus, number> = {
    blocked: 0,
    in_progress: 1,
    open: 2,
    done: 3,
    dropped: 4,
};

export function sortItems(items: RoadmapItem[]): RoadmapItem[] {
    return [...items].sort((a, b) => {
        const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (s !== 0) return s;
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.dueOn !== b.dueOn) {
            if (!a.dueOn) return 1;
            if (!b.dueOn) return -1;
            return a.dueOn.localeCompare(b.dueOn);
        }
        return b.createdAt.localeCompare(a.createdAt);
    });
}

export interface RoadmapSummary {
    /** Open (not done/dropped) items per horizon. */
    openByHorizon: Record<RoadmapHorizon, number>;
    /** Open problems — the number the tab leads with. */
    openProblems: number;
    inProgress: number;
    blocked: number;
    overdue: number;
    stale: number;
    /** Closed as done in the last 30 days. */
    doneRecently: number;
    total: number;
}

export function summarize(items: RoadmapItem[], today = new Date()): RoadmapSummary {
    const openByHorizon: Record<RoadmapHorizon, number> = { now: 0, short: 0, long: 0, someday: 0 };
    let openProblems = 0;
    let inProgress = 0;
    let blocked = 0;
    let overdue = 0;
    let stale = 0;
    let doneRecently = 0;
    const cutoff = today.getTime() - 30 * DAY_MS;
    for (const it of items) {
        if (!isClosed(it.status)) {
            openByHorizon[it.horizon] += 1;
            if (it.kind === "problem") openProblems += 1;
            if (it.status === "in_progress") inProgress += 1;
            if (it.status === "blocked") blocked += 1;
            if (isOverdue(it, today)) overdue += 1;
            if (isStale(it, today)) stale += 1;
        } else if (it.status === "done" && it.closedAt && new Date(it.closedAt).getTime() >= cutoff) {
            doneRecently += 1;
        }
    }
    return { openByHorizon, openProblems, inProgress, blocked, overdue, stale, doneRecently, total: items.length };
}

/** Group by horizon in display order; closed items are dropped unless `includeClosed`. */
export function groupByHorizon(
    items: RoadmapItem[],
    includeClosed = false,
): Record<RoadmapHorizon, RoadmapItem[]> {
    const out: Record<RoadmapHorizon, RoadmapItem[]> = { now: [], short: [], long: [], someday: [] };
    for (const it of sortItems(items)) {
        if (!includeClosed && isClosed(it.status)) continue;
        out[it.horizon].push(it);
    }
    return out;
}

/**
 * The status transition's side effect on closed_at: closing stamps it,
 * reopening clears it. Pure so the action and the tests agree.
 */
export function closedAtFor(next: RoadmapStatus, previous: string | null, now = new Date()): string | null {
    if (isClosed(next)) return previous ?? now.toISOString();
    return null;
}

// ── History: notes and recorded changes (migration 231) ──

export type RoadmapEventKind = "created" | "comment" | "change";

/** One field that changed, with both values as display strings (null = empty). */
export interface FieldChange {
    field: keyof RoadmapItem;
    from: string | null;
    to: string | null;
}

export interface RoadmapEvent {
    id: string;
    itemId: string;
    kind: RoadmapEventKind;
    /** The note text for a comment; a short line for created. */
    body: string;
    changes: FieldChange[];
    createdAt: string;
}

/** A recent-activity row carries its item's title so the stream reads without a lookup. */
export interface RoadmapEventWithItem extends RoadmapEvent {
    itemTitle: string;
}

export const NOTE_MAX = 4000;

const TRACKED_FIELDS: (keyof RoadmapItem)[] = [
    "title",
    "detail",
    "kind",
    "horizon",
    "status",
    "priority",
    "area",
    "source",
    "link",
    "dueOn",
];

const FIELD_LABELS: Record<string, string> = {
    title: "Title",
    detail: "Detail",
    kind: "Kind",
    horizon: "Horizon",
    status: "Status",
    priority: "Priority",
    area: "Area",
    source: "Source",
    link: "Link",
    dueOn: "Due",
};

/** The value in the words the tab uses, so history reads "Open → Blocked", not "open → blocked". */
export function displayValue(field: keyof RoadmapItem, value: unknown): string | null {
    if (value === null || value === undefined || value === "") return null;
    switch (field) {
        case "kind":
            return KIND_LABELS[value as RoadmapKind] ?? String(value);
        case "horizon":
            return HORIZON_LABELS[value as RoadmapHorizon] ?? String(value);
        case "status":
            return STATUS_LABELS[value as RoadmapStatus] ?? String(value);
        case "priority":
            return PRIORITY_LABELS[value as RoadmapPriority] ?? String(value);
        default:
            return String(value);
    }
}

/** Which tracked fields differ, with display values. Detail is recorded as edited, not quoted. */
export function diffItem(before: RoadmapItem, after: RoadmapItem): FieldChange[] {
    const out: FieldChange[] = [];
    for (const field of TRACKED_FIELDS) {
        const a = before[field];
        const b = after[field];
        if ((a ?? "") === (b ?? "")) continue;
        if (field === "detail") {
            out.push({ field, from: null, to: null });
            continue;
        }
        out.push({ field, from: displayValue(field, a), to: displayValue(field, b) });
    }
    return out;
}

/** One change as a line of history. */
export function describeChange(c: FieldChange): string {
    const label = FIELD_LABELS[c.field] ?? c.field;
    if (c.field === "detail") return "Detail edited";
    if (c.from === null && c.to !== null) return `${label} set to ${c.to}`;
    if (c.from !== null && c.to === null) return `${label} cleared (was ${c.from})`;
    return `${label}: ${c.from} → ${c.to}`;
}

/** The whole event as one line (a comment returns its text). */
export function describeEvent(e: RoadmapEvent): string {
    if (e.kind === "comment") return e.body;
    if (e.kind === "created") return e.body || "Added to the roadmap";
    return e.changes.map(describeChange).join(" · ") || "Edited";
}
