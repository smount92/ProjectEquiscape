/**
 * Digital Stable v2 — row types derived from the generated schema
 * (migration 123 applied 2026-07-10; table/RPC shapes flow in via
 * gen-types). `params`/`collections` are JSONB in Postgres, so the
 * generator types them as Json — narrowed here to the domain shapes.
 */

import type { Database } from "@/lib/types/database.generated";

type Tables = Database["public"]["Tables"];

/** stable_saved_views row (params JSONB narrowed to the filter map). */
export type StableSavedViewRow = Omit<Tables["stable_saved_views"]["Row"], "params"> & {
    params: Record<string, string>;
};

/** One row from get_stable_summary(p_owner) (collections JSONB narrowed). */
export type StableSummaryRow = Omit<
    Database["public"]["Functions"]["get_stable_summary"]["Returns"][number],
    "collections"
> & {
    collections: { id: string; name: string; count: number; value: number }[];
};

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
