/**
 * Shows domain — data shapes for the ONLINE-SHOW reads of Phase E1
 * (getShowGallery / getJudgeQueue in src/app/actions/shows-v2.ts).
 *
 * Lives OUTSIDE the "use server" action file (which may only
 * export async functions) so the server reads and the client
 * gallery/judge components can import the same shapes.
 *
 * THE BLIND RULE (enforced server-side, never by CSS): while a
 * show sits before results_review AND shows.blind_browsing is on,
 * owner identities are NOT included in the payload at all —
 * ownerAlias/ownerId are null. The gallery is the digital show
 * table: photos and horse names visible, leg tags instead of
 * name tags.
 */

import type { CallbackRecord } from "./callbacks";
import type { ClassStatus, Place, ShowJudging, ShowStatus, StaffRole } from "./types";

/** Online shows show their gallery from entries_open onward —
 *  watching the classes fill up is the fun. */
export const GALLERY_STATUSES: ShowStatus[] = [
    "entries_open",
    "entries_closed",
    "judging",
    "results_review",
    "completed",
    "archived",
];

/** From results_review onward, blind browsing lifts. */
export const REVEAL_STATUSES: ShowStatus[] = [
    "results_review",
    "completed",
    "archived",
];

/** Placings become public with the completed transition. */
export const RESULTS_STATUSES: ShowStatus[] = ["completed", "archived"];

export function isOwnerRevealed(status: ShowStatus, blindBrowsing: boolean): boolean {
    return !blindBrowsing || REVEAL_STATUSES.includes(status);
}

// ── The public entry gallery ──

export interface GalleryEntry {
    id: string;
    /** null while the blind rule holds — a horse-passport link would
     *  reveal the owner just as surely as ownerAlias/ownerId would. */
    horseId: string | null;
    horseName: string;
    entryNumber: number | null;
    /** Public storage URL of the entry photo; null = no photo. */
    photoUrl: string | null;
    /** null while the blind rule holds — never in the payload. */
    ownerAlias: string | null;
    /** null while the blind rule holds. */
    ownerId: string | null;
    voteCount: number;
    viewerHasVoted: boolean;
    /** The viewer's own entry (safe under blindness: it reveals
     *  only the viewer to themselves). Disables the vote button. */
    isOwn: boolean;
    /** Public once the show completes; null before/participation. */
    place: Place | null;
}

export interface GalleryClass {
    classId: string;
    className: string;
    classNumber: string | null;
    divisionName: string;
    sectionName: string;
    classStatus: ClassStatus;
    entries: GalleryEntry[];
}

export interface ShowGalleryData {
    /** Community-vote show: render counts + hearts. */
    votingEnabled: boolean;
    /** Voting is live right now (status = judging). */
    votingOpen: boolean;
    /** Owner identities included in this payload. */
    revealed: boolean;
    /** Placings included — render the results view. */
    resultsPublished: boolean;
    classes: GalleryClass[];
}

// ── The judge queue ──

export interface JudgeQueueEntry {
    id: string;
    horseName: string;
    entryNumber: number | null;
    photoUrl: string | null;
    /** Blind judging: null while the blind rule holds. */
    ownerAlias: string | null;
    /** Already-recorded placing, for resume/corrections. */
    place: Place | null;
    note: string | null;
}

export interface JudgeQueueClass {
    classId: string;
    className: string;
    classNumber: string | null;
    divisionId: string;
    divisionName: string;
    sectionId: string;
    sectionName: string;
    status: ClassStatus;
    entries: JudgeQueueEntry[];
}

export interface JudgeQueueData {
    show: {
        id: string;
        title: string;
        status: ShowStatus;
        judging: ShowJudging;
        blindBrowsing: boolean;
    };
    viewerRole: StaffRole;
    classes: JudgeQueueClass[];
    /** Structure + recorded callbacks — the championship round
     *  (Phase E2) derives its ladder from these. */
    sections: { id: string; name: string; divisionId: string }[];
    divisions: { id: string; name: string }[];
    callbacks: CallbackRecord[];
}
