import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { getPublicImageUrls } from "@/lib/utils/storage";

// ============================================================
// REFERENCE PAGES (MOVE 1 / Batch I) — public catalog release data
// ============================================================
// Anon-safe reads (public horses via RLS + anon-granted RPCs), aggregate only.
// Uses a COOKIE-LESS anon client, and every read is wrapped in unstable_cache
// (revalidate 3600). The global authenticated <Header> forces pages dynamic
// app-wide, so page-level ISR can't apply — but this data cache means a
// Googlebot crawl of ~11k pages hits the DB at most once per page per hour
// instead of on every request. Server-only module (not a "use server" action).
// ============================================================

const REVALIDATE = 3600;

export interface CatalogRow {
    id: string;
    item_type: string;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    attributes: Record<string, unknown> | null;
}

export const resolveReferenceItem = unstable_cache(
    async (makerSlug: string, slug: string): Promise<CatalogRow | null> => {
        const supabase = createAnonClient();
        const { data } = await supabase
            .from("catalog_items")
            .select("id, item_type, title, maker, maker_slug, slug, scale, attributes")
            .eq("maker_slug", makerSlug)
            .eq("slug", slug)
            .maybeSingle();
        return (data as CatalogRow | null) ?? null;
    },
    ["reference:item"],
    { revalidate: REVALIDATE },
);

export interface ReferenceListing {
    id: string;
    name: string;
    tradeStatus: string;
    price: number | null;
    notes: string | null;
    thumbnailUrl: string | null;
    ownerAlias: string;
}

/**
 * Active for-sale listings of a catalog model, cheapest first, via the anon-safe
 * get_catalog_listings RPC (migration 132) so the seller alias renders for anon.
 * Text-only (no thumbnail), so the photo opt-out doesn't affect listings.
 */
export const getActiveListingsForCatalog = unstable_cache(
    async (catalogId: string, limit = 12): Promise<ReferenceListing[]> => {
        const supabase = createAnonClient();
        const { data } = await supabase.rpc("get_catalog_listings", {
            p_catalog_id: catalogId,
            p_limit: limit,
        });
        const rows = (data ?? []) as {
            horse_id: string;
            custom_name: string | null;
            trade_status: string | null;
            listing_price: number | null;
            marketplace_notes: string | null;
            owner_alias: string | null;
        }[];
        return rows.map((r) => ({
            id: r.horse_id,
            name: r.custom_name ?? "Unnamed",
            tradeStatus: r.trade_status ?? "",
            price: r.listing_price != null ? Number(r.listing_price) : null,
            notes: r.marketplace_notes,
            thumbnailUrl: null,
            ownerAlias: r.owner_alias ?? "",
        }));
    },
    ["reference:listings"],
    { revalidate: REVALIDATE },
);

export interface ReferencePhoto {
    url: string;
    /** The owning collector's name for their horse — distinguishes finishes on a mold. */
    name: string;
}

/**
 * Representative photos of a catalog model from any public owner (the catalog
 * table stores no images). Each photo carries the owner's horse name so a mold
 * page can label its varied finishes. Honors the show_photos_on_reference
 * opt-out (migration 131) via a SECURITY DEFINER RPC.
 */
export const getCatalogPhotos = unstable_cache(
    async (catalogId: string, limit = 8): Promise<ReferencePhoto[]> => {
        const supabase = createAnonClient();
        const { data } = await supabase.rpc("get_catalog_reference_photos", {
            p_catalog_id: catalogId,
            p_limit: limit,
        });
        const rows = (data ?? []) as { image_url: string | null; horse_name: string | null }[];
        const withPhoto = rows.filter((r) => r.image_url) as { image_url: string; horse_name: string | null }[];
        const urlMap = getPublicImageUrls(withPhoto.map((r) => r.image_url));
        return withPhoto.map((r) => ({ url: urlMap.get(r.image_url) ?? r.image_url, name: r.horse_name ?? "" }));
    },
    ["reference:photos"],
    { revalidate: REVALIDATE },
);

export interface ChildRelease {
    id: string;
    title: string;
    makerSlug: string | null;
    slug: string | null;
    color: string | null;
}

/**
 * Releases catalogued on a given mold (mold→versions). Empty for molds with no
 * discrete releases (e.g. Peter Stone one-of-a-kinds).
 */
export const getChildReleases = unstable_cache(
    async (moldId: string, limit = 60): Promise<ChildRelease[]> => {
        const supabase = createAnonClient();
        const { data } = await supabase
            .from("catalog_items")
            .select("id, title, maker_slug, slug, attributes")
            .eq("parent_id", moldId)
            .eq("item_type", "plastic_release")
            .order("title")
            .limit(limit);
        const rows = (data ?? []) as unknown as {
            id: string;
            title: string;
            maker_slug: string | null;
            slug: string | null;
            attributes: Record<string, unknown> | null;
        }[];
        return rows.map((r) => ({
            id: r.id,
            title: r.title,
            makerSlug: r.maker_slug,
            slug: r.slug,
            color: (r.attributes?.color_description as string) ?? null,
        }));
    },
    ["reference:child-releases"],
    { revalidate: REVALIDATE },
);

/**
 * "N collectors have this" + "N want this" aggregate counts (migration 130).
 */
export const getCatalogCounts = unstable_cache(
    async (catalogId: string): Promise<{ collectors: number; wanters: number }> => {
        const supabase = createAnonClient();
        const [collectorsRes, wantersRes] = await Promise.all([
            supabase.rpc("count_catalog_collectors", { p_catalog_id: catalogId }),
            supabase.rpc("count_catalog_wanters", { p_catalog_id: catalogId }),
        ]);
        return {
            collectors: Number(collectorsRes.data ?? 0),
            wanters: Number(wantersRes.data ?? 0),
        };
    },
    ["reference:counts"],
    { revalidate: REVALIDATE },
);

export interface ReferenceMarket {
    medianPrice: number;
    lowestPrice: number;
    highestPrice: number;
    transactionVolume: number;
}

/**
 * Blue Book aggregate for the reference teaser via the anon-safe get_market_rows
 * RPC (migration 126). Mirrors getMarketPrice's "first row" behavior.
 */
export const getReferenceMarket = unstable_cache(
    async (catalogId: string): Promise<ReferenceMarket | null> => {
        const supabase = createAnonClient();
        const { data } = await supabase.rpc("get_market_rows", { p_catalog_id: catalogId });
        const row = (data as Record<string, unknown>[] | null)?.[0];
        if (!row) return null;
        return {
            medianPrice: Number(row.median_price) || 0,
            lowestPrice: Number(row.lowest_price) || 0,
            highestPrice: Number(row.highest_price) || 0,
            transactionVolume: Number(row.transaction_volume) || 0,
        };
    },
    ["reference:market"],
    { revalidate: REVALIDATE },
);
