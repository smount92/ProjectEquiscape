/**
 * Which models the sweep asks about, and in what order.
 *
 * THE BUG THIS REPLACES. The first version ordered the slice by the
 * signals table alone: never-read first, then stalest reading. A model
 * that was swept but produced no signal (fewer than three matching
 * listings) leaves no row in that table, so it still looked never-read
 * and came up again the next Monday — the same unproductive ~150 every
 * week, while thousands of reachable models never got a first look.
 * Three weekly runs wrote 5, 7 and 1 signals.
 *
 * NOW: attempts are the ledger (catalog_price_sweeps, 211), and every
 * model has a DUE time from its last attempt and what came back. The
 * cron runs every four hours and sweeps what is due, most overdue
 * first — never-attempted models before anything else. Nothing is
 * re-asked just because a run happened to fire; that's how two
 * back-to-back runs on the same evening would have spent 2,000 calls
 * re-asking the empty tail thirty minutes later.
 *
 * Before the 211 table exists, a deterministic per-day shuffle of the
 * never-read pool stands in.
 *
 * Pure, so the ordering is tested without a database.
 */

export type SweepResult = "signal" | "no-match" | "error" | "skipped";

/**
 * How long each answer stays fresh. Sized against this keyset's 5,000
 * calls/day (eBay Analytics API, 2026-09-18) over ~3,100 reachable
 * models, of which ~22% have a market at any time:
 *   signal   8 h  → ~690 models × 3/day ≈ 2,070 calls
 *   no-match 36 h → ~2,410 models / 1.5 ≈ 1,610 calls
 *   ≈ 3,700/day, three quarters of the budget, the rest for manual runs.
 * A model with a market is never more than eight hours stale on its
 * page; the tail gets a fresh look every day and a half.
 */
export const REFRESH_HOURS: Record<SweepResult, number> = {
    signal: 8,
    "no-match": 36,
    /** Transient failures retry on the next run. */
    error: 0,
    /** Nothing to ask about; re-checked in case the catalog row changed. */
    skipped: 36,
};

export interface AttemptInfo {
    /** ISO timestamp of the last attempt. */
    at: string;
    outcome: SweepResult;
}

export interface SweepPlan<T> {
    /** Every candidate: never-attempted, then by due time (most overdue first). */
    ordered: T[];
    /** How the order was decided — the response says so. */
    basis: "attempts" | "day-rotation";
    neverAttempted: number;
    /** Never-attempted + attempted-and-due. The cron sweeps at most this many. */
    dueCount: number;
}

/** The UTC calendar day, e.g. "2026-09-18". */
export function dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** FNV-1a — small, stable, good enough to spread ids over a day. */
function hash32(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}

/** When an attempt's answer goes stale. */
export function dueAt(info: AttemptInfo): number {
    return new Date(info.at).getTime() + REFRESH_HOURS[info.outcome] * 3_600_000;
}

export function planSweep<T extends { id: string }>(input: {
    candidates: T[];
    /** observed_at per model with a signal (the rolling table). */
    lastSignal: Map<string, string>;
    /** Last attempt per model (211); null before the paste. */
    lastAttempt: Map<string, AttemptInfo> | null;
    now: Date;
}): SweepPlan<T> {
    const { candidates, lastSignal, lastAttempt, now } = input;

    if (lastAttempt) {
        const never = candidates.filter((c) => !lastAttempt.has(c.id));
        const tried = candidates
            .filter((c) => lastAttempt.has(c.id))
            .map((c) => ({ c, due: dueAt(lastAttempt.get(c.id)!) }))
            .sort((a, b) => a.due - b.due || a.c.id.localeCompare(b.c.id));
        const dueNow = tried.filter((x) => x.due <= now.getTime()).length;
        return {
            ordered: [...never, ...tried.map((x) => x.c)],
            basis: "attempts",
            neverAttempted: never.length,
            dueCount: never.length + dueNow,
        };
    }

    // Pre-211: rotate the never-read pool by day; stalest reading after.
    // Everything counts as due — there is no ledger to say otherwise.
    const day = dayKey(now);
    const never = candidates
        .filter((c) => !lastSignal.has(c.id))
        .map((c) => ({ c, key: hash32(`${day}:${c.id}`) }))
        .sort((a, b) => a.key - b.key || a.c.id.localeCompare(b.c.id))
        .map((x) => x.c);
    const read = candidates
        .filter((c) => lastSignal.has(c.id))
        .sort((a, b) => lastSignal.get(a.id)!.localeCompare(lastSignal.get(b.id)!));
    return {
        ordered: [...never, ...read],
        basis: "day-rotation",
        neverAttempted: never.length,
        dueCount: candidates.length,
    };
}

export interface AttemptRow {
    catalog_item_id: string;
    swept_at: string;
    outcome: SweepResult;
    sample_size: number;
}

/**
 * One ledger row per model the sweep actually asked about. A model the
 * run never reached (rate-limit stop) is absent, so it stays at the
 * front next time.
 */
export function attemptRows(
    perTarget: Record<string, SweepResult>,
    sampleSizes: Map<string, number>,
    now: Date,
): AttemptRow[] {
    const at = now.toISOString();
    return Object.entries(perTarget).map(([id, outcome]) => ({
        catalog_item_id: id,
        swept_at: at,
        outcome,
        sample_size: outcome === "signal" ? (sampleSizes.get(id) ?? 0) : 0,
    }));
}

/** Tally for the run log: { signal: 5, "no-match": 140, error: 0 }. */
export function tallyOutcomes(perTarget: Record<string, SweepResult>): Record<SweepResult, number> {
    const t: Record<SweepResult, number> = { signal: 0, "no-match": 0, error: 0, skipped: 0 };
    for (const r of Object.values(perTarget)) t[r] += 1;
    return t;
}
