/**
 * Shows domain — lifecycle state machines. Pure, no I/O.
 *
 * Show lifecycle (design doc §3):
 *   draft → published → entries_open → entries_closed
 *         → running (live) | judging (online)
 *         → results_review → completed → archived
 *
 * Transitions are explicit host actions (plus cron auto-close on
 * deadlines). No status flips hidden inside read functions.
 */

import type { ClassStatus, ShowMode, ShowStatus } from "./types";

export type TransitionResult =
    | { ok: true }
    | { ok: false; reason: string };

// ── Show lifecycle ──

/** Legal next statuses per current status, before mode filtering. */
const SHOW_TRANSITIONS: Record<ShowStatus, ShowStatus[]> = {
    draft: ["published"],
    published: ["entries_open", "draft"],
    entries_open: ["entries_closed"],
    entries_closed: ["running", "judging", "entries_open"], // reopen entries is a host pressure valve
    running: ["results_review"],
    judging: ["results_review"],
    results_review: ["completed", "running", "judging"], // back to fix a recording mistake
    completed: ["archived"],
    archived: [],
};

/** Statuses only reachable in one mode. */
const MODE_ONLY: Partial<Record<ShowStatus, ShowMode>> = {
    running: "live",
    judging: "online",
};

export const SHOW_STATUS_ORDER: ShowStatus[] = [
    "draft",
    "published",
    "entries_open",
    "entries_closed",
    "running",
    "judging",
    "results_review",
    "completed",
    "archived",
];

/**
 * Can a show move from `from` to `to` given its mode?
 * Returns an explicit reason on refusal — surfaced verbatim to hosts.
 */
export function canTransition(
    from: ShowStatus,
    to: ShowStatus,
    mode: ShowMode,
): TransitionResult {
    if (from === to) {
        return { ok: false, reason: `Show is already ${formatStatus(to)}.` };
    }

    const requiredMode = MODE_ONLY[to];
    if (requiredMode && requiredMode !== mode) {
        return {
            ok: false,
            reason:
                to === "running"
                    ? "Only live shows enter the running state — online shows go to judging."
                    : "Only online shows enter the judging state — live shows go to running.",
        };
    }

    const allowed = SHOW_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
        return {
            ok: false,
            reason: `A show cannot go from ${formatStatus(from)} to ${formatStatus(to)}. Next step${allowed.length === 1 ? "" : "s"}: ${
                allowed.length > 0
                    ? allowed
                        .filter((s) => {
                            const m = MODE_ONLY[s];
                            return !m || m === mode;
                        })
                        .map(formatStatus)
                        .join(", ")
                    : "none — the show is archived"
            }.`,
        };
    }

    return { ok: true };
}

/** Human-readable status label ("entries_open" → "entries open"). */
export function formatStatus(status: ShowStatus | ClassStatus): string {
    return status.replace(/_/g, " ");
}

// ── Class lifecycle ──
// scheduled → called → judging → placed
// scheduled | called → combined | cancelled (terminal)
// placed → judging (reopen to fix a recording mistake)

const CLASS_TRANSITIONS: Record<ClassStatus, ClassStatus[]> = {
    scheduled: ["called", "judging", "combined", "cancelled"],
    called: ["judging", "scheduled", "combined", "cancelled"],
    judging: ["placed", "called"],
    placed: ["judging"],
    combined: [],
    cancelled: ["scheduled"], // un-cancel before anything was judged
};

export function canTransitionClass(
    from: ClassStatus,
    to: ClassStatus,
): TransitionResult {
    if (from === to) {
        return { ok: false, reason: `Class is already ${formatStatus(to)}.` };
    }
    const allowed = CLASS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
        return {
            ok: false,
            reason: `A class cannot go from ${formatStatus(from)} to ${formatStatus(to)}.`,
        };
    }
    return { ok: true };
}

/**
 * Split legality: a class may be split while it still awaits
 * judging (scheduled or called). Once judging started or results
 * exist, the classlist is frozen for that class.
 */
export function canSplitClass(status: ClassStatus): TransitionResult {
    if (status === "scheduled" || status === "called") return { ok: true };
    return {
        ok: false,
        reason: `Only scheduled or called classes can be split — this class is ${formatStatus(status)}.`,
    };
}

/**
 * Combine legality: every source class must still await judging.
 * Combining is terminal for the source classes (status becomes
 * 'combined', entries move to the new class).
 */
export function canCombineClass(status: ClassStatus): TransitionResult {
    if (status === "scheduled" || status === "called") return { ok: true };
    return {
        ok: false,
        reason: `Only scheduled or called classes can be combined — this class is ${formatStatus(status)}.`,
    };
}

/** Day-of mutations (split/combine/cancel/record) are only legal while the show runs. */
export function isShowMutableForClasslist(status: ShowStatus): boolean {
    return [
        "draft",
        "published",
        "entries_open",
        "entries_closed",
        "running",
        "judging",
    ].includes(status);
}
