/**
 * Which models the daily sweep asks about, and in what order.
 *
 * THE BUG THIS REPLACES. The first version ordered the slice by the
 * signals table alone: never-read first, then stalest reading. A model
 * that was swept but produced no signal (fewer than three matching
 * listings) leaves no row in that table, so it still looked never-read
 * and came up again the next Monday — the same unproductive ~150 every
 * week, while thousands of reachable models never got a first look.
 * Three weekly runs wrote 5, 7 and 1 signals.
 *
 * NOW: attempts are the ledger (catalog_price_sweeps, 211). Never-
 * attempted first, then stalest attempt, whatever the answer was. Until
 * that table exists, a deterministic per-day shuffle of the never-read
 * pool stands in — a different slice each daily run, and the same slice
 * on a same-day re-run so a retry doesn't burn budget on new models.
 *
 * Pure, so the ordering is tested without a database.
 */

export type SweepResult = "signal" | "no-match" | "error" | "skipped";

export interface SweepPlan<T> {
    ordered: T[];
    /** How the order was decided — the response says so. */
    basis: "attempts" | "day-rotation";
    neverAttempted: number;
}

/** The UTC calendar day, e.g. "2026-09-18". The 07:00 UTC run and a
 *  same-day re-run share it. */
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

export function planSweep<T extends { id: string }>(input: {
    candidates: T[];
    /** observed_at per model with a signal (the rolling table). */
    lastSignal: Map<string, string>;
    /** swept_at per model ever attempted (211); null before the paste. */
    lastAttempt: Map<string, string> | null;
    now: Date;
}): SweepPlan<T> {
    const { candidates, lastSignal, lastAttempt, now } = input;

    if (lastAttempt) {
        const never = candidates.filter((c) => !lastAttempt.has(c.id));
        const tried = candidates
            .filter((c) => lastAttempt.has(c.id))
            .sort((a, b) => lastAttempt.get(a.id)!.localeCompare(lastAttempt.get(b.id)!));
        return { ordered: [...never, ...tried], basis: "attempts", neverAttempted: never.length };
    }

    // Pre-211: rotate the never-read pool by day; stalest reading after.
    const day = dayKey(now);
    const never = candidates
        .filter((c) => !lastSignal.has(c.id))
        .map((c) => ({ c, key: hash32(`${day}:${c.id}`) }))
        .sort((a, b) => a.key - b.key || a.c.id.localeCompare(b.c.id))
        .map((x) => x.c);
    const read = candidates
        .filter((c) => lastSignal.has(c.id))
        .sort((a, b) => lastSignal.get(a.id)!.localeCompare(lastSignal.get(b.id)!));
    return { ordered: [...never, ...read], basis: "day-rotation", neverAttempted: never.length };
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
