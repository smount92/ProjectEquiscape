/**
 * Admin console — the overdue shows queue. Pure, no I/O.
 *
 * WHAT COUNTS AS OVERDUE, AND WHY
 * ───────────────────────────────
 * The hourly cron (api/cron/transition-shows) owns two lifecycle flips
 * — published → entries_open and entries_open → entries_closed — and
 * ONE nudge: shows past `judging_ends_at` while still in 'judging'. It
 * deliberately never force-flips out of judging, because a
 * community-vote show has no placings until the host finalizes the
 * tally (audit S11). Everything past that point in the lifecycle has no
 * clock at all.
 *
 * That leaves four blind spots this queue covers, and one the cron
 * already covers but never SHOWS anyone:
 *
 *   judging_overdue        past judging_ends_at, still judging. The
 *                          cron nudges this once; the admin has never
 *                          been able to see the list.
 *   judging_no_deadline    still judging with judging_ends_at NULL. The
 *                          cron's own filter is `.not(judging_ends_at,
 *                          is, null)`, so these are invisible to the
 *                          clock FOREVER. Measured from updated_at.
 *   entries_closed_stalled entries closed, never moved to running or
 *                          judging. Nothing advances this state.
 *   running_stalled        a live show still 'running' days after its
 *                          show_date (or long untouched).
 *   results_review_stalled results exist but were never published to
 *                          completed — entrants are waiting on a click.
 *
 * The queue is diagnostic only. Nudging the host is the sole write, and
 * it reuses the cron's own notification type and link so the two
 * dedupe against each other instead of double-pinging.
 */

export type OverdueReason =
    | "judging_overdue"
    | "judging_no_deadline"
    | "entries_closed_stalled"
    | "running_stalled"
    | "results_review_stalled";

/** Judging with no posted deadline: idle this long before we call it stalled. */
export const JUDGING_NO_DEADLINE_DAYS = 14;
/** Entries closed this long ago with no next step. */
export const ENTRIES_CLOSED_STALLED_DAYS = 7;
/** A live show whose show_date is this far past while still 'running'. */
export const RUNNING_PAST_DATE_DAYS = 3;
/** …or untouched this long, for shows with no show_date on file. */
export const RUNNING_IDLE_DAYS = 7;
/** Results sitting in review, unpublished. */
export const RESULTS_REVIEW_STALLED_DAYS = 7;

/** A host may be nudged again after this long — repeated clicks inside it do nothing. */
export const NUDGE_COOLDOWN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const REASON_RANK: Record<OverdueReason, number> = {
    judging_overdue: 0,
    results_review_stalled: 1,
    judging_no_deadline: 2,
    entries_closed_stalled: 3,
    running_stalled: 4,
};

export const OVERDUE_REASON_LABELS: Record<OverdueReason, string> = {
    judging_overdue: "Past its judging deadline",
    judging_no_deadline: "Judging with no deadline set",
    entries_closed_stalled: "Entries closed, never started",
    running_stalled: "Still running after its show date",
    results_review_stalled: "Results never published",
};

export const OVERDUE_REASON_NOTES: Record<OverdueReason, string> = {
    judging_overdue: "The hourly cron nudges this one once. Everything else here has no clock at all.",
    judging_no_deadline:
        "The cron only nudges shows that HAVE a judging_ends_at, so this one is invisible to it permanently.",
    entries_closed_stalled: "Nothing advances entries_closed — the host has to pick running or judging.",
    running_stalled: "Live shows leave 'running' only by host action.",
    results_review_stalled: "Entrants can't see results until the host completes the show.",
};

export interface OverdueShowInput {
    id: string;
    title: string;
    hostId: string;
    status: string;
    judgingEndsAt: string | null;
    entriesCloseAt: string | null;
    /** A DATE column (YYYY-MM-DD), not a timestamp. */
    showDate: string | null;
    updatedAt: string;
}

export interface OverdueClassification {
    reason: OverdueReason;
    /** The deadline (or last-touched stamp) the overdue count is measured from. */
    since: string;
    overdueDays: number;
}

