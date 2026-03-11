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
 * No more tab parameter — returns unified results.
 */
export async function searchCatalogAction(query: string): Promise<CatalogItem[]> {
    const supabase = await createClient();
    const q = sanitizeSearchQuery(query);
    if (!q) return [];

    // Search across title, maker, and model_number (in attributes)
    const { data } = await supabase
        .from("catalog_items")
        .select("id, item_type, parent_id, title, maker, scale, attributes")
        .or(`title.ilike.%${q}%,maker.ilike.%${q}%`)
        .order("item_type")
        .order("title")
        .limit(50);

    if (!data || data.length === 0) {
        // Fallback: search model_number in attributes for releases
        const { data: attrData } = await supabase
            .from("catalog_items")
            .select("id, item_type, parent_id, title, maker, scale, attributes")
            .eq("item_type", "plastic_release")
            .ilike("attributes->>model_number", `%${q}%`)
            .limit(20);

        return (attrData ?? []).map(mapCatalogRow);
    }

    return data.map(mapCatalogRow);
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

// ── Legacy shims (kept for backward compat during transition) ──

export async function getMoldDetailAction(id: string) {
    return getCatalogItem(id);
}

export async function getResinDetailAction(id: string) {
    return getCatalogItem(id);
}

export async function getReleasesForMoldAction(moldId: string) {
    const items = await getReleasesForMold(moldId);
    // Return in legacy shape for any code still expecting it
    return items.map(item => ({
        id: item.id,
        mold_id: item.parentId,
        model_number: item.attributes.model_number || null,
        release_name: item.title,
        color_description: item.attributes.color_description || null,
        release_year_start: item.attributes.release_year_start || null,
        release_year_end: item.attributes.release_year_end || null,
    }));
}

export async function searchReferencesAction(tab: "mold" | "resin", query: string) {
    // Legacy shim — redirect to unified search
    const items = await searchCatalogAction(query);

    if (tab === "mold") {
        return {
            molds: items
                .filter(i => i.itemType === "plastic_mold")
                .map(i => ({
                    id: i.id,
                    manufacturer: i.maker,
                    mold_name: i.title,
                    scale: i.scale,
                    release_year_start: i.attributes.release_year_start || null,
                })),
            releases: items
                .filter(i => i.itemType === "plastic_release")
                .map(i => ({
                    id: i.id,
                    mold_id: i.parentId,
                    release_name: i.title,
                    model_number: i.attributes.model_number || null,
                    color_description: i.attributes.color_description || null,
                    release_year_start: i.attributes.release_year_start || null,
                    release_year_end: i.attributes.release_year_end || null,
                    reference_molds: i.parentId ? { mold_name: i.parentTitle || "Unknown", manufacturer: i.maker } : null,
                })),
        };
    } else {
        return {
            resins: items
                .filter(i => i.itemType === "artist_resin")
                .map(i => ({
                    id: i.id,
                    sculptor_alias: i.maker,
                    resin_name: i.title,
                    scale: i.scale,
                    cast_medium: i.attributes.cast_medium || null,
                })),
        };
    }
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
