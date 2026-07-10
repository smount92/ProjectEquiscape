/**
 * Shows domain — THE CALLBACK LADDER. Pure, no I/O.
 *
 * The hobby's champion structure (design doc §5.4):
 *   section  callback — candidates = the 1st-place entries of the
 *                       section's placed classes
 *   division callback — candidates = the section champions
 *   show     callback — candidates = the division champions
 *
 * A round OPENS when everything it depends on is decided (all
 * classes of the section placed; all sections of the division
 * decided; all divisions decided). A round is DECIDED once a
 * champion is recorded. Reserve is optional and picked from the
 * same candidate pool (the prompt-side simplification of NAN's
 * "2nd moves up" convention — v1 keeps one pool per round).
 *
 * This module is the ONE source of those rules: the ring console
 * and the online judge queue derive their UI from
 * buildCallbackLadder, and the recordCallback action re-derives
 * the same ladder server-side from freshly loaded rows before
 * accepting a pick.
 */

import type { CallbackScope, ClassStatus, Place } from "./types";

// ── Inputs ──

export interface LadderClass {
    classId: string;
    sectionId: string;
    divisionId: string;
    status: ClassStatus;
    /** Live (non-scratched) entries with any recorded place. */
    entries: { id: string; place: Place | null }[];
}

export interface LadderSection {
    id: string;
    name: string;
    divisionId: string;
}

export interface LadderDivision {
    id: string;
    name: string;
}

/** A show_callbacks row, camel-cased. */
export interface CallbackRecord {
    scope: CallbackScope;
    scopeId: string | null;
    championEntryId: string | null;
    reserveEntryId: string | null;
}

// ── Output ──

export type LadderRoundState =
    /** Prerequisites not met yet (classes unplaced / lower rounds open). */
    | "waiting"
    /** Candidates ready, no champion recorded. */
    | "open"
    /** A champion is recorded (re-recording stays legal). */
    | "decided";

export interface LadderRound {
    scope: CallbackScope;
    /** show_sections.id / show_divisions.id; null for show scope. */
    scopeId: string | null;
    /** "Stock", "OF Plastic Halter", or the show-scope label. */
    label: string;
    /** Division context for section rounds (disambiguates "Stock"). */
    divisionName: string | null;
    state: LadderRoundState;
    /** Entry ids eligible for champion/reserve in this round. */
    candidateEntryIds: string[];
    championEntryId: string | null;
    reserveEntryId: string | null;
}

export interface CallbackLadder {
    sections: LadderRound[];
    divisions: LadderRound[];
    show: LadderRound | null;
}

/** Cancelled/combined classes never gate a callback round. */
export function isJudgeableClassStatus(status: ClassStatus): boolean {
    return status !== "cancelled" && status !== "combined";
}

function findCallback(
    callbacks: CallbackRecord[],
    scope: CallbackScope,
    scopeId: string | null,
): CallbackRecord | undefined {
    return callbacks.find(
        (c) => c.scope === scope && (scope === "show" || c.scopeId === scopeId),
    );
}

/**
 * Derive the whole ladder from the show's rows. Sections without a
 * judgeable class (and divisions without such a section) produce no
 * round — an empty division shouldn't block the grand championship.
 */
