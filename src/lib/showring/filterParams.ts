/**
 * Show Ring v2 — URL filter-param vocabulary.
 *
 * The URL is the single source of truth for the Show Ring's filter
 * state: /community?q=…&finish=…&maker=…&scale=…&trade=…&sort=…
 *
 * Pure functions only (no React, no Supabase) so they are directly
 * unit-testable and shared by the server page, the server actions,
 * and the client filter bar. Mirrors src/lib/stable/filterParams.ts.
 */

/**
 * Honest sorts only. The old ShowRingFilters offered "most-favorited"
 * but it was never implemented server-side — it silently sorted by
 * newest. Removed rather than faked: an honest implementation needs
 * ordering by favorites count across ALL public horses, which
 * PostgREST cannot do without a denormalized favorites_count column
 * (trigger-maintained) or a view — a future migration, out of scope
 * for this zero-migration build.
 */
export const SHOWRING_SORTS = ["newest", "oldest"] as const;
export type ShowRingSort = (typeof SHOWRING_SORTS)[number];

export const SHOWRING_FINISH_OPTIONS = ["OF", "Custom", "Artist Resin"] as const;

/**
 * Only the marketplace-meaningful statuses: browsing OTHERS' horses,
 * "Not for Sale" / "Stolen/Missing" aren't shopping filters (matches
 * the options the old dropdown offered).
 */
export const SHOWRING_TRADE_OPTIONS = ["For Sale", "Open to Offers"] as const;

export type ShowRingFinishOption = (typeof SHOWRING_FINISH_OPTIONS)[number];
export type ShowRingTradeOption = (typeof SHOWRING_TRADE_OPTIONS)[number];

/** Parsed filter state. Absent key = filter not active. */
export interface ShowRingFilters {
    q?: string;
    finish?: ShowRingFinishOption;
    maker?: string;
    scale?: string;
    trade?: ShowRingTradeOption;
    sort: ShowRingSort;
}

function first(v: string | string[] | undefined): string | undefined {
    if (Array.isArray(v)) return v[0];
    return v;
}

function nonEmpty(v: string | string[] | undefined, max: number): string | undefined {
    const s = first(v)?.trim();
    if (!s) return undefined;
    return s.slice(0, max);
}

/**
 * Parse Next.js searchParams into ShowRingFilters. Unknown values are
 * dropped (never trusted): finish/trade/sort must be in their
 * vocabularies.
 */
export function parseShowRingSearchParams(
    params: Record<string, string | string[] | undefined>,
): ShowRingFilters {
    const filters: ShowRingFilters = { sort: "newest" };

    const q = nonEmpty(params.q, 100);
    if (q) filters.q = q;

    const finish = nonEmpty(params.finish, 40);
    if (finish && (SHOWRING_FINISH_OPTIONS as readonly string[]).includes(finish)) {
        filters.finish = finish as ShowRingFinishOption;
    }

    const maker = nonEmpty(params.maker, 80);
    if (maker) filters.maker = maker;

    const scale = nonEmpty(params.scale, 40);
    if (scale) filters.scale = scale;

    const trade = nonEmpty(params.trade, 40);
    if (trade && (SHOWRING_TRADE_OPTIONS as readonly string[]).includes(trade)) {
        filters.trade = trade as ShowRingTradeOption;
    }

    const sort = nonEmpty(params.sort, 20);
    if (sort && (SHOWRING_SORTS as readonly string[]).includes(sort)) {
        filters.sort = sort as ShowRingSort;
    }

    return filters;
}

/**
 * Serialize filters back to URLSearchParams. Defaults (no value,
 * sort=newest) are omitted so the pristine /community URL stays clean.
 */
export function buildShowRingSearchParams(filters: Partial<ShowRingFilters>): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.finish) params.set("finish", filters.finish);
    if (filters.maker) params.set("maker", filters.maker);
    if (filters.scale) params.set("scale", filters.scale);
    if (filters.trade) params.set("trade", filters.trade);
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    return params;
}

/** A rubber-stamp chip describing one active filter. */
export interface ShowRingFilterChip {
    /** Which ShowRingFilters key removing this chip clears. */
    key: "q" | "finish" | "maker" | "scale" | "trade";
    label: string;
}

/**
 * The active-filter chips for the ledger bar, in a stable display
 * order. Sort is a view preference, not a filter — no chip.
 */
export function activeShowRingChips(filters: ShowRingFilters): ShowRingFilterChip[] {
    const chips: ShowRingFilterChip[] = [];
    if (filters.q) chips.push({ key: "q", label: `“${filters.q}”` });
    if (filters.finish) chips.push({ key: "finish", label: filters.finish });
    if (filters.maker) chips.push({ key: "maker", label: filters.maker });
    if (filters.scale) chips.push({ key: "scale", label: filters.scale });
    if (filters.trade) chips.push({ key: "trade", label: filters.trade });
    return chips;
}

/** How many filters are active (sort excluded). */
export function countActiveShowRingFilters(filters: ShowRingFilters): number {
    return activeShowRingChips(filters).length;
}

/** Remove one filter (chip ✕). Returns a new object. */
export function removeShowRingFilter(
    filters: ShowRingFilters,
    key: ShowRingFilterChip["key"],
): ShowRingFilters {
    const next = { ...filters };
    delete next[key];
    return next;
}

/** Clear every filter but keep the sort preference. */
export function clearAllShowRingFilters(filters: ShowRingFilters): ShowRingFilters {
    return { sort: filters.sort };
}
