/**
 * Shows domain — data shapes for the LIVE RING CONSOLE (Phase E2:
 * getRingConsole / getRingBoard / getShowChampions in
 * src/app/actions/shows-v2-ring.ts).
 *
 * Lives OUTSIDE the "use server" action file (which may only
 * export async functions) so the server reads and the client ring
 * components share one vocabulary.
 *
 * Live-mode identity rule (design doc §4): NO photos — the
 * steward knows horses by their LEG-TAG NUMBER. Every entry here
 * leads with entryNumber; horseName is the small print.
 */

import type { CallbackRecord } from "./callbacks";
import type {
    ClassStatus,
    Place,
    ShowMode,
    ShowStatus,
    StaffRole,
} from "./types";

// ── /shows/host/[id]/ring — the console ──

export interface RingEntry {
    id: string;
    /** The leg tag — the identity at the table. */
    entryNumber: number | null;
    horseName: string;
    place: Place | null;
}

export interface RingClass {
    classId: string;
    className: string;
    classNumber: string | null;
    status: ClassStatus;
    sectionId: string;
    sectionName: string;
    divisionId: string;
    divisionName: string;
    /** Live entries only (scratched rows never reach the table). */
    entries: RingEntry[];
}

export interface RingConsoleData {
    show: {
        id: string;
        title: string;
        mode: ShowMode;
        status: ShowStatus;
        venueName: string | null;
        showDate: string | null;
    };
    viewerRole: StaffRole;
    /** Run order: division → section → class sort. */
    classes: RingClass[];
    sections: { id: string; name: string; divisionId: string }[];
    divisions: { id: string; name: string }[];
    callbacks: CallbackRecord[];
}

/**
 * Run-order derivation: the CURRENT class is the first one being
 * worked (judging, else called); ON DECK is the next scheduled
 * class after it (or the first scheduled at all). Pure — shared
 * by the console and the announcer board.
 */
export function deriveRunOrder(classes: { status: ClassStatus }[]): {
    currentIndex: number | null;
    onDeckIndex: number | null;
} {
    let currentIndex: number | null = null;
    const judging = classes.findIndex((c) => c.status === "judging");
    const called = classes.findIndex((c) => c.status === "called");
    if (judging >= 0 && called >= 0) currentIndex = Math.min(judging, called);
    else if (judging >= 0) currentIndex = judging;
    else if (called >= 0) currentIndex = called;

    let onDeckIndex: number | null = null;
    const from = currentIndex === null ? 0 : currentIndex + 1;
    for (let i = from; i < classes.length; i++) {
        if (classes[i].status === "scheduled") {
            onDeckIndex = i;
            break;
        }
    }
    // Nothing scheduled after the current class? Fall back to any
    // scheduled class earlier in the order (out-of-order calling).
    if (onDeckIndex === null) {
        for (let i = 0; i < (currentIndex ?? 0); i++) {
            if (classes[i].status === "scheduled") {
                onDeckIndex = i;
                break;
            }
        }
    }
    return { currentIndex, onDeckIndex };
}

// ── /shows/host/[id]/ring/board — the announcer view ──

export interface BoardClassRef {
    classNumber: string | null;
    className: string;
    sectionName: string;
    divisionName: string;
}

export interface BoardResult extends BoardClassRef {
    placings: { place: Place; entryNumber: number | null; horseName: string }[];
}

export interface RingBoardData {
    show: { id: string; title: string; status: ShowStatus };
    /** null while nothing is called/judging. */
    nowJudging: BoardClassRef | null;
    onDeck: BoardClassRef | null;
    placedCount: number;
    totalCount: number;
    /** Most recently placed classes, newest first (capped). */
    latestResults: BoardResult[];
}

// ── Champions ladder (public results view) ──

export interface ChampionEntry {
    entryId: string;
    horseName: string;
    entryNumber: number | null;
    /** Owner alias — results are published, identities are public. */
    ownerAlias: string | null;
}

export interface ChampionAward {
    scope: "section" | "division" | "show";
    /** Section/division name; the show title for show scope. */
    scopeLabel: string;
    /** Division context for section awards. */
    divisionName: string | null;
    champion: ChampionEntry | null;
    reserve: ChampionEntry | null;
}

export interface ShowChampionsData {
    sections: ChampionAward[];
    divisions: ChampionAward[];
    show: ChampionAward | null;
}
