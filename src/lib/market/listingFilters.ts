/**
 * Marketplace front door — URL filter vocabulary (pure).
 *
 * /market is the marketplace: a browse of PROVENANCE-PRICED LISTINGS
 * (public horses whose trade_status is "For Sale" / "Open to Offers").
 * The Blue Book price guide moved to /market/guide and keeps its own
 * param names (q/type/finish/stage/sort/page) — the two surfaces must
 * never fight over the same query string, so everything the front door
 * understands is declared here.
 *
 * Same contract as src/lib/showring/filterParams.ts: the URL is the
 * single source of truth, parsing is total (never throws, unknown
 * values fall back to "no filter"), and building is the exact inverse
 * so the back button steps filters instead of wiping them.
 *
 * Pure — no I/O, no Supabase. The query lives in
 * src/app/market/listings.ts.
 */

/** Trade statuses that constitute a live listing. */
export const LISTING_TRADE_STATUSES = ["For Sale", "Open to Offers"] as const;

/** finish_type is a 3-value enum; "" means no filter. */
export const LISTING_FINISH_OPTIONS = ["OF", "Custom", "Artist Resin"] as const;

/** Listings shown per page. */
export const LISTINGS_PAGE_SIZE = 24;

/**
 * Price bands, in dollars. `max: null` = open-ended top band. The id
 * is the URL value (`?price=150-500`) so the bands are self-describing
 * in a shared link.
 */
export interface PriceBand {
    id: string;
    label: string;
    min: number;
    max: number | null;
}

export const PRICE_BANDS: readonly PriceBand[] = [
    { id: "0-50", label: "Under $50", min: 0, max: 50 },
    { id: "50-150", label: "$50 – $150", min: 50, max: 150 },
    { id: "150-500", label: "$150 – $500", min: 150, max: 500 },
    { id: "500-1500", label: "$500 – $1,500", min: 500, max: 1500 },
    { id: "1500-", label: "$1,500+", min: 1500, max: null },
];

/** Sort options — the URL value is `field:direction`. */
export const LISTING_SORT_OPTIONS = [
    { value: "newest", label: "Newest listings" },
    { value: "price_asc", label: "Price: low to high" },
    { value: "price_desc", label: "Price: high to low" },
] as const;

export type ListingSort = (typeof LISTING_SORT_OPTIONS)[number]["value"];

const DEFAULT_SORT: ListingSort = "newest";

/** The complete filter state of the marketplace browse. */
export interface ListingFilters {
    /** Free text over horse name, maker, catalog title, sculptor. */
    q?: string;
    /** finish_type equality. */
    finish?: string;
    /** PriceBand id. */
    price?: string;
    /** Only horses with at least one show record. */
    hasRecords?: boolean;
    /** Only "For Sale" or only "Open to Offers" (default: both). */
    trade?: string;
    sort?: ListingSort;
}

/** Raw searchParams as Next.js hands them to a server component. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(raw: string | string[] | undefined): string | undefined {
    if (Array.isArray(raw)) return raw[0];
    return raw;
}

/** Look up a band by its URL id. Unknown ids → null (no filter). */
export function findPriceBand(id: string | null | undefined): PriceBand | null {
    if (!id) return null;
    return PRICE_BANDS.find((b) => b.id === id) ?? null;
}

/**
 * Parse the URL into filter state. Total: junk in → filter absent,
 * never an exception and never a value the query builder can't use.
 */
export function parseListingFilters(params: RawSearchParams): ListingFilters {
    const filters: ListingFilters = {};

    const q = firstValue(params.q)?.trim();
    if (q) filters.q = q.slice(0, 100);

    const finish = firstValue(params.finish);
    if (finish && (LISTING_FINISH_OPTIONS as readonly string[]).includes(finish)) {
        filters.finish = finish;
    }

    const price = firstValue(params.price);
    if (findPriceBand(price)) filters.price = price;

    if (firstValue(params.records) === "1") filters.hasRecords = true;

    const trade = firstValue(params.trade);
    if (trade && (LISTING_TRADE_STATUSES as readonly string[]).includes(trade)) {
        filters.trade = trade;
    }

    const sort = firstValue(params.sort);
    if (sort && LISTING_SORT_OPTIONS.some((o) => o.value === sort)) {
        filters.sort = sort as ListingSort;
    }

    return filters;
}

