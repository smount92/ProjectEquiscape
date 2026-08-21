/**
 * The calendar of record — pure merge/sort/grouping logic for
 * /calendar. Takes the THREE things the hobby puts on a date —
 * MHH-hosted shows (PublicShowSummary from the shows domain),
 * approved external show listings, and community events (the
 * off-platform gatherings on the events board) — normalises all of
 * them into CalendarEntry, and files them either onto chronological
 * month shelves (the list) or into a squared-off month grid.
 *
 * Everything here is deterministic string/date math (no locale, no
 * wall clock) so the unit tests pass a fixed `today`.
 */

import type { PublicShowSummary } from "@/lib/shows/public";
import { eventTypeIcon, eventTypeLabel } from "@/components/events/eventTypes";
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

/**
 * A community event as the calendar reads it — the display subset of
 * MHHEvent (`@/app/actions/events`). Declared structurally rather than
 * imported so this module stays a pure, server-action-free lib that
 * vitest can exercise on its own.
 *
 * NOTE: `events` is authenticated-only at the RLS layer
 * (`events_select … TO authenticated`, migration 031), so entries built
 * from this source can only ever exist for a signed-in viewer. The
 * anonymous calendar never sees them.
 */
export interface CommunityEventLike {
    id: string;
    name: string;
    description: string | null;
    eventType: string;
    /** ISO datetime. */
    startsAt: string;
    isVirtual: boolean;
    locationName: string | null;
    region: string | null;
    creatorAlias: string;
}

/** Where an entry came from. */
export type CalendarEntryKind = "mhh" | "external" | "event";

/** One row on the calendar, whatever its origin. */
export interface CalendarEntry {
    kind: CalendarEntryKind;
    id: string;
    title: string;
    /** ISO date (YYYY-MM-DD) the entry sorts/groups by. */
    date: string;
    venue: ExternalVenueType;
    /** Internal path (MHH shows, community events) or outbound URL. */
    href: string;
    outbound: boolean;
    /** Stamp chip label: "Facebook", "OMHPS", "MEPSA", "Meetup", … */
    platformLabel: string;
    hostLabel: string;
    location: string | null;
    entriesCloseOn: string | null;
    description: string | null;
    /** MHH shows: lifecycle status for the stamp ("Entries open"). */
    statusLabel: string | null;
    /**
     * What KIND of thing this is, in words — "Show" for the two show
     * sources, the event type ("Meetup", "Swap Meet") for community
     * events. A meetup is not a show, and the chip has to say so.
     */
    kindLabel: string;
    /**
     * Where-it-happens label. Shows keep the show vocabulary ("Live
     * show"); gatherings say plainly what they are, so a swap meet is
     * never captioned "Online photo show".
     */
    venueLabel: string;
    /** One glyph for the compact grid chips. */
    icon: string;
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

/** One glyph per venue — the grid has room for a chip, not a sentence. */
export const VENUE_ICONS: Record<ExternalVenueType, string> = {
    online_photo: "📸",
    live: "🏆",
    mail_in: "✉️",
};

/**
 * Event types that really ARE shows (someone advertising an outside
 * show on the events board, plus the two legacy values). Everything
 * else on that board is a gathering, and must not be captioned as a
 * show anywhere on the calendar.
 */
const EVENT_SHOW_TYPES = new Set(["external_show", "live_show", "photo_show"]);

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
    const venue: ExternalVenueType = show.mode === "live" ? "live" : "online_photo";
    return {
        kind: "mhh",
        id: show.id,
        title: show.title,
        date,
        venue,
        href: `/shows/${show.id}`,
        outbound: false,
        platformLabel: "MHH",
        hostLabel: `@${show.hostAlias}`,
        location: show.venueName,
        entriesCloseOn: isoDatePart(show.entriesCloseAt),
        description: null,
        statusLabel: MHH_STATUS_LABELS[show.status] ?? null,
        kindLabel: "Show",
        venueLabel: VENUE_LABELS[venue],
        icon: VENUE_ICONS[venue],
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
        kindLabel: "Show",
        venueLabel: VENUE_LABELS[row.venue_type] ?? "Show",
        icon: VENUE_ICONS[row.venue_type] ?? "🏆",
    };
}

/**
 * A community event's place on the calendar — the gatherings the hobby
 * files on the events board: meetups, club days, swap meets, studio
 * openings, and outside shows someone advertised there.
 *
 * The entry links to the event's page HERE (that page is the thing with
 * the RSVPs and the conversation), never straight out to its
 * `virtual_url`. Events carry no entry deadline, so they never wear the
 * "Closes soon" stamp.
 *
 * `venue` buckets the entry for the online/live filter; `venueLabel`
 * and `kindLabel` carry the honest words.
 */
