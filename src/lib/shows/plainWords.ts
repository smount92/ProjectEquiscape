/**
 * Shows domain — THE PLAIN-WORDS LAYER. Pure, no I/O.
 *
 * One place that translates every machine status word into the
 * sentence a shower would actually say, so no surface ever prints
 * "results_review" (or its underscore-stripped cousin) at a user.
 *
 * formatStatus (stateMachine.ts) stays the label INSIDE refusal
 * messages, where the machine is explaining its own rules; these
 * maps are for stamps, badges, and copy that people read first.
 *
 * Every map is Record<union, string>, so adding a status without a
 * friendly word is a compile error — and the unit tests walk the
 * unions exhaustively.
 */

import type {
    ClassStatus,
    DivisionAxis,
    EntryStatus,
    ShowStatus,
} from "./types";

/** Show lifecycle, in the words the show page stamps. */
const SHOW_STATUS_WORDS: Record<ShowStatus, string> = {
    draft: "Draft — not public yet",
    published: "Upcoming",
    entries_open: "Entries open",
    entries_closed: "Entries closed",
    running: "Show day",
    judging: "Judging",
    results_review: "Results being finalized",
    completed: "Results final",
    archived: "Archived",
};

export function friendlyShowStatus(status: ShowStatus): string {
    return SHOW_STATUS_WORDS[status];
}

/** Entry status, as the entrant's My Entries table stamps it. */
const ENTRY_STATUS_WORDS: Record<EntryStatus, string> = {
    entered: "Entered ✓",
    scratched: "Scratched (withdrawn)",
    placed: "Placed 🏆",
};

export function friendlyEntryStatus(status: EntryStatus): string {
    return ENTRY_STATUS_WORDS[status];
}

/** Class lifecycle, as the public classlist stamps it. */
const CLASS_STATUS_WORDS: Record<ClassStatus, string> = {
    scheduled: "Scheduled",
    called: "In the ring",
    judging: "Being judged",
    placed: "Placed",
    combined: "Combined into another class",
    cancelled: "Cancelled",
};

export function friendlyClassStatus(status: ClassStatus): string {
    return CLASS_STATUS_WORDS[status];
}

/**
 * One-line gloss per division axis — visible text under the
 * division header (never a tooltip), so a first-time visitor knows
 * what "halter" even means.
 */
export const AXIS_GLOSS: Record<DivisionAxis, string> = {
    halter: "Halter — judged on breed type & conformation",
    performance: "Performance — horse + tack/props depicting an event",
    workmanship: "Workmanship — judged on the quality of the finish work",
    collectibility: "Collectibility — judged on rarity & condition",
    other: "Specialty division — see the show rules for how it's judged",
};
