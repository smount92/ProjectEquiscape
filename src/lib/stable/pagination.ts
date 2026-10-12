/**
 * Stable paging arithmetic — pure, shared by getStablePage (offset and
 * the past-the-end clamp) and the pagination controls (range line and
 * the compact page list).
 */

/** Pages needed for `total` rows at `per` a page; never less than 1. */
export function pageCountFor(total: number, per: number): number {
    if (total <= 0 || per <= 0) return 1;
    return Math.ceil(total / per);
}

/** A requested page pulled into 1..pageCount. */
export function clampPage(page: number, pageCount: number): number {
    if (!Number.isFinite(page) || page < 1) return 1;
    return Math.min(Math.floor(page), Math.max(1, pageCount));
}

/** Row offset of a 1-based page. */
export function offsetFor(page: number, per: number): number {
    return (Math.max(1, Math.floor(page)) - 1) * per;
}

/**
 * The "Showing 97–144 of 412" numbers for a page holding `shown` rows.
 * Zero rows → from = to = 0.
 */
export function rangeOf(page: number, per: number, shown: number): { from: number; to: number } {
    if (shown <= 0) return { from: 0, to: 0 };
    const from = offsetFor(page, per) + 1;
    return { from, to: from + shown - 1 };
}

export type PageItem = number | "gap";

/**
 * The compact page list: first, current ±2, last, with a "gap" where
 * pages are skipped. A gap of exactly one page shows that page instead
 * (1 2 3 4 5 reads better than 1 … 3 4 5).
 */
export function pageWindow(page: number, pageCount: number, radius = 2): PageItem[] {
    if (pageCount <= 1) return [1];
    const current = clampPage(page, pageCount);
    const wanted = new Set<number>([1, pageCount]);
    for (let p = current - radius; p <= current + radius; p++) {
        if (p >= 1 && p <= pageCount) wanted.add(p);
    }
    const sorted = [...wanted].sort((a, b) => a - b);
    const out: PageItem[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        const prev = sorted[i - 1];
        if (prev !== undefined) {
            if (p - prev === 2) out.push(prev + 1);
            else if (p - prev > 2) out.push("gap");
        }
        out.push(p);
    }
    return out;
}
