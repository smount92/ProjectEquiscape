"use server";

import { createClient } from "@/lib/supabase/server";
import { getPublicImageUrls } from "@/lib/utils/storage";

// ============================================================
// REFERENCE PAGES (MOVE 1 / Batch I) — public catalog release data
// Anon-safe: reads only public horses (RLS) + anon-safe RPCs. Aggregate only,
// never exposes vault values or private owners.
// ============================================================

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
 * Active for-sale listings of a given catalog model, cheapest first, via the
 * anon-safe get_catalog_listings RPC (migration 132) so the seller alias renders
 * for anonymous visitors too (the users table is authenticated-only). Text-only
 * (no thumbnail), so the photo opt-out doesn't affect listings.
 */
export async function getActiveListingsForCatalog(
    catalogId: string,
    limit = 12,
): Promise<ReferenceListing[]> {
    const supabase = await createClient();
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
}

export interface ReferencePhoto {
    url: string;
    /** The owning collector's name for their horse — distinguishes finishes on a mold. */
    name: string;
}

/**
 * Representative photos of a catalog model from any public owner (not just
 * for-sale) — the catalog table itself stores no images. Each photo carries the
 * owner's horse name so a mold page can label its varied finishes. Powers the
 * hero + thumbnails on the reference page.
 */
export async function getCatalogPhotos(catalogId: string, limit = 8): Promise<ReferencePhoto[]> {
    const supabase = await createClient();
    // SECURITY DEFINER RPC — anon-safe (users table is authenticated-only) and
    // it honors each owner's show_photos_on_reference opt-out (migration 131).
    const { data } = await supabase.rpc("get_catalog_reference_photos", {
        p_catalog_id: catalogId,
        p_limit: limit,
    });
    const rows = (data ?? []) as { image_url: string | null; horse_name: string | null }[];
    const withPhoto = rows.filter((r) => r.image_url) as { image_url: string; horse_name: string | null }[];
    const urlMap = getPublicImageUrls(withPhoto.map((r) => r.image_url));
    return withPhoto.map((r) => ({ url: urlMap.get(r.image_url) ?? r.image_url, name: r.horse_name ?? "" }));
}

export interface ChildRelease {
    id: string;
    title: string;
    makerSlug: string | null;
    slug: string | null;
    color: string | null;
}

/**
 * Releases catalogued on a given mold (the mold→versions relationship). Empty
 * for molds with no discrete releases (e.g. Peter Stone one-of-a-kinds).
 */
export async function getChildReleases(moldId: string, limit = 60): Promise<ChildRelease[]> {
    const supabase = await createClient();
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
}

/**
 * "N collectors have this" + "N want this" aggregate counts via the
 * SECURITY DEFINER RPCs (migration 130). Anon-safe.
 */
export async function getCatalogCounts(
    catalogId: string,
): Promise<{ collectors: number; wanters: number }> {
    const supabase = await createClient();
    const [collectorsRes, wantersRes] = await Promise.all([
        supabase.rpc("count_catalog_collectors", { p_catalog_id: catalogId }),
        supabase.rpc("count_catalog_wanters", { p_catalog_id: catalogId }),
    ]);
    return {
        collectors: Number(collectorsRes.data ?? 0),
        wanters: Number(wantersRes.data ?? 0),
    };
}