/** Whole days between two instants, floored, never negative. */
export function daysSince(since: string, now: Date): number {
    const then = Date.parse(since);
    if (Number.isNaN(then)) return 0;
    return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

/** ISO timestamp `days` before `now` — the cutoff a PostgREST `lte` compares against. */
export function cutoffIso(now: Date, days: number): string {
    return new Date(now.getTime() - days * DAY_MS).toISOString();
}

/** `YYYY-MM-DD` cutoff for the shows.show_date DATE column. */
export function cutoffDate(now: Date, days: number): string {
    return new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The single authority on "is this show overdue, and why". Both the
 * list and the nudge action run it, so a show can never be nudged for a
 * reason it no longer has.
 */
export function classifyOverdueShow(show: OverdueShowInput, now: Date): OverdueClassification | null {
    const build = (reason: OverdueReason, since: string | null): OverdueClassification | null => {
        if (!since) return null;
        return { reason, since, overdueDays: daysSince(since, now) };
    };

    if (show.status === "judging") {
        if (show.judgingEndsAt) {
            return Date.parse(show.judgingEndsAt) <= now.getTime()
                ? build("judging_overdue", show.judgingEndsAt)
                : null;
        }
        return daysSince(show.updatedAt, now) >= JUDGING_NO_DEADLINE_DAYS
            ? build("judging_no_deadline", show.updatedAt)
            : null;
    }

    if (show.status === "entries_closed") {
        // Prefer the posted deadline; fall back to last-touched for shows
        // the host closed by hand with no entries_close_at on file.
        const since = show.entriesCloseAt ?? show.updatedAt;
        return daysSince(since, now) >= ENTRIES_CLOSED_STALLED_DAYS
            ? build("entries_closed_stalled", since)
            : null;
    }

    if (show.status === "running") {
        if (show.showDate) {
            const days = daysSince(`${show.showDate}T00:00:00Z`, now);
            return days >= RUNNING_PAST_DATE_DAYS ? build("running_stalled", show.showDate) : null;
        }
        return daysSince(show.updatedAt, now) >= RUNNING_IDLE_DAYS
            ? build("running_stalled", show.updatedAt)
            : null;
    }

    if (show.status === "results_review") {
        return daysSince(show.updatedAt, now) >= RESULTS_REVIEW_STALLED_DAYS
            ? build("results_review_stalled", show.updatedAt)
            : null;
    }

    return null;
}

/**
 * The deep link a nudge carries — and, because the cron dedupes on
 * exactly this string, the dedupe key too. Judging shows reuse the
 * cron's `#judging-overdue` verbatim so an admin nudge and the cron
 * nudge can never both fire; the other reasons get their own anchor so
 * they dedupe independently.
 */
export function nudgeLinkFor(showId: string, reason: OverdueReason): string {
    const anchor =
        reason === "judging_overdue" || reason === "judging_no_deadline" ? "judging-overdue" : "stalled";
    return `/shows/host/${showId}#${anchor}`;
}

/** Cooldown gate: null (never nudged) always passes. */
export function canNudgeAgain(lastNudgedAt: string | null, now: Date): boolean {
    if (!lastNudgedAt) return true;
    return daysSince(lastNudgedAt, now) >= NUDGE_COOLDOWN_DAYS;
}

/**
 * The nudge body. Same voice as the cron's ("finalize the results when
 * ready") — a reminder to a volunteer host, never a reprimand, and it
 * never claims the admin will do anything about it.
 */
export function buildNudgeContent(title: string, classification: OverdueClassification): string {
    const { reason, overdueDays } = classification;
    const span = overdueDays === 0 ? "today" : `${overdueDays} day${overdueDays === 1 ? "" : "s"} ago`;

    switch (reason) {
        case "judging_overdue":
            return `Judging for "${title}" passed its deadline ${span} — finalize the results when ready.`;
        case "judging_no_deadline":
            return `"${title}" has been in judging since ${span} with no posted deadline — finalize the results when ready, or set a judging deadline so entrants know when to expect them.`;
        case "entries_closed_stalled":
            return `Entries for "${title}" closed ${span} and the show hasn't started yet — move it to judging (or running) when you're ready.`;
        case "running_stalled":
            return `"${title}" is still marked as running ${span} after its show date — send it to results review when the ring is done.`;
        case "results_review_stalled":
            return `Results for "${title}" have been in review since ${span} — entrants can't see them until the show is completed.`;
    }
}

/** Worst-first: reason severity, then how long it has been sitting. */
export function sortOverdue<T extends { reason: OverdueReason; overdueDays: number }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => {
        const byReason = REASON_RANK[a.reason] - REASON_RANK[b.reason];
        if (byReason !== 0) return byReason;
        return b.overdueDays - a.overdueDays;
    });
}
