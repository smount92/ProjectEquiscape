/**
 * Growth series for the admin Insights tab: things created per day over
 * the last 7 / 30 / 90 days, from created_at stamps. Pure — the action
 * fetches the stamps, this shapes them.
 */
export const GROWTH_RANGES = [7, 30, 90] as const;
export type GrowthRange = (typeof GROWTH_RANGES)[number];

export function isGrowthRange(x: unknown): x is GrowthRange {
    return typeof x === "number" && (GROWTH_RANGES as readonly number[]).includes(x);
}

/** YYYY-MM-DD in UTC. */
export function utcDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** The last `days` UTC days ending today, oldest first. */
export function dayLabels(days: number, now: Date = new Date()): string[] {
    const out: string[] = [];
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    for (let i = days - 1; i >= 0; i--) out.push(utcDay(new Date(end - i * 86_400_000)));
    return out;
}

/** Count of stamps per day across the window; days with nothing are 0. */
export function bucketByDay(stamps: readonly (string | null | undefined)[], days: number, now: Date = new Date()): number[] {
    const labels = dayLabels(days, now);
    const index = new Map(labels.map((d, i) => [d, i]));
    const counts = new Array<number>(labels.length).fill(0);
    for (const s of stamps) {
        if (!s) continue;
        const i = index.get(String(s).slice(0, 10));
        if (i !== undefined) counts[i] += 1;
    }
    return counts;
}

/** Stamps that fall in the window of the same length immediately before this one. */
export function countPriorWindow(stamps: readonly (string | null | undefined)[], days: number, now: Date = new Date()): number {
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * 86_400_000;
    const start = end - days * 86_400_000;
    let n = 0;
    for (const s of stamps) {
        if (!s) continue;
        const t = Date.parse(String(s));
        if (t >= start && t < end) n += 1;
    }
    return n;
}

/** "+12 vs prior 30 days", "same as prior", or "first 30 days" when there is no prior. */
export function deltaLabel(current: number, prior: number, days: number): string {
    if (prior === 0 && current === 0) return `nothing in ${days} days`;
    if (prior === 0) return `first ${days} days`;
    const diff = current - prior;
    if (diff === 0) return `same as prior ${days} days`;
    return `${diff > 0 ? "+" : "−"}${Math.abs(diff)} vs prior ${days} days`;
}

/** Short tick for an axis: "Mar 23". */
export function shortDay(day: string): string {
    const d = new Date(`${day}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
