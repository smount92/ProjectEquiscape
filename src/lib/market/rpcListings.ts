/**
 * Marketplace front door — the anon RPC read path (pure).
 *
 * Argument building and row mapping for `get_market_listings`
 * (migration 169), the anon-granted SECURITY DEFINER function that
 * finally lets a LOGGED-OUT visitor read a page of listings complete
 * with the seller's alias and the horse's show record — the two things
 * plain anon RLS withholds (users and show_records are
 * authenticated-only, 022/027) and the two things that make this a
 * provenance marketplace rather than a grid of anonymous photos.
 *
 * Pure — no I/O. The call itself lives in src/app/market/listings.ts,
 * which feature-detects: until 169 is pasted the RPC does not exist,
 * the call fails, and the page falls back to its previous path.
 *
 * Two deliberate shapes here:
 *
 *  - The RPC returns show records as a JSONB array, not
 *    pre-computed counts, so summarizeShowRecords() below stays the
 *    ONE definition of what counts as a championship or a verified
 *    tier. SQL re-implementing that would drift from the card.
 *
 *  - mapMarketListingRpcRows leaves `thumbnailUrl` holding the RAW
 *    storage path. Turning paths into public URLs is a batched
 *    operation (getPublicImageUrls) and belongs to the caller; doing
 *    it here would force this module to import storage config and
 *    stop being pure.
 *
 * Junk tolerance follows mapPublicCardRows: a row missing an id is
 * dropped rather than rendering a broken card.
 */

import {
    summarizeShowRecords,
    type HorseRecordSummary,
    type RecordSummaryInputRow,
} from "@/lib/market/recordSummary";
import {
    findPriceBand,
    LISTINGS_PAGE_SIZE,
    type ListingFilters,
} from "@/lib/market/listingFilters";
import type { MarketListing } from "@/app/market/listings";

/** Server-side clamp, mirrored here so the two never disagree. */
export const MARKET_RPC_MAX_LIMIT = 50;

/** Named arguments of get_market_listings (migration 169). */
export interface MarketListingRpcArgs {
    p_q: string | null;
    p_finish: string | null;
    p_min_price: number | null;
    p_max_price: number | null;
    p_has_records: boolean;
    p_trade: string | null;
    p_sort: string;
    p_limit: number;
    p_offset: number;
}

/**
 * URL filter state → RPC arguments. The price band becomes an explicit
 * [min, max) pair because the band vocabulary is a client concern —
 * the function only knows about numbers.
 */
export function buildMarketListingRpcArgs(
    filters: ListingFilters,
    page: number,
): MarketListingRpcArgs {
    const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    const band = findPriceBand(filters.price);
    const limit = Math.min(LISTINGS_PAGE_SIZE, MARKET_RPC_MAX_LIMIT);
    return {
        p_q: filters.q?.trim() || null,
        p_finish: filters.finish || null,
        p_min_price: band ? band.min : null,
        p_max_price: band && band.max !== null ? band.max : null,
        p_has_records: filters.hasRecords === true,
        p_trade: filters.trade || null,
        p_sort: filters.sort ?? "newest",
        p_limit: limit,
        p_offset: (safePage - 1) * LISTINGS_PAGE_SIZE,
    };
}

/** One raw row of get_market_listings. */
interface MarketListingRpcRow {
    id: string;
    owner_id: string;
    custom_name: string | null;
    finish_type: string | null;
    condition_grade: string | null;
    created_at: string | null;
    trade_status: string | null;
    listing_price: number | null;
    marketplace_notes: string | null;
    catalog_id: string | null;
    catalog_title: string | null;
    catalog_maker: string | null;
    catalog_scale: string | null;
    owner_alias: string | null;
    thumbnail_url: string | null;
    is_trusted_seller: boolean | null;
    records: unknown;
    total_count: number | string | null;
}

function str(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

/** bigint may arrive as a JSON number or, defensively, as a string. */
function count(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

/**
 * The JSONB record aggregate for one horse → the card's compact
 * summary, via the same helper the authed path uses. Returns null for
 * a horse with no records so the card renders nothing — never a hollow
 * "0 placings".
 */
export function parseRecordAggregate(
    horseId: string,
    raw: unknown,
): HorseRecordSummary | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const rows: RecordSummaryInputRow[] = [];
    for (const item of raw) {
        if (item === null || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        rows.push({
            horse_id: horseId,
            placing: str(row.placing),
            ribbon_color: str(row.ribbon_color),
            verification_tier: str(row.verification_tier),
        });
    }
    if (rows.length === 0) return null;
    return summarizeShowRecords(rows).get(horseId) ?? null;
}

/** "Maker — Title", or the bare title, or null for an unlisted mold. */
function refName(maker: string | null, title: string | null): string | null {
    if (maker && title) return `${maker} — ${title}`;
    return title;
}

export interface MarketListingsRpcResult {
    /** NOTE: `thumbnailUrl` holds the raw storage path (see header). */
    listings: MarketListing[];
    /** Window count over the full filtered set, from any returned row. */
    total: number;
}

/**
 * get_market_listings rows → listing cards. Total comes from the
 * window count carried on every row; an empty page honestly means
 * zero matches (a filter that matched nothing), not "unknown".
 */
export function mapMarketListingRpcRows(rows: unknown): MarketListingsRpcResult {
    if (!Array.isArray(rows)) return { listings: [], total: 0 };

    const listings: MarketListing[] = [];
    let total: number | null = null;

    for (const raw of rows) {
        if (raw === null || typeof raw !== "object") continue;
        const row = raw as Partial<MarketListingRpcRow>;
        const id = str(row.id);
        const ownerId = str(row.owner_id);
        if (!id || !ownerId) continue;

        if (total === null) total = count(row.total_count);

        listings.push({
            id,
            ownerId,
            customName: str(row.custom_name) ?? "Unnamed horse",
            refName: refName(str(row.catalog_maker), str(row.catalog_title)),
            scale: str(row.catalog_scale),
            finishType: str(row.finish_type),
            conditionGrade: str(row.condition_grade),
            tradeStatus: str(row.trade_status) ?? "For Sale",
            listingPrice: typeof row.listing_price === "number" ? row.listing_price : null,
            marketplaceNotes: str(row.marketplace_notes),
            catalogId: str(row.catalog_id),
            ownerAlias: str(row.owner_alias) ?? "Collector",
            thumbnailUrl: str(row.thumbnail_url),
            createdAt: str(row.created_at) ?? "",
            isTrustedSeller: row.is_trusted_seller === true,
            recordSummary: parseRecordAggregate(id, row.records),
        });
    }

    return { listings, total: total ?? listings.length };
}