export function fromCommunityEvent(event: CommunityEventLike): CalendarEntry | null {
    const date = isoDatePart(event.startsAt);
    if (!date) return null;

    const isShow = EVENT_SHOW_TYPES.has(event.eventType);
    const venue: ExternalVenueType = event.isVirtual ? "online_photo" : "live";
    const venueLabel = isShow
        ? event.isVirtual
            ? "Online show"
            : "Live show"
        : event.isVirtual
          ? "Online gathering"
          : "In-person gathering";

    return {
        kind: "event",
        id: event.id,
        title: event.name,
        date,
        venue,
        href: `/community/events/${event.id}`,
        outbound: false,
        // The event's own type IS the most honest stamp here — an
        // entry reading "SWAP MEET" can never be mistaken for a show.
        platformLabel: eventTypeLabel(event.eventType),
        hostLabel: `@${event.creatorAlias}`,
        location: event.isVirtual ? null : (event.locationName ?? event.region),
        entriesCloseOn: null,
        description: event.description || null,
        statusLabel: null,
        kindLabel: eventTypeLabel(event.eventType),
        venueLabel,
        icon: eventTypeIcon(event.eventType),
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

/** Chronological, ties broken by title then id so order is stable. */
function compareEntries(a: CalendarEntry, b: CalendarEntry): number {
    return (
        a.date.localeCompare(b.date) ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id)
    );
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
    const upcoming = entries.filter((e) => e.date >= today).sort(compareEntries);

    const months: CalendarMonth[] = [];
    for (const entry of upcoming) {
        const key = entry.date.slice(0, 7);
        let month = months[months.length - 1];
        if (!month || month.key !== key) {
            month = { key, label: monthLabel(key), entries: [] };
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

// ── The month grid ────────────────────────────────────────────────
//
// The list is the calendar of record (crawlable, mobile-first). The
// grid is the SHAPE of a month — what the second weekend in October
// looks like when three things land on it. Same entries, same
// deterministic UTC date math: a grid built for "2026-10" is
// byte-identical whatever the server's clock is doing.

/** Sunday-first, the shape every wall calendar in the hobby uses. */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One square of the grid. */
export interface CalendarDay {
    /** ISO date (YYYY-MM-DD) this square stands for. */
    date: string;
    /** False for the days borrowed from the neighbouring months to
     *  square the grid off. */
    inMonth: boolean;
    /** Been and gone. */
    isPast: boolean;
    isToday: boolean;
    entries: CalendarEntry[];
}

export interface CalendarGrid {
    /** Sortable key, e.g. "2026-08". */
    key: string;
    /** Display label, e.g. "August 2026". */
    label: string;
    /** Month keys for the prev/next doors. */
    prevKey: string;
    nextKey: string;
    /** Rows of exactly seven days. */
    weeks: CalendarDay[][];
    /** How many entries actually landed inside this month. */
    count: number;
}

/** Is this a well-formed "YYYY-MM"? Guards the URL param. */
export function isMonthKey(value: string | null | undefined): value is string {
    return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-08" → "August 2026". */
export function monthLabel(key: string): string {
    const monthIndex = Number(key.slice(5, 7)) - 1;
    return `${MONTH_NAMES[monthIndex] ?? key} ${key.slice(0, 4)}`;
}

/** "2026-12" +1 → "2027-01". Pure integer month arithmetic. */
export function shiftMonth(key: string, delta: number): string {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const total = year * 12 + (month - 1) + delta;
    const nextYear = Math.floor(total / 12);
    const nextMonth = total - nextYear * 12 + 1;
    return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`;
}

/** The month key a date falls in. */
export function monthKeyOf(isoDate: string): string {
    return isoDate.slice(0, 7);
}

/**
 * File every entry into its square and square the month off with the
 * days either side, so week rows are always seven wide.
 *
 * Unlike the list, the grid does NOT drop the past — an already-run
 * show still belongs on the day it ran when you are looking at the
 * shape of the month. Days carry `isPast` so the view can tone them.
 */
export function buildMonthGrid(
    entries: CalendarEntry[],
    monthKey: string,
    today: string,
): CalendarGrid {
    const year = Number(monthKey.slice(0, 4));
    const month = Number(monthKey.slice(5, 7));

    const firstOfMonth = Date.UTC(year, month - 1, 1);
    const leadingBlanks = new Date(firstOfMonth).getUTCDay();
    // Day 0 of the NEXT month is the last day of this one.
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const gridStart = firstOfMonth - leadingBlanks * DAY_MS;
    const cellCount = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

    const byDate = new Map<string, CalendarEntry[]>();
    let count = 0;
    for (const entry of entries) {
        if (monthKeyOf(entry.date) === monthKey) count++;
        const bucket = byDate.get(entry.date);
        if (bucket) bucket.push(entry);
        else byDate.set(entry.date, [entry]);
    }
    for (const bucket of byDate.values()) bucket.sort(compareEntries);

    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < cellCount; i++) {
        const date = new Date(gridStart + i * DAY_MS).toISOString().slice(0, 10);
        if (i % 7 === 0) weeks.push([]);
        weeks[weeks.length - 1].push({
            date,
            inMonth: monthKeyOf(date) === monthKey,
            isPast: date < today,
            isToday: date === today,
            entries: byDate.get(date) ?? [],
        });
    }

    return {
        key: monthKey,
        label: monthLabel(monthKey),
        prevKey: shiftMonth(monthKey, -1),
        nextKey: shiftMonth(monthKey, 1),
        weeks,
        count,
    };
}
