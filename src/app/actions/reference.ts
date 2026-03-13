"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// UNIVERSAL CATALOG — Server Actions
// Single polymorphic reference table replaces 3 legacy tables
// ============================================================

export interface CatalogItem {
    id: string;
    itemType: string;
    parentId: string | null;
    title: string;
    maker: string;
    scale: string | null;
    attributes: Record<string, unknown>;
    // Derived fields (populated by joins)
    parentTitle?: string;
}

/**
 * Sanitize a search query for safe use in PostgREST .or() filters.
 */
function sanitizeSearchQuery(raw: string): string {
    return raw.replace(/[,().%\\]/g, "").trim();
}

/**
 * Search all catalog items (molds, releases, resins) in one query.
 * Multi-word: "Breyer Adios" splits into ["Breyer", "Adios"] and
 * chains .or() so ALL words must appear across title/maker/model_number.
 */
export async function searchCatalogAction(query: string): Promise<CatalogItem[]> {
    const supabase = await createClient();
    const q = sanitizeSearchQuery(query);
    if (!q) return [];

    const words = q.split(/\s+/).filter(w => w.length > 0);

    // Build a query where ALL words must appear across title, maker, or model_number
    let queryBuilder = supabase
        .from("catalog_items")
        .select("id, item_type, parent_id, title, maker, scale, attributes");

    for (const word of words) {
        queryBuilder = queryBuilder.or(
            `title.ilike.%${word}%,maker.ilike.%${word}%,attributes->>model_number.ilike.%${word}%`
        );
    }

    const { data } = await queryBuilder
        .order("item_type")
        .order("title")
        .limit(50);

    return (data ?? []).map(mapCatalogRow);
}

/**
 * Get a single catalog item by ID.
 * Replaces getMoldDetailAction() and getResinDetailAction().
 */
export async function getCatalogItem(id: string): Promise<CatalogItem | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("catalog_items")
        .select("id, item_type, parent_id, title, maker, scale, attributes")
        .eq("id", id)
        .single();

    if (!data) return null;
    const item = mapCatalogRow(data);

    // If it's a release, fetch parent mold title
    if (item.parentId) {
        const { data: parent } = await supabase
            .from("catalog_items")
            .select("title")
            .eq("id", item.parentId)
            .single();
        if (parent) item.parentTitle = (parent as { title: string }).title;
    }

    return item;
}

/**
 * Get all releases for a mold.
 * Replaces getReleasesForMoldAction().
 */
export async function getReleasesForMold(moldId: string): Promise<CatalogItem[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("catalog_items")
        .select("id, item_type, parent_id, title, maker, scale, attributes")
        .eq("parent_id", moldId)
        .eq("item_type", "plastic_release")
        .order("title");

    return (data ?? []).map(mapCatalogRow);
}

// ── Helpers ──

function mapCatalogRow(row: Record<string, unknown>): CatalogItem {
    return {
        id: row.id as string,
        itemType: row.item_type as string,
        parentId: row.parent_id as string | null,
        title: row.title as string,
        maker: row.maker as string,
        scale: row.scale as string | null,
        attributes: (row.attributes as Record<string, unknown>) || {},
    };
}
