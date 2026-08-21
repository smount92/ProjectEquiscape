/**
 * Marketplace front door — the listings query.
 *
 * ONE page of provenance-priced listings: public, non-deleted horses
 * whose trade_status is "For Sale" or "Open to Offers", enriched with
 * the thing no other marketplace can show — the horse's verified
 * competitive record, right where it commands a price premium.
 *
 * ── The anon read path (migration 169) ──
 *
 * A logged-out viewer is served by get_market_listings /
 * get_market_listings_total — anon-granted SECURITY DEFINER functions
 * that return one page of public-safe listing columns (alias_name,
 * catalog identity, thumbnail, trusted-seller flag, a bounded show-
 * record aggregate) plus a window total. No service-role key, no
 * replicated RLS predicate, no users/show_records exposure.
 *
 * The code feature-detects: until the owner pastes 169 the RPC does
 * not exist, the call fails, and everything below — the original
 * service-role stopgap — still runs. Read on for why that stopgap
 * exists at all; it is now the FALLBACK, not the primary.
 *
 * ── The anon-RLS reality (read this before changing the client) ──
 *
 * Checked against supabase/migrations:
 *   user_horses   SELECT → authenticated, anon  (150_unlisted_visibility)
 *                          visibility IN ('public','unlisted') AND deleted_at IS NULL
 *   horse_images  SELECT → authenticated, anon  (160_bulletproof_sweep)
 *   catalog_items SELECT → anon                 (124_catalog_anon_read)
 *   mv_trusted_sellers   → GRANT SELECT TO authenticated, anon (101)
 *   users         SELECT → authenticated ONLY   (022_performance_hardening)
 *   show_records  SELECT → authenticated ONLY   (027_transfer_rls_fix)
 *
 * A logged-out visitor can therefore read the listing rows and the
 * photos but NOT the seller's alias and NOT the show records —
 * precisely the two things that make this a provenance marketplace
 * rather than a grid of anonymous photos. The platform already
 * publishes both to anon, just one horse at a time, through
 * anon-granted SECURITY DEFINER RPCs: get_public_aliases (136),
 * get_public_horse_records (146), get_public_passport (135),
 * get_catalog_listings (132). There is no batch RPC covering a whole
 * page of listings, and this build ships no migration.
 *
 * Resolution: for a logged-out viewer the page reads through the
 * service-role client with the anon RLS arm replicated verbatim and
 * NARROWED to visibility = 'public' — RLS also permits 'unlisted', but
 * an unlisted horse is reachable by link and must never be enumerated
 * in a browse. The column list is public-safe only: alias_name, never
 * full_name or email. Net data exposure versus the existing anon RPCs
 * is zero; only the transport differs.
 *
 * If SUPABASE_SERVICE_ROLE_KEY is absent AND the RPC is not there
 * either, the page neither crashes nor silently degrades: it returns
 * { gated: true } and /market renders the members teaser instead of a
 * hollow grid.
 *
 * AUTHENTICATED viewers keep the RLS-scoped query below in every case
 * — it is the path that applies the viewer's block list, which a
 * DEFINER function serving anonymous traffic has no business knowing
 * about.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getAdminClient } from "@/lib/supabase/admin";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { sanitizeForOr } from "@/lib/utils/search";
import {
    summarizeShowRecords,
    type HorseRecordSummary,
    type RecordSummaryInputRow,
} from "@/lib/market/recordSummary";
import {
    buildMarketListingRpcArgs,
    mapMarketListingRpcRows,
} from "@/lib/market/rpcListings";
import {
    findPriceBand,
    LISTINGS_PAGE_SIZE,
    LISTING_TRADE_STATUSES,
    type ListingFilters,
} from "@/lib/market/listingFilters";

/** One provenance listing card. */
export interface MarketListing {
    id: string;
    ownerId: string;
    customName: string;
    /** "Maker — Title" from the catalog join, or null for an unlisted mold. */
    refName: string | null;
    scale: string | null;
    finishType: string | null;
    conditionGrade: string | null;
    tradeStatus: string;
    listingPrice: number | null;
    marketplaceNotes: string | null;
    catalogId: string | null;
    ownerAlias: string;
    thumbnailUrl: string | null;
    createdAt: string;
    isTrustedSeller: boolean;
    /** null = no records. The card renders nothing (never "0 placings"). */
    recordSummary: HorseRecordSummary | null;
}

