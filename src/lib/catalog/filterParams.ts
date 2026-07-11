/**
 * Reference Catalog — URL filter-param vocabulary.
 *
 * The URL is the single source of truth for the catalog browse state:
 * /catalog?q=…&maker=…&scale=…&type=…&sort=…&page=…
 *
 * Pure functions only (no React, no Supabase) so they are directly
 * unit-testable and shared by the server page and the client filter bar.
 * Mirrors src/lib/showring/filterParams.ts.
 */

export const CATALOG_SORTS = ["name-az", "name-za", "maker", "newest"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/**
 * The item_type values users can filter to, with human labels. Only the
 * populated types are offered (tack/medallion/micro_mini are future
 * catalog_items types with no rows yet — see migration 048).
 */
export const CATALOG_TYPE_OPTIONS = [
    { value: "plastic_mold", label: "Mold" },
    { value: "plastic_release", label: "Release" },
    { value: "artist_resin", label: "Artist Resin" },
] as const;

const TYPE_VALUES = CATALOG_TYPE_OPTIONS.map((t) => t.value) as readonly string[];
const TYPE_LABELS: Record<string, string> = Object.fromEntries(
    CATALOG_TYPE_OPTIONS.map((t) => [t.value, t.label]),
);

/** Parsed filter state. Absent key = filter not active. `page` is 1-based. */
export interface CatalogFilters {
    q?: string;
    maker?: string;
    scale?: string;
    type?: string;
    sort: CatalogSort;
    page: number;
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
 * Parse Next.js searchParams into CatalogFilters. Unknown values are
 * dropped (never trusted): type/sort must be in their vocabularies, page
 * is clamped to a sane positive integer.
 */
export function parseCatalogSearchParams(
    params: Record<string, string | string[] | undefined>,
): CatalogFilters {
    const filters: CatalogFilters = { sort: "name-az", page: 1 };

    const q = nonEmpty(params.q, 100);
    if (q) filters.q = q;

    const maker = nonEmpty(params.maker, 80);
    if (maker) filters.maker = maker;

    const scale = nonEmpty(params.scale, 40);
    if (scale) filters.scale = scale;

    const type = nonEmpty(params.type, 40);
    if (type && TYPE_VALUES.includes(type)) filters.type = type;

    const sort = nonEmpty(params.sort, 20);
    if (sort && (CATALOG_SORTS as readonly string[]).includes(sort)) {
        filters.sort = sort as CatalogSort;
    }

    const page = Number.parseInt(first(params.page) ?? "", 10);
    if (Number.isFinite(page) && page > 1) filters.page = Math.min(page, 10_000);

    return filters;
}

/**
 * Serialize filters back to URLSearchParams. Defaults (no value,
 * sort=name-az, page=1) are omitted so the pristine /catalog URL stays clean
 * and canonical for SEO.
 */
export function buildCatalogSearchParams(filters: Partial<CatalogFilters>): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.maker) params.set("maker", filters.maker);
    if (filters.scale) params.set("scale", filters.scale);
    if (filters.type) params.set("type", filters.type);
    if (filters.sort && filters.sort !== "name-az") params.set("sort", filters.sort);
    if (filters.page && filters.page > 1) params.set("page", String(filters.page));
    return params;
}

/** Map a CatalogSort to getCatalogItems' (sortBy, sortDir) shape. */
export function catalogSortToQuery(sort: CatalogSort): {
    sortBy: "title" | "maker" | "created_at";
    sortDir: "asc" | "desc";
} {
    switch (sort) {
        case "name-za":
            return { sortBy: "title", sortDir: "desc" };
        case "maker":
            return { sortBy: "maker", sortDir: "asc" };
        case "newest":
            return { sortBy: "created_at", sortDir: "desc" };
        case "name-az":
        default:
            return { sortBy: "title", sortDir: "asc" };
    }
}

/** A rubber-stamp chip describing one active filter. */
export interface CatalogFilterChip {
    /** Which CatalogFilters key removing this chip clears. */
    key: "q" | "maker" | "scale" | "type";
    label: string;
}

/**
 * The active-filter chips for the ledger bar, in a stable display order.
 * Sort and page are view state, not filters — no chips.
 */
export function activeCatalogChips(filters: CatalogFilters): CatalogFilterChip[] {
    const chips: CatalogFilterChip[] = [];
    if (filters.q) chips.push({ key: "q", label: `“${filters.q}”` });
    if (filters.maker) chips.push({ key: "maker", label: filters.maker });
    if (filters.scale) chips.push({ key: "scale", label: filters.scale });
    if (filters.type) chips.push({ key: "type", label: TYPE_LABELS[filters.type] ?? filters.type });
    return chips;
}

/** How many filters are active (sort/page excluded). */
export function countActiveCatalogFilters(filters: CatalogFilters): number {
    return activeCatalogChips(filters).length;
}

/**
 * Remove one filter (chip ✕). Returns a new object and resets to page 1
 * (the filtered result set changes, so the old page number is meaningless).
 */
export function removeCatalogFilter(
    filters: CatalogFilters,
    key: CatalogFilterChip["key"],
): CatalogFilters {
    const next = { ...filters, page: 1 };
    delete next[key];
    return next;
}

/** Clear every filter but keep the sort preference. Resets to page 1. */
export function clearAllCatalogFilters(filters: CatalogFilters): CatalogFilters {
    return { sort: filters.sort, page: 1 };
}
