/**
 * Shows domain — data shapes for the showholder console reads
 * (getHostedShows / getShowConsole in src/app/actions/shows-v2.ts).
 *
 * Lives OUTSIDE the "use server" action file (which may only export
 * async functions) so both the server reads and the client console
 * components can import the same shapes.
 */

import type {
    ClassStatus,
    DivisionAxis,
    EntryStatus,
    ShowJudging,
    ShowMode,
    ShowStatus,
    StaffRole,
} from "./types";

// ── /shows/host — "My Shows" list ──

export interface HostedShowSummary {
    id: string;
    title: string;
    mode: ShowMode;
    judging: ShowJudging;
    status: ShowStatus;
    showDate: string | null;
    entriesCloseAt: string | null;
    createdAt: string;
    /** The caller's role on the show — any staff role since Batch 2
     *  (judges and stewards find their shows in this list too). */
    role: StaffRole;
    entryCount: number;
}

// ── /shows/host/[id] — the console ──

export interface ConsoleShow {
    id: string;
    title: string;
    mode: ShowMode;
    judging: ShowJudging;
    status: ShowStatus;
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
    /** Blind entry gallery during judging (migration 119). */
    blindBrowsing: boolean;
    createdAt: string;
}

export interface ConsoleClass {
    id: string;
    name: string;
    classNumber: string | null;
    status: ClassStatus;
    maxPerEntrant: number | null;
    allowedScales: string[] | null;
    allowedFinishes: string[] | null;
    isQualifying: boolean;
    sortOrder: number;
    entryCount: number;
    /** Distinct owners with live entries (card-gate context). */
    exhibitorCount: number;
}

export interface ConsoleSection {
    id: string;
    name: string;
    sortOrder: number;
    classes: ConsoleClass[];
}

export interface ConsoleDivision {
    id: string;
    name: string;
    axis: DivisionAxis;
    sortOrder: number;
    sections: ConsoleSection[];
}

export interface ConsoleStaffMember {
    userId: string;
    alias: string;
    role: StaffRole;
    coiFlag: boolean;
    coiNote: string | null;
}

export interface ConsoleEntry {
    id: string;
    classId: string;
    horseName: string;
    ownerId: string;
    ownerAlias: string;
    /** Set when the entry is shown by proxy (handler ≠ owner). */
    handlerAlias: string | null;
    entryNumber: number | null;
    status: EntryStatus;
}

/** A row of the show's bar list (migration 148). */
export interface ConsoleBarredEntrant {
    userId: string;
    alias: string;
    /** Host bookkeeping — staff-only, never shown to the barred member. */
    reason: string | null;
    barredAt: string;
}

export interface ShowConsoleData {
    show: ConsoleShow;
    /** The viewer's own user id — lets client tabs exclude the viewer
     *  from counts (e.g. the announce composer's recipient preview). */
    viewerId: string;
    /** The viewer's role on this show — never null (reads are staff-gated). */
    viewerRole: StaffRole;
    divisions: ConsoleDivision[];
    staff: ConsoleStaffMember[];
    entries: ConsoleEntry[];
    /** Entrants marked paid on the manual fee checklist (139).
     *  RLS scopes the read to managers; stewards/judges see []. */
    feePaidUserIds: string[];
    /** Members barred from this show (148). RLS scopes the read to
     *  host/co_host/steward; judges see []. */
    barred: ConsoleBarredEntrant[];
    /**
     * How many members follow this show — a soft signal of interest for
     * the host (184). A COUNT and never a list: the follower identities
     * are private and no console payload carries them. 0 pre-184, and 0
     * for stewards/judges (the SECURITY DEFINER function is gated to
     * host/co_host).
     */
    followerCount: number;
}
