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

// ── The class room (v4 — "the class is the room") ──

export interface ClassRoomEntry {
    id: string;
    /** null while the blind rule holds (passport link = identity). */
    horseId: string | null;
    horseName: string;
    entryNumber: number | null;
    photoUrl: string | null;
    /** null while the blind rule holds. */
    ownerAlias: string | null;
    /** null while the blind rule holds. */
    ownerId: string | null;
    isOwn: boolean;
    /** Present once THIS CLASS's results are published. */
    place: Place | null;
    /** Season points this placing paid (published classes only; 0 =
     *  placed but unpaid, e.g. self-only competition). */
    pointsEarned: number | null;
    /** A live qualification card was minted for this placing. */
    cardCode: string | null;
    cardIsStakes: boolean;
    /** Judge feedback on the model — published classes only. */
    critique: string | null;
    /** Judge feedback on the photograph — published classes only. */
    photoCritique: string | null;
    /** Scored judging (205): the sheet + weighted total — published classes only. */
    scoreData: Record<string, number> | null;
    scoreTotal: number | null;
    /** Attached documentation (the show-binder card), if any. */
    document: { kind: string; title: string; bodyMd: string } | null;
    /** Community-vote shows only (0 otherwise). */
    voteCount: number;
    viewerHasVoted: boolean;
}

/** One stop on the class-room quick-nav rail (run order). */
export interface ClassRoomNavItem {
    classId: string;
    className: string;
    classNumber: string | null;
    sectionName: string;
    divisionName: string;
    entryCount: number;
    isCurrent: boolean;
}

export interface ClassRoomData {
    show: {
        id: string;
        title: string;
        status: ShowStatus;
        blindBrowsing: boolean;
    };
    room: {
        classId: string;
        className: string;
        classNumber: string | null;
        sectionName: string;
        divisionName: string;
        classStatus: ClassStatus;
        /** THIS class's results are public (rolling reveal or show completion). */
        resultsPublished: boolean;
        resultsPublishedAt: string | null;
        /** Championship context (season-felt wave): the live field. */
        isQualifying: boolean;
        liveEntryCount: number;
        distinctExhibitors: number;
    };
    /** Scored judging (205): the class's rubric, when it has one. */
    rubric: import("./rubrics").Rubric | null;
    /** Per-criterion class averages — the scorecard's dashed polygon.
     *  Published classes only; null otherwise. */
    scoreAverages: Record<string, number> | null;
    /** Viewer is show staff seeing the room AS ENTRANTS WILL before
     *  publish — placings/critiques/scorecards shown, banner rendered,
     *  points and card codes still publish-only. */
    staffPreview: boolean;
    /** Owner identities included in this payload. */
    revealed: boolean;
    /** Community-vote show: render hearts in the room. */
    votingEnabled: boolean;
    /** Voting live right now (status = judging). */
    votingOpen: boolean;
    /** Viewer is signed in (vote buttons need to know). */
    authed: boolean;
    entries: ClassRoomEntry[];
    /** The whole classlist in run order — the quick-nav rail. */
    program: ClassRoomNavItem[];
    /** Ring-walk neighbors (run order; null at the ends). */
    prev: { classId: string; label: string } | null;
    next: { classId: string; label: string } | null;
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
    /** v4 per-entry critique (model / photo), for resume + edit. */
    critiqueText: string | null;
    critiquePhotoText: string | null;
    /** Show identity — "Mare · Akhal-Teke · dapple grey" — horse fields
     *  first, registry fallback. Blind-safe (describes the horse, not
     *  the person). */
    identity: string | null;
    /** Scored judging (205): the judge's sheet so far + total (staff surface). */
    scoreData: Record<string, number> | null;
    scoreTotal: number | null;
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
    /** v4: when this class's results went public (rolling reveal). */
    resultsPublishedAt: string | null;
    /** Scored judging (205): the class's rubric, when it has one. */
    rubric: import("./rubrics").Rubric | null;
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
