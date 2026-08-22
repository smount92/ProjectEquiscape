"use server";

import { revalidateTag, unstable_cache } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import { sanitizeForOr } from "@/lib/utils/search";
import type { HorseRecordSummary, MarketRecordDetailRow } from "@/lib/market/recordSummary";

// ============================================================
// MARKET PRICE GUIDE — Server Actions
// Reads from mv_market_prices materialized view
// ============================================================

export interface MarketPrice {
    catalogId: string;
    title: string;
    maker: string;
    /** Stored reference slugs (migration 129) — referenceHref must get
     *  these, never re-slugify maker/title (collision suffixes differ). */
    makerSlug: string | null;
    slug: string | null;
    itemType: string;
    finishType: string;
    lifeStage: string;
    scale: string | null;
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
    medianPrice: number;
    transactionVolume: number;
    lastSoldAt: string | null;
}

// ============================================================
// THE MARKET CORE CACHE
// ============================================================
// mv_market_prices only ever changes when refresh_market_prices()
// runs (admin-triggered), yet /market used to pull the ENTIRE view
// plus a thousands-wide catalog `.in()` on every anonymous page
// view. Both reads are viewer-independent — get_market_rows is
// SECURITY DEFINER granted to anon (126) and catalog_items is
// anon-readable (124) — so the invariant core is loaded once on a
// COOKIE-LESS anon client and cached; filtering, sorting and
// pagination happen over the cached arrays. refreshMarketPrices()
// busts the tag so an admin refresh shows up immediately.
// ============================================================

/** Cache tag on the market core; revalidated by refreshMarketPrices(). */
const MARKET_CACHE_TAG = "market-prices";
const MARKET_CACHE_SECONDS = 300;
/** Catalog ids per `.in()` request — PostgREST puts them in the URL. */
const CATALOG_ID_CHUNK = 300;

interface MarketCatalogRow {
    id: string;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    item_type: string;
    scale: string | null;
}

const getMarketCore = unstable_cache(
    async (): Promise<{ prices: Record<string, unknown>[]; catalog: MarketCatalogRow[] }> => {
        const anon = createAnonClient();
        const { data: priceData } = await anon.rpc("get_market_rows", {});
        const prices = (priceData ?? []) as unknown as Record<string, unknown>[];
        if (prices.length === 0) return { prices: [], catalog: [] };

        const ids = [...new Set(prices.map((r) => r.catalog_id as string))];
        const catalog: MarketCatalogRow[] = [];
        // Chunked: one URL-length-safe request per slice instead of a
        // single query string carrying every id in the view.
        for (let i = 0; i < ids.length; i += CATALOG_ID_CHUNK) {
            const { data } = await anon
                .from("catalog_items")
                .select("id, title, maker, maker_slug, slug, item_type, scale")
                .in("id", ids.slice(i, i + CATALOG_ID_CHUNK));
            if (data) catalog.push(...(data as unknown as MarketCatalogRow[]));
        }
        return { prices, catalog };
    },
    ["market-core"],
    { revalidate: MARKET_CACHE_SECONDS, tags: [MARKET_CACHE_TAG] },
);

/**
 * Get market price for a specific catalog item.
 * Used for badges on passports and reference search.
 */
export async function getMarketPrice(catalogId: string, finishType?: string): Promise<MarketPrice | null> {
    const supabase = await createClient();

    // Read via get_market_rows (SECURITY DEFINER, migration 126) so this
    // works for anon on public reference pages — anon SELECT on
    // mv_market_prices was revoked in 092. Aggregate-only, no per-user data.
    // Both reads key off catalogId alone — one wave, not two hops.
    const [{ data: rows }, { data: catalog }] = await Promise.all([
        supabase.rpc("get_market_rows", {
            p_catalog_id: catalogId,
            p_finish_type: finishType ?? undefined,
        }),
        supabase
            .from("catalog_items")
            .select("title, maker, maker_slug, slug, item_type, scale")
            .eq("id", catalogId)
            .single(),
    ]);

    const row = (rows as Record<string, unknown>[] | null)?.[0];
    if (!row) return null;

    const cat = catalog as {
        title: string;
        maker: string;
        maker_slug: string | null;
        slug: string | null;
        item_type: string;
        scale: string | null;
    } | null;

    return {
        catalogId,
        title: cat?.title || "Unknown",
        maker: cat?.maker || "Unknown",
        makerSlug: cat?.maker_slug ?? null,
        slug: cat?.slug ?? null,
        itemType: cat?.item_type || "unknown",
        finishType: (row.finish_type as string) || "OF",
        lifeStage: (row.life_stage as string) || "completed",
        scale: cat?.scale || null,
        lowestPrice: Number(row.lowest_price) || 0,
        highestPrice: Number(row.highest_price) || 0,
        averagePrice: Number(row.average_price) || 0,
        medianPrice: Number(row.median_price) || 0,
        transactionVolume: Number(row.transaction_volume) || 0,
        lastSoldAt: row.last_sold_at as string | null,
    };
}

/**
 * Search market prices with optional filters.
 * Powers the /market page.
 */