export function buildCallbackLadder(input: {
    classes: LadderClass[];
    sections: LadderSection[];
    divisions: LadderDivision[];
    callbacks: CallbackRecord[];
    /** Label of the show round ("Grand Championship" by default). */
    showLabel?: string;
}): CallbackLadder {
    const { classes, sections, divisions, callbacks } = input;
    const divisionById = new Map(divisions.map((d) => [d.id, d]));

    // ── Section rounds ──
    const sectionRounds: LadderRound[] = [];
    for (const section of sections) {
        const judgeable = classes.filter(
            (c) => c.sectionId === section.id && isJudgeableClassStatus(c.status),
        );
        if (judgeable.length === 0) continue;

        const allPlaced = judgeable.every((c) => c.status === "placed");
        const candidates = judgeable.flatMap((c) =>
            c.entries.filter((e) => e.place === 1).map((e) => e.id),
        );
        const recorded = findCallback(callbacks, "section", section.id);

        sectionRounds.push({
            scope: "section",
            scopeId: section.id,
            label: section.name,
            divisionName: divisionById.get(section.divisionId)?.name ?? null,
            state: recorded?.championEntryId
                ? "decided"
                : allPlaced && candidates.length > 0
                  ? "open"
                  : "waiting",
            candidateEntryIds: candidates,
            championEntryId: recorded?.championEntryId ?? null,
            reserveEntryId: recorded?.reserveEntryId ?? null,
        });
    }

    // ── Division rounds (candidates = section champions) ──
    const divisionRounds: LadderRound[] = [];
    for (const division of divisions) {
        const rounds = sectionRounds.filter(
            (r) => sections.find((s) => s.id === r.scopeId)?.divisionId === division.id,
        );
        if (rounds.length === 0) continue;

        const allDecided = rounds.every((r) => r.state === "decided");
        const candidates = rounds.flatMap((r) =>
            r.championEntryId ? [r.championEntryId] : [],
        );
        const recorded = findCallback(callbacks, "division", division.id);

        divisionRounds.push({
            scope: "division",
            scopeId: division.id,
            label: division.name,
            divisionName: null,
            state: recorded?.championEntryId
                ? "decided"
                : allDecided && candidates.length > 0
                  ? "open"
                  : "waiting",
            candidateEntryIds: candidates,
            championEntryId: recorded?.championEntryId ?? null,
            reserveEntryId: recorded?.reserveEntryId ?? null,
        });
    }

    // ── Show round (candidates = division champions) ──
    let showRound: LadderRound | null = null;
    if (divisionRounds.length > 0) {
        const allDecided = divisionRounds.every((r) => r.state === "decided");
        const candidates = divisionRounds.flatMap((r) =>
            r.championEntryId ? [r.championEntryId] : [],
        );
        const recorded = findCallback(callbacks, "show", null);
        showRound = {
            scope: "show",
            scopeId: null,
            label: input.showLabel ?? "Grand Championship",
            divisionName: null,
            state: recorded?.championEntryId
                ? "decided"
                : allDecided && candidates.length > 0
                  ? "open"
                  : "waiting",
            candidateEntryIds: candidates,
            championEntryId: recorded?.championEntryId ?? null,
            reserveEntryId: recorded?.reserveEntryId ?? null,
        };
    }

    return { sections: sectionRounds, divisions: divisionRounds, show: showRound };
}

/** Locate one round of a built ladder (recordCallback's re-check). */
export function findLadderRound(
    ladder: CallbackLadder,
    scope: CallbackScope,
    scopeId: string | null,
): LadderRound | null {
    if (scope === "show") return ladder.show;
    const pool = scope === "section" ? ladder.sections : ladder.divisions;
    return pool.find((r) => r.scopeId === scopeId) ?? null;
}

export type CallbackValidation = { ok: true } | { ok: false; reason: string };

/**
 * Validate a champion/reserve pick against a round. Encodes the
 * ladder rules verbatim:
 *   - the round must be open (or decided — corrections stay legal),
 *   - champion must be a candidate (placed 1st in scope; division
 *     candidates must be section champions; show candidates must
 *     be division champions),
 *   - reserve, when given, must be a different candidate.
 */
export function validateCallbackSelection(
    round: LadderRound,
    championEntryId: string,
    reserveEntryId: string | null,
): CallbackValidation {
    if (round.state === "waiting") {
        return {
            ok: false,
            reason:
                round.scope === "section"
                    ? "This section's callback opens when every class in it is placed."
                    : round.scope === "division"
                      ? "The division callback opens when every section champion is chosen."
                      : "The grand championship opens when every division champion is chosen.",
        };
    }
    const candidates = new Set(round.candidateEntryIds);
    if (!candidates.has(championEntryId)) {
        return {
            ok: false,
            reason:
                round.scope === "section"
                    ? "The champion must be one of this section's 1st-place entries."
                    : round.scope === "division"
                      ? "The division champion must be one of its section champions."
                      : "The grand champion must be one of the division champions.",
        };
    }
    if (reserveEntryId !== null) {
        if (reserveEntryId === championEntryId) {
            return { ok: false, reason: "Champion and reserve must be different entries." };
        }
        if (!candidates.has(reserveEntryId)) {
            return {
                ok: false,
                reason: "The reserve must come from the same callback candidates.",
            };
        }
    }
    return { ok: true };
}
