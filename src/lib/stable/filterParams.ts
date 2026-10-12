/**
 * Digital Stable v2 — URL filter-param vocabulary.
 *
 * The URL is the single source of truth for the stable's filter state
 * AND the reader's place in it:
 * /dashboard?q=…&finish=…&maker=…&scale=…&category=…&trade=…&collection=…&records=1&sort=…&page=3&per=96
 *
 * The place used to live in component state (Show More appended into
 * a useState list), so opening a horse and coming back dropped the
 * member onto the first 48 again (member report, 2026-10-12). Page and
 * page size are now URL state like everything else: Back restores them.
 *
 * Pure functions only (no React, no Supabase) so they are directly
 * unit-testable and shared by the server page, the server actions,
 * and the client filter bar.
 */

export const STABLE_SORTS = ["newest", "oldest", "name-az", "name-za"] as const;
export type StableSort = (typeof STABLE_SORTS)[number];

/** Page sizes on offer. 192 is the server cap (getStablePageSchema). */
export const STABLE_PER_OPTIONS = [24, 48, 96, 192] as const;
export type StablePer = (typeof STABLE_PER_OPTIONS)[number];
export const DEFAULT_STABLE_PER: StablePer = 48;
/** Highest page number the URL may name (offsets past the end are clamped on the server). */
export const MAX_STABLE_PAGE = 10_000;

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
    /** Catalog id of a mold; matches horses on the mold and on any of its releases. */
    mold?: string;
    hasRecords?: boolean;
    /** Only horses with no Registry link (catalog_id null). */
    unlinked?: boolean;
    sort: StableSort;
    /** 1-based page. View state, not a filter: absent = page 1. */
    page?: number;
    /** Page size. View state, not a filter: absent = DEFAULT_STABLE_PER. */
    per?: StablePer;
}

/** The page the filters name (1 when absent). */
export function pageOf(filters: Pick<StableFilters, "page">): number {
    return filters.page && filters.page > 1 ? filters.page : 1;
}

/** The page size the filters name (DEFAULT_STABLE_PER when absent). */
export function perOf(filters: Pick<StableFilters, "per">): StablePer {
    return filters.per ?? DEFAULT_STABLE_PER;
}

function parsePage(v: string | undefined): number | undefined {
    if (!v || !/^\d{1,6}$/.test(v)) return undefined;
    const n = Number(v);
    if (n <= 1 || n > MAX_STABLE_PAGE) return undefined;
    return n;
}

function parsePer(v: string | undefined): StablePer | undefined {
    if (!v || !/^\d{1,4}$/.test(v)) return undefined;
    const n = Number(v);
    if (n === DEFAULT_STABLE_PER) return undefined;
    return (STABLE_PER_OPTIONS as readonly number[]).includes(n) ? (n as StablePer) : undefined;
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

    const mold = nonEmpty(params.mold, 40);
    if (mold && /^[0-9a-f-]{36}$/i.test(mold)) filters.mold = mold;

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
    if (first(params.unlinked) === "1") filters.unlinked = true;

    const sort = nonEmpty(params.sort, 20);
    if (sort && (STABLE_SORTS as readonly string[]).includes(sort)) {
        filters.sort = sort as StableSort;
    }

    // Place in the list: dropped when invalid, normalised away when default.
    const page = parsePage(nonEmpty(params.page, 10));
    if (page) filters.page = page;
    const per = parsePer(nonEmpty(params.per, 10));
    if (per) filters.per = per;

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
    if (filters.mold) params.set("mold", filters.mold);
    if (filters.category) params.set("category", filters.category);
    if (filters.trade) params.set("trade", filters.trade);
    if (filters.collection) params.set("collection", filters.collection);
    if (filters.hasRecords) params.set("records", "1");
    if (filters.unlinked) params.set("unlinked", "1");
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    if (filters.page && filters.page > 1) params.set("page", String(filters.page));
    if (filters.per && filters.per !== DEFAULT_STABLE_PER) params.set("per", String(filters.per));
    return params;
}

/** The dashboard URL for a filter state (path only when pristine). */
export function stableHref(filters: Partial<StableFilters>, path = "/dashboard"): string {
    const qs = buildStableSearchParams(filters).toString();
    return qs ? `${path}?${qs}` : path;
}

/** Same filters, sort and page size (ignores the page number)? */
export function sameFilterSet(a: StableFilters, b: StableFilters): boolean {
    return (
        buildStableSearchParams({ ...a, page: undefined }).toString() ===
        buildStableSearchParams({ ...b, page: undefined }).toString()
    );
}

