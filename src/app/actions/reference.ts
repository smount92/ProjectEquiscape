"use server";

import { createClient } from "@/lib/supabase/server";
import { makerMatches } from "@/lib/catalog/queryParse";
import {
    orderForAnchor,
    readRegistryTerm,
    searchRegistry,
    type PickerAnchor,
    type RegistryRow,
} from "@/lib/catalog/registrySearch";
import { yearRangeLabel, type CardAttributes } from "@/lib/catalog/cardDisplay";
import { parseTerm, splitNumberFromTitle } from "@/lib/linker/model";
import { sanitizeForOr } from "@/lib/utils/search";

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

const ROW_COLUMNS = "id, item_type, parent_id, title, maker, scale, attributes";

/**
 * The shared Registry search (lib/catalog/registrySearch), plus the named
 * maker's own rows when fifty better-titled rows from other makers fill the
 * window ("Arabian" is mostly Breyer). `null` when the search RPC is down.
 */
async function registryRows(
    supabase: Awaited<ReturnType<typeof createClient>>,
    query: string,
    candidates: number,
): Promise<RegistryRow[] | null> {
    const found = await searchRegistry(supabase, query, { candidates });
    if (!found) return null;
    let rows = found.rows;
    if (found.maker && !rows.some((r) => makerMatches(r.maker, found.maker))) {
        const { data: makerRows } = await supabase
            .from("catalog_items")
            .select(ROW_COLUMNS)
            .ilike("maker", found.maker)
            .ilike("title", `%${sanitizeForOr(found.term).replace(/[%_]/g, "")}%`)
            .limit(25);
        if (Array.isArray(makerRows) && makerRows.length > 0) {
            const seen = new Set(rows.map((r) => r.id));
            rows = [...(makerRows as unknown as RegistryRow[]).filter((r) => !seen.has(r.id)), ...rows];
        }
    }
    return rows;
}

/**
 * Search all catalog items (molds, releases, resins) by name, the way the
 * Registry page does (MHH-076): a leading maker is a preference, "SM"/"G1"
 * come off, a named mold brings its releases, roster-only sets go last.
 * Used by the old picker and the wishlist search.
 */
export async function searchCatalogAction(query: string): Promise<CatalogItem[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const supabase = await createClient();
    const rows = await registryRows(supabase, q, 50);
    return (rows ?? []).slice(0, 50).map((r) => mapCatalogRow(r as unknown as Record<string, unknown>));
}

/** One entry in the duplicate picker, with what tells it apart from its neighbours. */
export interface RegistryPick {
    id: string;
    title: string;
    maker: string;
    scale: string | null;
    itemType: string;
    modelNumber: string | null;
    years: string | null;
    colour: string | null;
    /** The mold a release is filed under; null for a mold or an unfiled release. */
    moldTitle: string | null;
    /** On the same mold as the entry being reported. */
    sameMold: boolean;
}

/** Most entries the duplicate picker lists at once. */
const PICKER_LIMIT = 25;

/**
 * The duplicate picker's search (MHH-076). It showed 8 rows from a thinner
 * search, so "Black and White Saddlebred" never reached Pinto Saddlebred
 * #5002. Now: the shared Registry search over 200 candidates, a model
 * number read as a number, the reported entry itself left out, entries on
 * its mold first and then its scale, up to 25. With nothing typed yet, the
 * other entries on the same mold, since that is where a duplicate usually is.
 */
