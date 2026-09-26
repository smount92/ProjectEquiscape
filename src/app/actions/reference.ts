"use server";

import { createClient } from "@/lib/supabase/server";
import { parseCatalogQuery, makerMatches } from "@/lib/catalog/queryParse";

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
    if (!q || q.length < 2) return [];

    // "Peter stone Ideal sto": the maker comes off the front and the
    // initials are spelled out before the title search runs.
    const parsed = parseCatalogQuery(q);
    const term = parsed.term.length >= 2 ? parsed.term : q;

    // Use pg_trgm trigram search — leverages GIN index from Migration 100
    const { data, error } = await supabase.rpc("search_catalog_fuzzy", {
        search_term: term,
        max_results: 50,
    });

    if (error || !data) return [];

    type Row = {
        id: string;
        item_type: string;
        parent_id: string | null;
        title: string;
        maker: string;
        scale: string | null;
        attributes: Record<string, unknown>;
        parent_title?: string | null;
    };
    // Cast through unknown — generated types may lag behind migration 110
    let rows = data as unknown as Row[];

    // A named maker's own rows must be present even when fifty better
    // titled rows from other makers fill the fuzzy window ("Arabian" is
    // mostly Breyer). Top up straight from the table, then let the
    // client rank the named maker first.
    if (parsed.maker && !rows.some((r) => makerMatches(r.maker, parsed.maker))) {
        const { data: makerRows } = await supabase
            .from("catalog_items")
            .select("id, item_type, parent_id, title, maker, scale, attributes")
            .ilike("maker", parsed.maker)
            .ilike("title", `%${term.replace(/[%_]/g, "")}%`)
            .limit(25);
        if (Array.isArray(makerRows) && makerRows.length > 0) {
            const seen = new Set(rows.map((r) => r.id));
            rows = [...(makerRows as unknown as Row[]).filter((r) => !seen.has(r.id)), ...rows];
        }
    }

    return rows.map(mapCatalogRow);
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
        // The fuzzy RPC (110) joins the parent's title; a release row can
        // then say which mold it sits on.
        ...(typeof row.parent_title === "string" ? { parentTitle: row.parent_title } : {}),
    };
}

// ============================================================
// SERVER-SIDE FUZZY SEARCH (pg_trgm)
// Replaces client-side fuzzysort for CSV import bulk matching
// ============================================================

/**
 * Fuzzy search catalog items using trigram similarity (server-side).
 * Much lighter than fetching all 10,500+ rows for client-side matching.
 * @param term - Search term to fuzzy-match against catalog names
 * @param maxResults - Maximum number of results (default 20)
 */
export async function searchCatalogFuzzy(term: string, maxResults = 20) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_catalog_fuzzy", {
        search_term: term,
        max_results: maxResults,
    });
    if (error) return [];
    return data ?? [];
}

/**
 * Batch-match CSV rows against the catalog using server-side fuzzy search.
 * Used by the CSV import component instead of fetching the full reference dictionary.
 * @param rows - Parsed CSV rows with name and optional moldName
 */
export async function matchCsvRowsBatch(
    rows: { name: string; moldName?: string }[]
): Promise<{ matches: { rowIndex: number; catalogId: string | null; catalogName: string | null }[] }> {
    const supabase = await createClient();
    const matches = await Promise.all(
        rows.map(async (row, index) => {
            const searchTerm = row.moldName || row.name;
            const { data } = await supabase.rpc("search_catalog_fuzzy", {
                search_term: searchTerm,
                max_results: 1,
            });
            const best = (data as { id: string; title: string }[] | null)?.[0];
            return {
                rowIndex: index,
                catalogId: best?.id ?? null,
                catalogName: best?.title ?? null,
            };
        })
    );
    return { matches };
}