/** 1-based page number from the URL; junk and <1 collapse to page 1. */
export function parseListingPage(params: RawSearchParams): number {
    const raw = firstValue(params.page);
    const page = Number.parseInt(raw ?? "1", 10);
    if (!Number.isFinite(page) || page < 1) return 1;
    // Bound the offset so a crafted ?page=99999999 can't ask the
    // database for a billion-row offset.
    return Math.min(page, 500);
}

/**
 * Filters (+ optional page) → query string. Defaults are omitted so
 * the canonical unfiltered URL is a bare `/market`.
 */
export function buildListingSearchParams(
    filters: ListingFilters,
    page = 1,
): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.finish) params.set("finish", filters.finish);
    if (filters.price) params.set("price", filters.price);
    if (filters.hasRecords) params.set("records", "1");
    if (filters.trade) params.set("trade", filters.trade);
    if (filters.sort && filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
    if (page > 1) params.set("page", String(page));
    return params;
}

/** `/market?…` for the given state (bare `/market` when unfiltered). */
export function buildListingHref(filters: ListingFilters, page = 1): string {
    const qs = buildListingSearchParams(filters, page).toString();
    return qs ? `/market?${qs}` : "/market";
}

/** How many filters are active — drives the "Clear all" affordance. */
export function countActiveListingFilters(filters: ListingFilters): number {
    let count = 0;
    if (filters.q) count += 1;
    if (filters.finish) count += 1;
    if (filters.price) count += 1;
    if (filters.hasRecords) count += 1;
    if (filters.trade) count += 1;
    return count;
}

/** One removable filter chip: label to show, key to delete. */
export interface ListingChip {
    key: keyof ListingFilters;
    label: string;
}

/** Active filters as removable chips (sort is never a chip). */
export function activeListingChips(filters: ListingFilters): ListingChip[] {
    const chips: ListingChip[] = [];
    if (filters.q) chips.push({ key: "q", label: `“${filters.q}”` });
    if (filters.trade) chips.push({ key: "trade", label: filters.trade });
    if (filters.finish) chips.push({ key: "finish", label: filters.finish });
    const band = findPriceBand(filters.price);
    if (band) chips.push({ key: "price", label: band.label });
    if (filters.hasRecords) chips.push({ key: "hasRecords", label: "Has show record" });
    return chips;
}

// ── Card presentation (pure) ──

const PRICE_FORMAT = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

/**
 * The price line on a listing card. A "For Sale" horse with no price
 * on it is NOT free and is not "$0" — it reads "Ask for price", the
 * same honesty rule the record chip follows (never fake a zero).
 */
export function listingPriceLabel(
    tradeStatus: string,
    listingPrice: number | null | undefined,
): string {
    const hasPrice = typeof listingPrice === "number" && Number.isFinite(listingPrice) && listingPrice > 0;
    if (tradeStatus === "Open to Offers") {
        return hasPrice ? `Open to offers · ~${PRICE_FORMAT.format(listingPrice as number)}` : "Open to offers";
    }
    return hasPrice ? PRICE_FORMAT.format(listingPrice as number) : "Ask for price";
}

/** Plain currency, for the guide cross-link and band labels. */
export function formatListingPrice(value: number): string {
    return PRICE_FORMAT.format(value);
}

/**
 * Guide-only params (the Blue Book vocabulary) present on a /market
 * URL — someone followed an old price-guide deep link. We keep the
 * link alive by offering /market/guide with the params carried over
 * rather than silently reinterpreting them.
 */
export function guideHandoffHref(params: RawSearchParams): string | null {
    const guideOnly = ["type", "stage"];
    const carried = new URLSearchParams();
    let sawGuideParam = false;
    for (const key of guideOnly) {
        const value = firstValue(params[key]);
        if (value) {
            sawGuideParam = true;
            carried.set(key, value);
        }
    }
    if (!sawGuideParam) return null;
    const q = firstValue(params.q)?.trim();
    if (q) carried.set("q", q);
    const qs = carried.toString();
    return qs ? `/market/guide?${qs}` : "/market/guide";
}