/**
 * A filter, sort or saved-view change: always back to page 1 (the old
 * page number means nothing in a different result set). Returns null
 * when nothing actually changed — the search box submits on blur, and
 * a blur must never throw the member off the page they are on.
 */
export function applyFilterChange(current: StableFilters, next: StableFilters): StableFilters | null {
    if (sameFilterSet(current, next)) return null;
    const out = { ...next };
    delete out.page;
    return out;
}

/** The filters and sort without the reader's place (for whole-result-set queries). */
export function withoutPlace(filters: StableFilters): StableFilters {
    const out = { ...filters };
    delete out.page;
    delete out.per;
    return out;
}

/** Jump to a page, same filters and page size. */
export function withPage(filters: StableFilters, page: number): StableFilters {
    const out = { ...filters };
    if (page > 1) out.page = Math.min(Math.floor(page), MAX_STABLE_PAGE);
    else delete out.page;
    return out;
}

/**
 * Change the page size and keep the reader's place: the new page is the
 * one holding the first horse they were looking at (97–144 at 48 a page
 * becomes page 2 at 96 a page, 97–192), not page 1.
 */
export function withPer(filters: StableFilters, per: StablePer): StableFilters {
    const firstIndex = (pageOf(filters) - 1) * perOf(filters);
    const out = { ...filters };
    if (per === DEFAULT_STABLE_PER) delete out.per;
    else out.per = per;
    return withPage(out, Math.floor(firstIndex / per) + 1);
}

/** A rubber-stamp chip describing one active filter. */
export interface FilterChip {
    /** Which StableFilters key removing this chip clears. */
    key: "q" | "finish" | "maker" | "scale" | "mold" | "category" | "trade" | "collection" | "hasRecords" | "unlinked";
    label: string;
}

/**
 * The active-filter chips for the ledger bar, in a stable display
 * order. Sort, page and page size are view state, not filters — no chips.
 */
export function activeFilterChips(
    filters: StableFilters,
    collections: { id: string; name: string }[] = [],
    molds: { id: string; label: string }[] = [],
): FilterChip[] {
    const chips: FilterChip[] = [];
    if (filters.q) chips.push({ key: "q", label: `“${filters.q}”` });
    if (filters.finish) chips.push({ key: "finish", label: filters.finish });
    if (filters.maker) chips.push({ key: "maker", label: filters.maker });
    if (filters.scale) chips.push({ key: "scale", label: filters.scale });
    if (filters.mold) {
        chips.push({ key: "mold", label: molds.find((m) => m.id === filters.mold)?.label ?? "Mold" });
    }
    if (filters.category) {
        chips.push({ key: "category", label: CATEGORY_LABELS[filters.category] ?? filters.category });
    }
    if (filters.trade) chips.push({ key: "trade", label: filters.trade });
    if (filters.collection) {
        const name = collections.find((c) => c.id === filters.collection)?.name;
        chips.push({ key: "collection", label: name ?? "Collection" });
    }
    if (filters.hasRecords) chips.push({ key: "hasRecords", label: "Has show records" });
    if (filters.unlinked) chips.push({ key: "unlinked", label: "Not in Registry" });
    return chips;
}

/** How many filters are active (sort excluded). */
export function countActiveFilters(filters: StableFilters): number {
    return activeFilterChips(filters).length;
}

/** Remove one filter (chip ✕) and go back to page 1. Returns a new object. */
export function removeFilter(filters: StableFilters, key: FilterChip["key"]): StableFilters {
    const next = { ...filters };
    delete next[key];
    delete next.page;
    return next;
}

/** Clear every filter but keep the sort and page-size preferences. */
export function clearAllFilters(filters: StableFilters): StableFilters {
    const next: StableFilters = { sort: filters.sort };
    if (filters.per) next.per = filters.per;
    return next;
}

/**
 * Saved-view params ⇄ filters. Saved views persist the plain-object
 * form of the filters (JSONB in stable_saved_views.params). A view
 * remembers its page size but never a page number: a view opens at
 * its first page, whatever page it was saved from.
 */
export function filtersToViewParams(filters: StableFilters): Record<string, string> {
    const out: Record<string, string> = {};
    buildStableSearchParams({ ...filters, page: undefined }).forEach((value, key) => {
        out[key] = value;
    });
    return out;
}

export function viewParamsToFilters(params: Record<string, unknown>): StableFilters {
    const clean: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(params)) {
        if (typeof v === "string" && k !== "page") clean[k] = v;
    }
    return parseStableSearchParams(clean);
}