export interface MarketListingsPage {
    /** True when the browse cannot be served to this viewer (see header). */
    gated: boolean;
    listings: MarketListing[];
    /** Exact count of listings matching the current filters. */
    total: number;
    /** Live listings ignoring filters — the masthead's headline number. */
    totalListings: number;
    viewerIsAuthenticated: boolean;
}

/** Max catalog rows matched for the q ilike-over-the-join expansion. */
const CATALOG_MATCH_CAP = 100;
/** Max blocked users honored in the SQL exclusion. */
const BLOCKED_CAP = 1000;

/** Trade statuses that constitute a live listing, as a mutable array. */
const LIVE_TRADE_STATUSES: string[] = [...LISTING_TRADE_STATUSES];

/** The viewer's block list — blocked sellers are excluded IN the query. */
async function fetchBlockedOwnerIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
    const { data } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId)
        .limit(BLOCKED_CAP);
    return ((data ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id);
}

interface ListingRow {
    id: string;
    owner_id: string;
    custom_name: string | null;
    finish_type: string | null;
    condition_grade: string | null;
    created_at: string;
    trade_status: string | null;
    listing_price: number | null;
    marketplace_notes: string | null;
    catalog_id: string | null;
    users?: { alias_name: string | null } | null;
    catalog_items?: { title: string | null; maker: string | null; scale: string | null } | null;
    horse_images?: { image_url: string; angle_profile: string | null }[] | null;
}

/**
 * Collector-designated main shot, else the first photo — the universal
 * card idiom (mirrors the server-side preference in migrations 131/147).
 */
function pickThumbnail(images: ListingRow["horse_images"]): string | null {
    const list = images ?? [];
    if (list.length === 0) return null;
    const primary = list.find((img) => img.angle_profile === "Primary_Thumbnail");
    return (primary ?? list[0]).image_url ?? null;
}

/** Batched show-record aggregates for the whole page — one query, never per-card. */
async function fetchRecordSummaries(
    supabase: SupabaseClient,
    horseIds: string[],
): Promise<Map<string, HorseRecordSummary>> {
    if (horseIds.length === 0) return new Map();
    try {
        const { data } = await supabase
            .from("show_records")
            .select("horse_id, placing, ribbon_color, verification_tier")
            .in("horse_id", horseIds);
        return summarizeShowRecords((data ?? []) as RecordSummaryInputRow[]);
    } catch {
        // Records are a bonus on a card, never a reason to 500 a browse.
        return new Map();
    }
}

/**
 * Which of these sellers are community-trusted. Note: mv_trusted_sellers
 * is currently empty in production (its source join uses a
 * horse_transfers status the CHECK constraint disallows — see
 * docs/ADVERSARIAL_AUDIT_2026-08-14_PART2.md), so this correctly
 * returns nothing today and lights up the moment the view is fixed.
 */
async function fetchTrustedSellers(
    supabase: SupabaseClient,
    ownerIds: string[],
): Promise<Set<string>> {
    if (ownerIds.length === 0) return new Set();
    try {
        const { data } = await supabase
            .from("mv_trusted_sellers")
            .select("user_id")
            .in("user_id", ownerIds);
        return new Set(((data ?? []) as { user_id: string }[]).map((t) => t.user_id));
    } catch {
        return new Set();
    }
}

/** Live listings ignoring every filter — the "N horses for sale" headline. */
async function fetchTotalListings(supabase: SupabaseClient): Promise<number> {
    try {
        const { count } = await supabase
            .from("user_horses")
            .select("id", { count: "exact", head: true })
            .eq("visibility", "public")
            .is("deleted_at", null)
            .in("trade_status", LIVE_TRADE_STATUSES);
        return count ?? 0;
    } catch {
        return 0;
    }
}

