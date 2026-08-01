"use server";

import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizeForOr } from "@/lib/utils/search";
import { getPublicHorseCards } from "@/lib/shows/publicCards";
import {
    sortRecordsBestFirst,
    summarizeShowRecords,
    type HorseRecordSummary,
    type MarketRecordDetailRow,
} from "@/lib/market/recordSummary";

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

/**
 * Get market price for a specific catalog item.
 * Used for badges on passports and reference search.
 */
export async function getMarketPrice(catalogId: string, finishType?: string): Promise<MarketPrice | null> {
    const supabase = await createClient();

    // Read via get_market_rows (SECURITY DEFINER, migration 126) so this
    // works for anon on public reference pages — anon SELECT on
    // mv_market_prices was revoked in 092. Aggregate-only, no per-user data.
    const { data: rows } = await supabase.rpc("get_market_rows", {
        p_catalog_id: catalogId,
        p_finish_type: finishType ?? undefined,
    });

    const row = (rows as Record<string, unknown>[] | null)?.[0];
    if (!row) return null;

    // Get catalog item details
    const { data: catalog } = await supabase
        .from("catalog_items")
        .select("title, maker, maker_slug, slug, item_type, scale")
        .eq("id", catalogId)
        .single();

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
    const supabase = await createClient();
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    // All market rows via get_market_rows (SECURITY DEFINER, migration 126)
    // so /market works for anon (mv_market_prices anon SELECT was revoked in
    // 092). Optional finish/life-stage filters applied in SQL; the rest of
    // the merge/sort/paginate stays in JS.
    const { data: priceData } = await supabase.rpc("get_market_rows", {
        p_finish_type: options?.finishType ?? undefined,
        p_life_stage: options?.lifeStage ?? undefined,
    });

    if (!priceData || priceData.length === 0) {
        return { items: [], total: 0 };
    }

    const priceRows = priceData as Record<string, unknown>[];

    // Build price map using composite key (catalog_id::finish_type::life_stage)
    const priceMap = new Map<string, Record<string, unknown>>();
    for (const row of priceRows) {
        priceMap.set(`${row.catalog_id}::${row.finish_type || "OF"}::${row.life_stage || "completed"}`, row);
    }

    // Unique catalog IDs for catalog lookup
    const catalogIds = [...new Set(priceRows.map(r => r.catalog_id as string))];

    // Get catalog items for those IDs. maker_slug/slug ride along so
    // /market cards can link to the STORED reference URL — client-side
    // re-slugifying ignores migration 129's collision suffixes and 404s.
    let catalogQuery = supabase
        .from("catalog_items")
        .select("id, title, maker, maker_slug, slug, item_type, scale")
        .in("id", catalogIds);

    const q = sanitizeForOr(query ?? "");
    if (q) {
        catalogQuery = catalogQuery.or(`title.ilike.%${q}%,maker.ilike.%${q}%`);
    }

    if (options?.itemType && options.itemType !== "all") {
        catalogQuery = catalogQuery.eq("item_type", options.itemType);
    }

    const { data: catalogData } = await catalogQuery;

    if (!catalogData || catalogData.length === 0) {
        return { items: [], total: 0 };
    }

    // Merge: one catalog item may have multiple finish types
    const catalogRows = catalogData as {
        id: string;
        title: string;
        maker: string;
        maker_slug: string | null;
        slug: string | null;
        item_type: string;
        scale: string | null;
    }[];
    let merged: MarketPrice[] = [];

    for (const cat of catalogRows) {
        // Find all price rows for this catalog item
        for (const [key, price] of priceMap) {
            if (key.startsWith(`${cat.id}::`)) {
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

    return { success: true };
}

// ============================================================
// MARKET LISTINGS — competitive record (Wave 3)
// "The horse's record is the product": the quick-look dialog a
// buyer opens from a listing's record chip.
// ============================================================

/** Bound the trophy-case read for one horse (campaigners included). */
const MAX_DETAIL_RECORDS = 200;
/** "Recent placings, best first" — the dialog shows at most this many. */
const TOP_RECORDS_SHOWN = 5;

export interface MarketHorseRecord {
    summary: HorseRecordSummary | null;
    /** Best-first (championships, then placings, recency tiebreak), ≤5. */
    topRecords: MarketRecordDetailRow[];
    /** Live MHH qualification cards (issued/transferred) on the horse. */
    cardCount: number;
}

const marketHorseRecordSchema = z.object({ horseId: z.uuid() });

/**
 * One listed horse's competitive record for the market quick-look
 * dialog — fetched on demand when a buyer opens it (never per-card in
 * the list). Two bounded reads for ONE horse:
 *  - show_records via the viewer's client — RLS only returns rows for
 *    public horses (or the viewer's own), so a delisted/private horse
 *    honestly yields nothing;
 *  - qualification cards via the anon-granted get_public_horse_cards
 *    DEFINER RPC (migration 141) — the same public-passport path,
 *    feature-detecting and [] until the migration is applied.
 */
export async function getMarketHorseRecord(
    input: z.input<typeof marketHorseRecordSchema>,
): Promise<
    | { success: true; record: MarketHorseRecord }
    | { success: false; error: string }
> {
    const parsed = marketHorseRecordSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid horse id." };
    const { horseId } = parsed.data;

    const { supabase } = await requireAuth();

    const [recordsResult, cards] = await Promise.all([
        supabase
            .from("show_records")
            .select(
                'id, show_name, show_id, show_date, show_date_text, division, class_name, "placing", ribbon_color, verification_tier, is_nan',
            )
            .eq("horse_id", horseId)
            .order("show_date", { ascending: false, nullsFirst: false })
            .limit(MAX_DETAIL_RECORDS),
        getPublicHorseCards(horseId),
    ]);

    if (recordsResult.error) {
        return { success: false, error: "Could not load the show record." };
    }

    const rows = (recordsResult.data ?? []) as {
        id: string;
        show_name: string;
        show_id: string | null;
        show_date: string | null;
        show_date_text: string | null;
        division: string | null;
        class_name: string | null;
        placing: string | null;
        ribbon_color: string | null;
        verification_tier: string | null;
        is_nan: boolean | null;
    }[];

    const summary =
        summarizeShowRecords(
            rows.map((r) => ({
                horse_id: horseId,
                placing: r.placing,
                ribbon_color: r.ribbon_color,
                verification_tier: r.verification_tier,
            })),
        ).get(horseId) ?? null;

    const detailRows: MarketRecordDetailRow[] = rows.map((r) => ({
        id: r.id,
        showName: r.show_name,
        showId: r.show_id,
        showDate: r.show_date,
        showDateText: r.show_date_text,
        className: r.class_name,
        division: r.division,
        placing: r.placing,
        ribbonColor: r.ribbon_color,
        verificationTier: r.verification_tier,
        isNan: r.is_nan === true,
    }));

    return {
        success: true,
        record: {
            summary,
            topRecords: sortRecordsBestFirst(detailRows).slice(0, TOP_RECORDS_SHOWN),
            cardCount: cards.length,
        },
    };
}
