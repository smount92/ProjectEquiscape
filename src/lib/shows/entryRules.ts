/**
 * Shows domain — entry validation. Pure function over provided
 * data; the caller (actions layer, Phase D) loads the context and
 * persists on success.
 *
 * Encodes the design doc's key rules:
 *  - A horse enters only ONE breed-halter class per show —
 *    entering breed halter declares which breed the model
 *    represents. Enforced server-side per division-axis (fixes
 *    the old client-only gap). The same horse may still enter
 *    workmanship, collectibility, and performance freely.
 *  - Owner ≠ handler (proxy showing) is first-class and legal.
 *  - Per-class max_per_entrant, allowed_scales / allowed_finishes.
 *  - Entries only while the show is entries_open (window check).
 *
 * SCRATCH / RE-ENTRY CONTRACT (mirrors the partial unique index
 * uq_show_class_entries_live in migration 117):
 *  - Scratched rows are HISTORY. They are never reactivated and
 *    never move between classes (split/combine leave them in their
 *    source class).
 *  - Re-entering a class after a scratch creates a NEW row; the
 *    scratched row stays behind as the audit trail.
 *  - Uniqueness ("a horse enters a class at most once") therefore
 *    applies only to LIVE rows (status <> 'scratched') — which is
 *    exactly what the `active` filter below evaluates against.
 */

import type {
    ClassStatus,
    DivisionAxis,
    EntryStatus,
    ShowMode,
    ShowStatus,
} from "./types";

export interface EntryCandidate {
    horseId: string;
    ownerId: string;
    /** null/undefined = owner handles their own horse. */
    handlerId?: string | null;
    /** Required judged object for online shows (may be attached later — soft). */
    photoId?: string | null;
}

export interface HorseFacts {
    id: string;
    ownerId: string;
    /** e.g. "Traditional", "Classic", "Stablemate" — nullable when unknown. */
    scale?: string | null;
    /** e.g. "OF", "CM", "AR" — nullable when unknown. */
    finish?: string | null;
}

export interface ClassFacts {
    id: string;
    status: ClassStatus;
    maxPerEntrant: number | null;
    allowedScales: string[] | null;
    allowedFinishes: string[] | null;
    /** Axis of the division this class belongs to. */
    divisionAxis: DivisionAxis;
}

export interface ShowFacts {
    id: string;
    mode: ShowMode;
    status: ShowStatus;
    /** ISO timestamp; null = no explicit deadline (status governs). */
    entriesCloseAt?: string | null;
}

/** An existing entry at this show, as needed by the rules. */
export interface ExistingEntry {
    classId: string;
    horseId: string;
    ownerId: string;
    status: EntryStatus;
    divisionAxis: DivisionAxis;
}

export interface ValidateEntryInput {
    candidate: EntryCandidate;
    horse: HorseFacts;
    show: ShowFacts;
    targetClass: ClassFacts;
    /** ALL entries at this show for rule evaluation (scratched ones are ignored). */
    existingEntries: ExistingEntry[];
    /** Injectable clock for the window check; defaults to now. */
    now?: Date;
}

export type ValidateEntryResult =
    | { ok: true }
    | { ok: false; errors: string[] };

export function validateEntry(input: ValidateEntryInput): ValidateEntryResult {
    const { candidate, horse, show, targetClass, existingEntries } = input;
    const now = input.now ?? new Date();
    const errors: string[] = [];

    // ── Window: show must be accepting entries ──
    if (show.status !== "entries_open") {
        errors.push("Entries are not open for this show.");
    } else if (show.entriesCloseAt && now.getTime() > new Date(show.entriesCloseAt).getTime()) {
        errors.push("The entry deadline for this show has passed.");
    }

    // ── Class must still be enterable ──
    if (targetClass.status !== "scheduled") {
        errors.push(
            targetClass.status === "combined"
                ? "This class was combined into another class — enter the combined class instead."
                : targetClass.status === "cancelled"
                    ? "This class has been cancelled."
                    : "This class is no longer accepting entries.",
        );
    }

    // ── Ownership: you enter your own horses (proxy = handler differs) ──
    if (horse.id !== candidate.horseId || horse.ownerId !== candidate.ownerId) {
        errors.push("You can only enter horses you own. To have someone else show your horse, name them as the handler.");
    }

    const active = existingEntries.filter((e) => e.status !== "scratched");

    // ── No double entry in the same class ──
    if (active.some((e) => e.classId === targetClass.id && e.horseId === candidate.horseId)) {
        errors.push("This horse is already entered in this class.");
    }

    // ── ONE breed-halter class per horse per show ──
    if (targetClass.divisionAxis === "halter") {
        const otherHalter = active.find(
            (e) =>
                e.horseId === candidate.horseId &&
                e.divisionAxis === "halter" &&
                e.classId !== targetClass.id,
        );
        if (otherHalter) {
            errors.push(
                "This horse is already entered in a breed halter class at this show. Entering breed halter declares the model's breed, so each horse shows in exactly one halter class. (It may still enter performance, workmanship, and collectibility classes.)",
            );
        }
    }

    // ── Per-class entrant cap ──
    if (targetClass.maxPerEntrant !== null && targetClass.maxPerEntrant > 0) {
        const mine = active.filter(
            (e) => e.classId === targetClass.id && e.ownerId === candidate.ownerId,
        ).length;
        if (mine >= targetClass.maxPerEntrant) {
            errors.push(
                `This class allows at most ${targetClass.maxPerEntrant} ${targetClass.maxPerEntrant === 1 ? "entry" : "entries"} per entrant.`,
            );
        }
    }

    // ── Scale / finish eligibility ──
    if (targetClass.allowedScales && targetClass.allowedScales.length > 0) {
        if (!horse.scale || !targetClass.allowedScales.includes(horse.scale)) {
            errors.push(
                `This class is limited to ${targetClass.allowedScales.join(", ")} scale models${horse.scale ? ` — this horse is ${horse.scale}` : ""}.`,
            );
        }
    }
    if (targetClass.allowedFinishes && targetClass.allowedFinishes.length > 0) {
        if (!horse.finish || !targetClass.allowedFinishes.includes(horse.finish)) {
            errors.push(
                `This class is limited to ${targetClass.allowedFinishes.join(", ")} finishes${horse.finish ? ` — this horse is ${horse.finish}` : ""}.`,
            );
        }
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true };
}