export async function findRegistryEntries(
    query: string,
    reportedId?: string | null,
): Promise<{ picks: RegistryPick[]; more: boolean }> {
    const supabase = await createClient();
    const q = query.trim();
    let anchor: PickerAnchor | null = null;
    if (reportedId) {
        const { data } = await supabase
            .from("catalog_items")
            .select("id, item_type, parent_id, scale")
            .eq("id", reportedId)
            .maybeSingle();
        const r = data as { id: string; item_type: string; parent_id: string | null; scale: string | null } | null;
        if (r) anchor = { id: r.id, moldId: r.item_type === "plastic_mold" ? r.id : r.parent_id, scale: r.scale };
    }

    let rows: RegistryRow[] = [];
    const parsed = parseTerm(q);
    if (q.length < 2) {
        if (!anchor?.moldId) return { picks: [], more: false };
        const { data } = await supabase
            .from("catalog_items")
            .select(ROW_COLUMNS)
            .or(`id.eq.${anchor.moldId},parent_id.eq.${anchor.moldId}`)
            .limit(200);
        rows = ((data ?? []) as unknown as RegistryRow[]).sort(
            (a, b) =>
                Number(a.item_type !== "plastic_mold") - Number(b.item_type !== "plastic_mold") ||
                Number(a.attributes?.release_year_start ?? 9999) - Number(b.attributes?.release_year_start ?? 9999) ||
                a.title.localeCompare(b.title),
        );
    } else if (parsed.kind === "number") {
        rows = await rowsByModelNumber(supabase, parsed.value);
    } else {
        rows =
            (await registryRows(supabase, q, 200)) ??
            (((
                await supabase
                    .from("catalog_items")
                    .select(ROW_COLUMNS)
                    .ilike("title", `%${sanitizeForOr(q).replace(/[%_]/g, "")}%`)
                    .limit(100)
            ).data ?? []) as unknown as RegistryRow[]);
    }

    const ordered = orderForAnchor(rows, anchor, q.length >= 2 ? readRegistryTerm(q).term : null);
    const shown = ordered.slice(0, PICKER_LIMIT);
    // Each row says which mold it is on; rows read straight from the table lack the joined title.
    const missing = [...new Set(shown.filter((r) => r.parent_id && !r.parent_title).map((r) => r.parent_id as string))];
    const moldTitles = new Map<string, string>();
    if (missing.length) {
        const { data } = await supabase.from("catalog_items").select("id, title").in("id", missing);
        for (const m of (data ?? []) as { id: string; title: string }[]) moldTitles.set(m.id, m.title);
    }
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
        picks: shown.map((r) => ({
            id: r.id,
            title: r.title,
            maker: r.maker ?? "",
            scale: r.scale,
            itemType: r.item_type,
            modelNumber: text(r.attributes?.model_number)?.replace(/^#/, "") ?? null,
            years: yearRangeLabel(r.attributes as CardAttributes | null),
            colour: text(r.attributes?.color_description),
            moldTitle: r.parent_id ? (r.parent_title ?? moldTitles.get(r.parent_id) ?? null) : null,
            sameMold: r.sameMold,
        })),
        more: ordered.length > PICKER_LIMIT,
    };
}

/** Rows carrying a model number, with or without a "#", in the number field or leading the title. */
async function rowsByModelNumber(
    supabase: Awaited<ReturnType<typeof createClient>>,
    n: string,
): Promise<RegistryRow[]> {
    const safe = n.replace(/[^0-9a-z-]/gi, "");
    if (!safe) return [];
    const { data } = await supabase
        .from("catalog_items")
        .select(ROW_COLUMNS)
        // PostgREST or(): `*` is the wildcard; the title prefix is tightened below.
        .or(
            `attributes->>model_number.ilike.${safe},attributes->>model_number.ilike.#${safe},title.ilike.#${safe}*,title.ilike.${safe}*`,
        )
        .limit(60);
    return ((data ?? []) as unknown as RegistryRow[]).filter((r) => {
        const m = String(r.attributes?.model_number ?? "")
            .replace(/^#/, "")
            .toLowerCase();
        return m === safe.toLowerCase() || splitNumberFromTitle(r.title).model?.toLowerCase() === safe.toLowerCase();
    });
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
        const { data: parent } = await supabase.from("catalog_items").select("title").eq("id", item.parentId).single();
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
 * Much lighter than fetching every catalog row for client-side matching.
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
    rows: { name: string; moldName?: string }[],
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
        }),
    );
    return { matches };
}