export async function searchMarketPrices(query?: string, options?: {
    itemType?: string;
    finishType?: string;
    lifeStage?: string;
    sortBy?: "average_price" | "transaction_volume" | "last_sold_at" | "title";
    sortDirection?: "asc" | "desc";
    limit?: number;
    offset?: number;
}): Promise<{ items: MarketPrice[]; total: number }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    // The whole invariant core in ONE cached load (see getMarketCore).
    const { prices: allPrices, catalog: allCatalog } = await getMarketCore();

    // finish_type / life_stage were `=` predicates inside get_market_rows;
    // same equality, now over the cached rows.
    const priceRows = allPrices.filter(
        (r) =>
            (!options?.finishType || (r.finish_type as string) === options.finishType) &&
            (!options?.lifeStage || (r.life_stage as string) === options.lifeStage),
    );

    if (priceRows.length === 0) {
        return { items: [], total: 0 };
    }

    // Group by catalog id — the old build scanned the whole price map per
    // catalog row with a string `startsWith`, i.e. O(catalog × prices).
    // The composite key is kept so rows still collapse exactly as the old
    // Map<`id::finish::stage`> did (last row wins on a collision).
    const priceMap = new Map<string, Record<string, unknown>>();
    for (const row of priceRows) {
        priceMap.set(
            `${row.catalog_id}::${row.finish_type || "OF"}::${row.life_stage || "completed"}`,
            row,
        );
    }
    const pricesByCatalog = new Map<string, Record<string, unknown>[]>();
    for (const row of priceMap.values()) {
        const id = row.catalog_id as string;
        const bucket = pricesByCatalog.get(id);
        if (bucket) bucket.push(row);
        else pricesByCatalog.set(id, [row]);
    }

    // `title/maker ILIKE %q%` and `item_type = x` were SQL filters.
    // sanitizeForOr strips every LIKE wildcard, so ILIKE '%q%' is exactly
    // a case-insensitive substring test. maker_slug/slug ride along so
    // /market cards can link to the STORED reference URL — client-side
    // re-slugifying ignores migration 129's collision suffixes and 404s.
    const q = sanitizeForOr(query ?? "").toLowerCase();
    const itemType =
        options?.itemType && options.itemType !== "all" ? options.itemType : null;

    const catalogRows = allCatalog.filter((cat) => {
        if (!pricesByCatalog.has(cat.id)) return false;
        if (itemType && cat.item_type !== itemType) return false;
        if (q) {
            const title = (cat.title ?? "").toLowerCase();
            const maker = (cat.maker ?? "").toLowerCase();
            if (!title.includes(q) && !maker.includes(q)) return false;
        }
        return true;
    });

    if (catalogRows.length === 0) {
        return { items: [], total: 0 };
    }

    // Merge: one catalog item may have multiple finish types
    let merged: MarketPrice[] = [];

    for (const cat of catalogRows) {
        for (const price of pricesByCatalog.get(cat.id) ?? []) {
            merged.push({
                catalogId: cat.id,
                title: cat.title,
                maker: cat.maker,
                makerSlug: cat.maker_slug ?? null,
                slug: cat.slug ?? null,
                itemType: cat.item_type,
                finishType: (price.finish_type as string) || "OF",
                lifeStage: (price.life_stage as string) || "completed",
                scale: cat.scale,
                lowestPrice: Number(price.lowest_price) || 0,
                highestPrice: Number(price.highest_price) || 0,
                averagePrice: Number(price.average_price) || 0,
                medianPrice: Number(price.median_price) || 0,
                transactionVolume: Number(price.transaction_volume) || 0,
                lastSoldAt: price.last_sold_at as string | null,
            });
        }
    }

    // Sort
    const sortBy = options?.sortBy || "transaction_volume";
    const dir = options?.sortDirection === "asc" ? 1 : -1;
    merged.sort((a, b) => {
        switch (sortBy) {
            case "average_price": return (a.averagePrice - b.averagePrice) * dir;
            case "transaction_volume": return (a.transactionVolume - b.transactionVolume) * dir;
            case "last_sold_at": return ((a.lastSoldAt || "").localeCompare(b.lastSoldAt || "")) * dir;
            case "title": return a.title.localeCompare(b.title) * dir;
            default: return 0;
        }
    });

    const total = merged.length;
    merged = merged.slice(offset, offset + limit);

    return { items: merged, total };
}

/**
 * Get top traded items (most transactions).
 */
export async function getTopTraded(limit: number = 10): Promise<MarketPrice[]> {
    const result = await searchMarketPrices(undefined, {
        sortBy: "transaction_volume",
        sortDirection: "desc",
        limit,
    });
    return result.items;
}

/**
 * Trigger a manual refresh of the materialized view.
 * Admin only.
 */
export async function refreshMarketPrices(): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Check admin role
    const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    const role = (profile as { role: string } | null)?.role;
    if (role !== "admin") {
        return { success: false, error: "Admin access required." };
    }

    const { error } = await supabase.rpc("refresh_market_prices");
    if (error) return { success: false, error: error.message };

    // The MV is the only thing getMarketCore caches, and it just moved.
    revalidateTag(MARKET_CACHE_TAG, "max");

    return { success: true };
}

// ============================================================
// MARKET LISTINGS — competitive record (Wave 3)
// "The horse's record is the product": the quick-look dialog a
// buyer opens from a listing's record chip.
//
// The FETCHER that used to live here (getMarketHorseRecord) is gone.
// It called requireAuth(), so it returned nothing to the signed-out
// buyers the market exists to convert; getPublicMarketHorseRecord in
// actions/marketPublicRecord.ts replaced it and every caller moved
// there. Only the shape stayed behind — both that action and
// HorseRecordChip still type against it.
// ============================================================

export interface MarketHorseRecord {
    summary: HorseRecordSummary | null;
    /** Best-first (championships, then placings, recency tiebreak), ≤5. */
    topRecords: MarketRecordDetailRow[];
    /** Live MHH qualification cards (issued/transferred) on the horse. */
    cardCount: number;
}

