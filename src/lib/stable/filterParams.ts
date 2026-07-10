/**
 * Digital Stable v2 — URL filter-param vocabulary.
 *
 * The URL is the single source of truth for the stable's filter state:
 * /dashboard?q=…&finish=…&maker=…&scale=…&category=…&trade=…&collection=…&records=1&sort=…
 *
 * Pure functions only (no React, no Supabase) so they are directly
 * unit-testable and shared by the server page, the server actions,
 * and the client filter bar.
 */

export const STABLE_SORTS = ["newest", "oldest", "name-az", "name-za"] as const;
export type StableSort = (typeof STABLE_SORTS)[number];

export const FINISH_OPTIONS = ["OF", "Custom", "Artist Resin"] as const;

export const TRADE_OPTIONS = [
    "For Sale",
    "Open to Offers",
    "Not for Sale",
    "Stolen/Missing",
] as const;

export const CATEGORY_OPTIONS = ["model", "tack", "prop", "diorama", "other_model"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
    model: "Model Horse",
    tack: "Tack & Gear",
    prop: "Prop",
    diorama: "Diorama",
    other_model: "Other Model",
};

export type FinishOption = (typeof FINISH_OPTIONS)[number];
export type TradeOption = (typeof TRADE_OPTIONS)[number];
export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

/** Parsed filter state. Absent key = filter not active. */
export interface StableFilters {
    q?: string;
    finish?: FinishOption;
    maker?: string;
    scale?: string;
    category?: CategoryOption;
    trade?: TradeOption;
    collection?: string;
    hasRecords?: boolean;
    sort: StableSort;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Parse Next.js searchParams into a StableFilters. Unknown values are
 * dropped (never trusted): finish/trade/category/sort must be in their
 * vocabularies, collection must be a UUID.
 */
export function parseStableSearchParams(
    params: Record<string, string | string[] | undefined>,
): StableFilters {
    const filters: StableFilters = { sort: "newest" };

    const q = nonEmpty(params.q, 100);
    if (q) filters.q = q;

    const finish = nonEmpty(params.finish, 40);
    if (finish && (FINISH_OPTIONS as readonly string[]).includes(finish)) {
        filters.finish = finish as FinishOption;
    }

    const maker = nonEmpty(params.maker, 80);
    if (maker) filters.maker = maker;

    const scale = nonEmpty(params.scale, 40);
    if (scale) filters.scale = scale;

    const category = nonEmpty(params.category, 40);
    if (category && (CATEGORY_OPTIONS as readonly string[]).includes(category)) {
        filters.category = category as CategoryOption;
    }

    const trade = nonEmpty(params.trade, 40);
    if (trade && (TRADE_OPTIONS as readonly string[]).includes(trade)) {
        filters.trade = trade as TradeOption;
    }

    const collection = nonEmpty(params.collection, 40);
    if (collection && UUID_RE.test(collection)) filters.collection = collection;

    if (first(params.records) === "1") filters.hasRecords = true;

    const sort = nonEmpty(params.sort, 20);
    if (sort && (STABLE_SORTS as readonly string[]).includes(sort)) {
        filters.sort = sort as StableSort;
    }

    return filters;
}

/**
 * Serialize filters back to URLSearchParams. Defaults (no value,
 * sort=newest) are omitted so the pristine dashboard URL stays clean.
 */
export function buildStableSearchParams(filters: Partial<StableFilters>): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.finish) params.set("finish", filters.finish);
    if (filters.maker) params.set("maker", filters.maker);
    if (filters.scale) params.set("scale", filters.scale);
    if (filters.category) params.set("category", filters.category);
    if (filters.trade) params.set("trade", filters.trade);
    if (filters.collection) params.set("collection", filters.collection);
    if (filters.hasRecords) params.set("records", "1");
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    return params;
}

/** A rubber-stamp chip describing one active filter. */
export interface FilterChip {
    /** Which StableFilters key removing this chip clears. */
    key: "q" | "finish" | "maker" | "scale" | "category" | "trade" | "collection" | "hasRecords";
    label: string;
}

/**
 * The active-filter chips for the ledger bar, in a stable display
 * order. Sort is a view preference, not a filter — no chip.
 */
export function activeFilterChips(
    filters: StableFilters,
    collections: { id: string; name: string }[] = [],
): FilterChip[] {
    const chips: FilterChip[] = [];
    if (filters.q) chips.push({ key: "q", label: `“${filters.q}”` });
    if (filters.finish) chips.push({ key: "finish", label: filters.finish });
    if (filters.maker) chips.push({ key: "maker", label: filters.maker });
    if (filters.scale) chips.push({ key: "scale", label: filters.scale });
    if (filters.category) {
        chips.push({ key: "category", label: CATEGORY_LABELS[filters.category] ?? filters.category });
    }
    if (filters.trade) chips.push({ key: "trade", label: filters.trade });
    if (filters.collection) {
        const name = collections.find((c) => c.id === filters.collection)?.name;
        chips.push({ key: "collection", label: name ?? "Collection" });
    }
    if (filters.hasRecords) chips.push({ key: "hasRecords", label: "Has show records" });
    return chips;
}

/** How many filters are active (sort excluded). */
export function countActiveFilters(filters: StableFilters): number {
    return activeFilterChips(filters).length;
}

/** Remove one filter (chip ✕). Returns a new object. */
export function removeFilter(filters: StableFilters, key: FilterChip["key"]): StableFilters {
    const next = { ...filters };
    delete next[key];
    return next;
}

/** Clear every filter but keep the sort preference. */
export function clearAllFilters(filters: StableFilters): StableFilters {
    return { sort: filters.sort };
}

/**
 * Saved-view params ⇄ filters. Saved views persist the plain-object
 * form of the filters (JSONB in stable_saved_views.params).
 */
export function filtersToViewParams(filters: StableFilters): Record<string, string> {
    const out: Record<string, string> = {};
    buildStableSearchParams(filters).forEach((value, key) => {
        out[key] = value;
    });
    return out;
}

export function viewParamsToFilters(params: Record<string, unknown>): StableFilters {
    const clean: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(params)) {
        if (typeof v === "string") clean[k] = v;
    }
    return parseStableSearchParams(clean);
}