/** A BIGINT scalar from PostgREST — number, or defensively a string. */
function parseCount(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

/**
 * The logged-out page, through the anon-granted DEFINER RPCs of
 * migration 169. Returns null when that path is unavailable for ANY
 * reason — the function missing (42883 / PGRST202 before the owner
 * pastes 169), a malformed response, no anon key — so the caller can
 * fall back to the service-role stopgap without the page ever noticing.
 *
 * Cookie-less anon client: no session to read, and the function is
 * visibility-guarded server-side.
 */
async function fetchListingsViaRpc(
    filters: ListingFilters,
    page: number,
): Promise<MarketListingsPage | null> {
    try {
        const supabase = createAnonClient();
        // get_market_listings ships in migration 169 (not yet in the
        // generated types → cast, same idiom as get_public_passport
        // in AnonPassport.tsx and get_public_horse_records in
        // publicRecords.ts).
        const rpc = supabase.rpc.bind(supabase) as unknown as (
            fn: string,
            args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>;

        const [pageResult, totalResult] = await Promise.all([
            rpc(
                "get_market_listings",
                buildMarketListingRpcArgs(filters, page) as unknown as Record<string, unknown>,
            ),
            rpc("get_market_listings_total", {}),
        ]);

        if (pageResult.error || !Array.isArray(pageResult.data)) return null;

        const { listings, total } = mapMarketListingRpcRows(pageResult.data);

        // The mapper leaves raw storage paths on the cards; resolving
        // them to public URLs is the one batched, non-pure step.
        const paths = listings
            .map((l) => l.thumbnailUrl)
            .filter((u): u is string => typeof u === "string" && u.length > 0);
        const urlMap = getPublicImageUrls(paths);
        for (const listing of listings) {
            if (listing.thumbnailUrl) {
                listing.thumbnailUrl = urlMap.get(listing.thumbnailUrl) ?? listing.thumbnailUrl;
            }
        }

        // The headline number is a nicety; if only that call failed,
        // the filtered total is an honest floor rather than a zero.
        const headline = totalResult.error ? 0 : parseCount(totalResult.data);

        return {
            gated: false,
            listings,
            total,
            totalListings: Math.max(headline, total),
            viewerIsAuthenticated: false,
        };
    } catch {
        return null;
    }
}

/**
 * Fetch one page of listings plus everything the cards need.
 *
 * Authenticated viewers read through their own RLS-scoped client (so
 * their block list applies); logged-out viewers read through the
 * service-role client under the public predicate documented above.
 * The SQL predicate is identical either way.
 */
export async function getMarketListingsPage(
    filters: ListingFilters,
    page: number,
): Promise<MarketListingsPage> {
    const authed = await createClient();
    const {
        data: { user },
    } = await authed.auth.getUser();

    const viewerIsAuthenticated = Boolean(user);
    const empty = (gated: boolean): MarketListingsPage => ({
        gated,
        listings: [],
        total: 0,
        totalListings: 0,
        viewerIsAuthenticated,
    });

    let supabase: SupabaseClient;
    if (user) {
        // Authenticated: the viewer's own RLS-scoped client, so their
        // block list applies (see the header).
        supabase = authed as unknown as SupabaseClient;
    } else {
        // Logged out: the anon DEFINER RPC (169) is the real path.
        const viaRpc = await fetchListingsViaRpc(filters, page);
        if (viaRpc) return viaRpc;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            // 169 not pasted yet — the documented stopgap still works.
            supabase = getAdminClient() as unknown as SupabaseClient;
        } else {
            // No RPC and no service key → no batch anon read path for
            // aliases/records at all → members teaser.
            return empty(true);
        }
    }

    const blockedOwnerIds = user
        ? await fetchBlockedOwnerIds(authed as unknown as SupabaseClient, user.id)
        : [];

    // "Has show record": EXISTS semantics via an inner-join embed, so
    // the filter runs IN the page query and count/paging stay exact.
    // The embed itself is unused — chip aggregates come from the one
    // batched query in fetchRecordSummaries.
    const recordJoin = filters.hasRecords ? ", show_records!inner(horse_id)" : "";

    let query = supabase
        .from("user_horses")
        .select(
            `id, owner_id, custom_name, finish_type, condition_grade, created_at,
             trade_status, listing_price, marketplace_notes, catalog_id,
             users!inner(alias_name),
             catalog_items:catalog_id(title, maker, scale),
             horse_images(image_url, angle_profile)${recordJoin}`,
            { count: "exact" },
        )
        // ── the public-listing invariant; see the file header ──
        .eq("visibility", "public")
        .is("deleted_at", null)
        .in("trade_status", LIVE_TRADE_STATUSES);

    if (blockedOwnerIds.length > 0) {
        query = query.not("owner_id", "in", `(${blockedOwnerIds.join(",")})`);
    }

    if (filters.trade) query = query.eq("trade_status", filters.trade);
    if (filters.finish) query = query.eq("finish_type", filters.finish);

    const band = findPriceBand(filters.price);
    if (band) {
        // A price band is a claim about the asking price, so listings
        // without one drop out rather than being bucketed at zero.
        query = query.gte("listing_price", band.min);
        if (band.max !== null) query = query.lt("listing_price", band.max);
    }

    if (filters.q) {
        const q = sanitizeForOr(filters.q);
        if (q) {
            // Maker/title search: PostgREST .or() can't mix base and
            // embedded columns, so the catalog side becomes a bounded
            // id expansion (the Show Ring's approach).
            const { data: catalogMatches } = await supabase
                .from("catalog_items")
                .select("id")
                .or(`title.ilike.%${q}%,maker.ilike.%${q}%`)
                .limit(CATALOG_MATCH_CAP);
            const catalogIds = ((catalogMatches ?? []) as { id: string }[]).map((c) => c.id);
            const clauses = [`custom_name.ilike.%${q}%`, `sculptor.ilike.%${q}%`];
            if (catalogIds.length > 0) clauses.push(`catalog_id.in.(${catalogIds.join(",")})`);
            query = query.or(clauses.join(","));
        }
    }

    switch (filters.sort) {
        case "price_asc":
            query = query.order("listing_price", { ascending: true, nullsFirst: false });
            break;
        case "price_desc":
            query = query.order("listing_price", { ascending: false, nullsFirst: false });
            break;
        default:
            query = query.order("created_at", { ascending: false });
    }

    const offset = (page - 1) * LISTINGS_PAGE_SIZE;
    const { data, count, error } = await query.range(offset, offset + LISTINGS_PAGE_SIZE - 1);

    if (error) return empty(false);

    const rows = (data ?? []) as unknown as ListingRow[];
    const horseIds = rows.map((r) => r.id);
    const ownerIds = [...new Set(rows.map((r) => r.owner_id))];

    const [summaries, trusted, totalListings] = await Promise.all([
        fetchRecordSummaries(supabase, horseIds),
        fetchTrustedSellers(supabase, ownerIds),
        fetchTotalListings(supabase),
    ]);

    const urlMap = getPublicImageUrls(
        rows.flatMap((r) => (r.horse_images ?? []).map((i) => i.image_url)),
    );

    const listings: MarketListing[] = rows.map((row) => {
        const rawThumb = pickThumbnail(row.horse_images);
        const cat = row.catalog_items ?? null;
        return {
            id: row.id,
            ownerId: row.owner_id,
            customName: row.custom_name || "Unnamed horse",
            refName: cat?.maker && cat?.title ? `${cat.maker} — ${cat.title}` : (cat?.title ?? null),
            scale: cat?.scale ?? null,
            finishType: row.finish_type,
            conditionGrade: row.condition_grade,
            tradeStatus: row.trade_status ?? "For Sale",
            listingPrice: row.listing_price,
            marketplaceNotes: row.marketplace_notes,
            catalogId: row.catalog_id,
            ownerAlias: row.users?.alias_name || "Collector",
            thumbnailUrl: rawThumb ? (urlMap.get(rawThumb) ?? rawThumb) : null,
            createdAt: row.created_at,
            isTrustedSeller: trusted.has(row.owner_id),
            recordSummary: summaries.get(row.id) ?? null,
        };
    });

    return {
        gated: false,
        listings,
        total: count ?? listings.length,
        totalListings,
        viewerIsAuthenticated,
    };
}
