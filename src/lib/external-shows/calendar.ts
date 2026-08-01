/**
 * The calendar of record — pure merge/sort/grouping logic for
 * /calendar. Takes MHH-hosted shows (PublicShowSummary from the
 * shows domain) and approved external shows, normalises both into
 * CalendarEntry, and files them into chronological month shelves.
 *
 * Everything here is deterministic string/date math (no locale, no
 * wall clock) so the unit tests pass a fixed `today`.
 */

import type { PublicShowSummary } from "@/lib/shows/public";
import type { ExternalPlatform, ExternalVenueType } from "./schemas";

/** An approved external show as the public page reads it (display
 *  columns ONLY — submitter identity is never selected, so it can
 *  never render). */
export interface ApprovedExternalShow {
    id: string;
    title: string;
    url: string;
    venue_type: ExternalVenueType;
    host_name: string;
    platform: ExternalPlatform;
    starts_on: string;
    entries_close_on: string | null;
    location: string | null;
    description: string;
}

/** One row on the calendar, whatever its origin. */
export interface CalendarEntry {
    kind: "mhh" | "external";
    id: string;
    title: string;
    /** ISO date (YYYY-MM-DD) the entry sorts/groups by. */
    date: string;
    venue: ExternalVenueType;
    /** Internal path (MHH) or outbound URL (external). */
    href: string;
    outbound: boolean;
    /** Stamp chip label: "Facebook", "OMHPS", "MEPSA", "Live", … */
    platformLabel: string;
    hostLabel: string;
    location: string | null;
    entriesCloseOn: string | null;
    description: string | null;
    /** MHH shows: lifecycle status for the stamp ("Entries open"). */
    statusLabel: string | null;
}

export interface CalendarMonth {
    /** Sortable key, e.g. "2026-08". */
    key: string;
    /** Display label, e.g. "August 2026". */
    label: string;
    entries: CalendarEntry[];
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
] as const;

export const PLATFORM_LABELS: Record<ExternalPlatform, string> = {
    facebook: "Facebook",
    omhps: "OMHPS",
    mepsa: "MEPSA",
    website: "Website",
    other: "Community",
};

export const VENUE_LABELS: Record<ExternalVenueType, string> = {
    online_photo: "Online photo show",
    live: "Live show",
    mail_in: "Mail-in show",
};

/** MHH lifecycle statuses that belong on a forward-looking
 *  calendar. Completed/archived shows are history — the /shows
 *  browse page files those; the calendar looks ahead. */
const MHH_CALENDAR_STATUSES = new Set([
    "published",
    "entries_open",
    "entries_closed",
    "running",
    "judging",
    "results_review",
]);

const MHH_STATUS_LABELS: Record<string, string> = {
    published: "Upcoming",
    entries_open: "Entries open",
    entries_closed: "Entries closed",
    running: "Running",
    judging: "Judging",
    results_review: "Results soon",
};

/** YYYY-MM-DD slice of an ISO datetime (already-date strings pass
 *  through). Returns null for null/invalid input. */
function isoDatePart(iso: string | null): string | null {
    if (!iso) return null;
    const date = iso.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/**
 * An MHH show's place on the calendar:
 *   live   → the show date (the day you drive there);
 *   online → the entries-close date (the day that matters to an
 *            entrant), falling back to the show date if set.
 * Shows with no usable date, or past-lifecycle statuses, don't
 * belong on a calendar → null.
 */
export function fromMhhShow(show: PublicShowSummary): CalendarEntry | null {
    if (!MHH_CALENDAR_STATUSES.has(show.status)) return null;
    const date =
        show.mode === "live"
            ? isoDatePart(show.showDate)
            : (isoDatePart(show.entriesCloseAt) ?? isoDatePart(show.showDate));
    if (!date) return null;
    return {
        kind: "mhh",
        id: show.id,
        title: show.title,
        date,
        venue: show.mode === "live" ? "live" : "online_photo",
        href: `/shows/${show.id}`,
        outbound: false,
        platformLabel: "MHH",
        hostLabel: `@${show.hostAlias}`,
        location: show.venueName,
        entriesCloseOn: isoDatePart(show.entriesCloseAt),
        description: null,
        statusLabel: MHH_STATUS_LABELS[show.status] ?? null,
    };
}

export function fromExternalShow(row: ApprovedExternalShow): CalendarEntry {
    return {
        kind: "external",
        id: row.id,
        title: row.title,
        date: row.starts_on,
        venue: row.venue_type,
        href: row.url,
        outbound: true,
        platformLabel: PLATFORM_LABELS[row.platform] ?? "Community",
        hostLabel: row.host_name,
        location: row.location,
        entriesCloseOn: row.entries_close_on,
        description: row.description || null,
        statusLabel: null,
    };
}

/** Venue filter ("All" = undefined). */
export function filterByVenue(
    entries: CalendarEntry[],
    venue: ExternalVenueType | undefined,
): CalendarEntry[] {
    if (!venue) return entries;
    return entries.filter((e) => e.venue === venue);
}

/**
 * The calendar itself: drop past entries (date < today), sort
 * chronologically (ties break by title, then id for stability),
 * group into months. Months with nothing in them simply don't
 * exist — empty months collapse by construction.
 */
export function buildCalendarMonths(
    entries: CalendarEntry[],
    today: string,
): CalendarMonth[] {
    const upcoming = entries
        .filter((e) => e.date >= today)
        .sort(
            (a, b) =>
                a.date.localeCompare(b.date) ||
                a.title.localeCompare(b.title) ||
                a.id.localeCompare(b.id),
        );

    const months: CalendarMonth[] = [];
    for (const entry of upcoming) {
        const key = entry.date.slice(0, 7);
        let month = months[months.length - 1];
        if (!month || month.key !== key) {
            const monthIndex = Number(key.slice(5, 7)) - 1;
            month = {
                key,
                label: `${MONTH_NAMES[monthIndex] ?? key} ${key.slice(0, 4)}`,
                entries: [],
            };
            months.push(month);
        }
        month.entries.push(entry);
    }
    return months;
}

/** Amber-stamp rule: entries close within the next 7 days (today
 *  counts; already-closed does not). */
export function closesSoon(entry: CalendarEntry, today: string): boolean {
    if (!entry.entriesCloseOn) return false;
    if (entry.entriesCloseOn < today) return false;
    const close = Date.parse(`${entry.entriesCloseOn}T00:00:00Z`);
    const now = Date.parse(`${today}T00:00:00Z`);
    if (Number.isNaN(close) || Number.isNaN(now)) return false;
    return close - now <= 7 * 24 * 60 * 60 * 1000;
}

/** Today as the calendar sees it (UTC date). */
export function todayIso(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

/** "Aug 14" — deterministic, locale-free day label. */
export function shortDate(isoDate: string): string {
    const monthIndex = Number(isoDate.slice(5, 7)) - 1;
    const month = MONTH_NAMES[monthIndex]?.slice(0, 3) ?? "";
    return `${month} ${Number(isoDate.slice(8, 10))}`;
}
