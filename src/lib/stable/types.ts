/**
 * Digital Stable v2 — interim hand-written types (Phase-B style).
 *
 * Migration 123 adds the stable_saved_views table plus the
 * get_stable_summary / get_stable_facets functions, but it is
 * FILE-ONLY until the owner applies it, so database.generated.ts
 * does not know them yet.
 *
 * TODO(after migration 123 is applied + `npm run gen-types`):
 * replace the row shapes below with derivations from
 * Database["public"]["Tables"] like src/lib/shows/types.ts does.
 */

// ── Row / RPC shapes (replace after gen-types) ──

/** stable_saved_views row (new table in 123). */
export interface StableSavedViewRow {
    id: string;
    user_id: string;
    name: string;
    params: Record<string, string>;
    created_at: string;
}

/** One row from get_stable_summary(p_owner). */
export interface StableSummaryRow {
    total_horses: number;
    vault_total: number;
    for_sale_count: number;
    collections: { id: string; name: string; count: number; value: number }[];
}

// ── Action view models ──

/** The one shared horse-card shape (grid, ledger table, collection page). */
export interface StableCard {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    /** "Maker Title" from the catalog join, or "Unlisted Mold". */
    refName: string;
    thumbnailUrl: string | null;
    collectionName: string | null;
    sculptor: string | null;
    tradeStatus: string;
    assetCategory: string;
    vaultValue: number | null;
    /** Show placings on record for this horse (🏆 chip). */
    showRecordCount: number;
    moldName: string | null;
}

/** Facet dropdown options across the OWNER's whole collection. */
export interface StableFacetOptions {
    makers: string[];
    scales: string[];
    finishes: string[];
    categories: string[];
}

/** Sidebar aggregates (from the summary RPC, or the interim fallback). */
export interface StableSummary {
    totalHorses: number;
    vaultTotal: number;
    forSaleCount: number;
    collections: { id: string; name: string; count: number; value: number }[];
}

/** A saved view as the client sees it. */
export interface SavedView {
    id: string;
    name: string;
    params: Record<string, string>;
    createdAt: string;
}
