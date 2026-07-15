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
    /** The caller's role on the show (host or co_host). */
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

export interface ShowConsoleData {
    show: ConsoleShow;
    /** The viewer's role on this show — never null (reads are staff-gated). */
    viewerRole: StaffRole;
    divisions: ConsoleDivision[];
    staff: ConsoleStaffMember[];
    entries: ConsoleEntry[];
    /** Entrants marked paid on the manual fee checklist (139).
     *  RLS scopes the read to managers; stewards/judges see []. */
    feePaidUserIds: string[];
}
