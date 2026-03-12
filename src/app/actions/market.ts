"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// MARKET PRICE GUIDE — Server Actions
// Reads from mv_market_prices materialized view
// ============================================================

export interface MarketPrice {
    catalogId: string;
    title: string;
    maker: string;
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

    let query = supabase
        .from("mv_market_prices" as string)
        .select("*")
        .eq("catalog_id", catalogId);

    if (finishType) {
        query = query.eq("finish_type", finishType);
    }

    const { data } = await query.limit(1).maybeSingle();

    if (!data) return null;

    const row = data as Record<string, unknown>;

    // Get catalog item details
    const { data: catalog } = await supabase
        .from("catalog_items")
        .select("title, maker, item_type, scale")
        .eq("id", catalogId)
        .single();

    const cat = catalog as { title: string; maker: string; item_type: string; scale: string | null } | null;

    return {
        catalogId,
        title: cat?.title || "Unknown",
        maker: cat?.maker || "Unknown",
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

    // First get all market data rows (now keyed by catalog_id + finish_type)
    let priceQuery = supabase
        .from("mv_market_prices" as string)
        .select("*");

    if (options?.finishType) {
        priceQuery = priceQuery.eq("finish_type", options.finishType);
    }

    if (options?.lifeStage) {
        priceQuery = priceQuery.eq("life_stage", options.lifeStage);
    }

    const { data: priceData } = await priceQuery;

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

    // Get catalog items for those IDs
    let catalogQuery = supabase
        .from("catalog_items")
        .select("id, title, maker, item_type, scale")
        .in("id", catalogIds);

    if (query && query.trim()) {
        catalogQuery = catalogQuery.or(`title.ilike.%${query.trim()}%,maker.ilike.%${query.trim()}%`);
    }

    if (options?.itemType && options.itemType !== "all") {
        catalogQuery = catalogQuery.eq("item_type", options.itemType);
    }

    const { data: catalogData } = await catalogQuery;

    if (!catalogData || catalogData.length === 0) {
        return { items: [], total: 0 };
    }

    // Merge: one catalog item may have multiple finish types
    const catalogRows = catalogData as { id: string; title: string; maker: string; item_type: string; scale: string | null }[];
    let merged: MarketPrice[] = [];

    for (const cat of catalogRows) {
        // Find all price rows for this catalog item
        for (const [key, price] of priceMap) {
            if (key.startsWith(`${cat.id}::`)) {
                merged.push({
                    catalogId: cat.id,
                    title: cat.title,
                    maker: cat.maker,
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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

    const { error } = await supabase.rpc("refresh_market_prices" as string);
    if (error) return { success: false, error: error.message };

    return { success: true };
}
