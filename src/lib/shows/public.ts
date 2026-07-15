/**
 * Shows domain — data shapes for the PUBLIC + ENTRANT reads
 * (getPublicShows / getPublicShow / getMyShowEntries in
 * src/app/actions/shows-v2.ts). Phase D of the show rebuild.
 *
 * Lives OUTSIDE the "use server" action file (which may only export
 * async functions) so the server reads and the client entry
 * components can import the same shapes. The classlist tree reuses
 * the ConsoleDivision shapes from ./console — public viewers and
 * the host console see the same structure.
 */

import type { EntryStatus, Place, ShowJudging, ShowMode, ShowStatus } from "./types";

/** Statuses the public browse ledger lists. Draft is never public;
 *  completed/archived shows leave the browse page (their results
 *  live on the horses' records and the show page stays reachable). */
export const PUBLIC_BROWSE_STATUSES: ShowStatus[] = [
    "published",
    "entries_open",
    "entries_closed",
    "running",
    "judging",
    "results_review",
];

// ── /shows — v2 browse ledger ──

export interface PublicShowSummary {
    id: string;
    title: string;
    mode: ShowMode;
    judging: ShowJudging;
    status: ShowStatus;
    hostAlias: string;
    /** Live shows: the show date. */
    showDate: string | null;
    venueName: string | null;
    /** Online shows: the windows. */
    entriesOpenAt: string | null;
    entriesCloseAt: string | null;
    judgingEndsAt: string | null;
    isMhhQualifying: boolean;
    /** Enterable classlist size (cancelled/combined excluded). */
    classCount: number;
    /** Live entries (scratched excluded). */
    entryCount: number;
    createdAt: string;
}

// ── /shows/[id] — the public show page (v2, via the E2 resolver) ──

export interface PublicShow {
    id: string;
    title: string;
    mode: ShowMode;
    judging: ShowJudging;
    status: ShowStatus;
    hostAlias: string;
    venueName: string | null;
    venueAddress: string | null;
    showDate: string | null;
    entriesOpenAt: string | null;
    entriesCloseAt: string | null;
    judgingEndsAt: string | null;
    aboutMd: string | null;
    rulesMd: string | null;
    feeInfo: string | null;
    capacity: number | null;
    isMhhQualifying: boolean;
    sanctioningNote: string | null;
}

// ── Entrant-side shapes ──

/** One of the viewer's own entries at a show (My Entries panel). */
export interface MyShowEntry {
    id: string;
    classId: string;
    horseId: string;
    horseName: string;
    entryNumber: number | null;
    status: EntryStatus;
    /** Set when someone else shows this horse (proxy). */
    handlerAlias: string | null;
    photoId: string | null;
    /** The entry's published result — set once the show completes
     *  (Phase E1); null before then and for participation. */
    place: Place | null;
}

/** A horse the viewer can enter (public, in their stable). */
export interface EntrantHorse {
    id: string;
    name: string;
    thumbnailUrl: string | null;
    /** From the catalog; null when unlinked/unknown. */
    scale: string | null;
    /** finish_type; null when unknown. */
    finish: string | null;
}
