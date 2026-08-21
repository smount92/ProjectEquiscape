/**
 * Events domain — the type catalog.
 *
 * Events are FB-style listing pages for happenings that live OUTSIDE
 * Model Horse Hub: external shows (OMHPS, MEPSA, Facebook shows, live
 * halls), meetups, club gatherings, swap meets, studio openings. You
 * advertise the thing, people click through, RSVP, and talk about it.
 *
 * Events award NOTHING — no points, no cards, no titles. Shows hosted
 * ON MHH are created at /shows/host and live in the `shows` table.
 * That is why `live_show` / `photo_show` are NOT creatable here: those
 * two values are wired into the legacy show system (shows.ts reads
 * `event_type = 'photo_show'`, the transition-shows cron sweeps both,
 * profile stats count them). Creating one through the events form
 * would mint a phantom show. They stay in the catalog for DISPLAY only
 * so legacy rows keep rendering.
 *
 * DB note: `events.event_type` carries a CHECK constraint (migration
 * 046). `external_show` and `club` are added by migration 168 — until
 * that is pasted, createEvent falls back to the mapping in
 * EVENT_TYPE_DB_FALLBACK and the listing simply reads as its fallback
 * label. Nothing breaks either way.
 */

export interface EventTypeMeta {
    /** Value stored in events.event_type. */
    value: string;
    label: string;
    icon: string;
    /** One-line gloss shown under the picker in the creation form. */
    blurb: string;
}

/** Offered in the creation flow — honest outside-MHH happenings. */
export const CREATABLE_EVENT_TYPES: EventTypeMeta[] = [
    {
        value: "external_show",
        label: "External Show",
        icon: "🏆",
        blurb: "A show happening somewhere else — OMHPS, MEPSA, a Facebook group, a live hall.",
    },
    {
        value: "meetup",
        label: "Meetup",
        icon: "🤝",
        blurb: "An informal get-together: a hobby lunch, a photo day, a barn visit.",
    },
    {
        value: "club",
        label: "Club Gathering",
        icon: "🏛️",
        blurb: "A club meeting, an AGM, a regional chapter day.",
    },
    {
        value: "swap_meet",
        label: "Swap Meet",
        icon: "🔄",
        blurb: "A buy/sell/trade day — tables, boxes, and haggling.",
    },
    {
        value: "breyerfest",
        label: "BreyerFest",
        icon: "🎪",
        blurb: "BreyerFest and its satellite events.",
    },
    {
        value: "studio_opening",
        label: "Studio Opening",
        icon: "🎨",
        blurb: "An artist opening a sales list, a run, or a commission window.",
    },
    {
        value: "auction",
        label: "Auction",
        icon: "🔨",
        blurb: "An auction happening off-platform.",
    },
    {
        value: "workshop",
        label: "Workshop",
        icon: "🎓",
        blurb: "A class or clinic — customizing, prepping, photography.",
    },
    {
        value: "other",
        label: "Other",
        icon: "📌",
        blurb: "Anything else the hobby should know about.",
    },
];

/** Display-only: legacy rows created before events were reworked. */
export const LEGACY_EVENT_TYPES: EventTypeMeta[] = [
    {
        value: "live_show",
        label: "Live Show (legacy)",
        icon: "🏆",
        blurb: "A show created through the old events flow.",
    },
    {
        value: "photo_show",
        label: "Photo Show (legacy)",
        icon: "📸",
        blurb: "A show created through the old events flow.",
    },
];

const ALL_EVENT_TYPES = [...CREATABLE_EVENT_TYPES, ...LEGACY_EVENT_TYPES];

export const EVENT_TYPE_META: Record<string, EventTypeMeta> = Object.fromEntries(
    ALL_EVENT_TYPES.map((t) => [t.value, t]),
);

/** The two values wired into the legacy show system. */
export const LEGACY_SHOW_TYPES = ["live_show", "photo_show"] as const;

export function isLegacyShowEvent(eventType: string): boolean {
    return (LEGACY_SHOW_TYPES as readonly string[]).includes(eventType);
}

export function isCreatableEventType(eventType: string): boolean {
    return CREATABLE_EVENT_TYPES.some((t) => t.value === eventType);
}

export function eventTypeLabel(eventType: string): string {
    return EVENT_TYPE_META[eventType]?.label ?? eventType;
}

export function eventTypeIcon(eventType: string): string {
    return EVENT_TYPE_META[eventType]?.icon ?? "📌";
}

/**
 * Values migration 168 introduces, mapped to a pre-168 value that the
 * existing CHECK constraint already accepts. createEvent retries with
 * these when the insert trips a check violation, so the feature works
 * before the migration is pasted.
 */
export const EVENT_TYPE_DB_FALLBACK: Record<string, string> = {
    external_show: "other",
    club: "meetup",
};
