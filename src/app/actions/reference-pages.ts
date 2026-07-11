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

interface RawHorseRow {
    id: string;
    custom_name: string | null;
    trade_status: string | null;
    listing_price: number | null;
    marketplace_notes: string | null;
    owner_id: string;
    users: { alias_name: string } | { alias_name: string }[] | null;
    horse_images: { image_url: string; angle_profile: string }[] | null;
}

function aliasOf(u: RawHorseRow["users"]): string {
    if (!u) return "";
    return Array.isArray(u) ? (u[0]?.alias_name ?? "") : u.alias_name;
}

function pickThumb(imgs: RawHorseRow["horse_images"]): string | null {
    if (!imgs || imgs.length === 0) return null;
    const primary = imgs.find((i) => i.angle_profile === "Primary_Thumbnail");
    return primary?.image_url || imgs[0].image_url || null;
}

const HORSE_SELECT = `
    id, custom_name, trade_status, listing_price, marketplace_notes, owner_id,
    users!inner(alias_name),
    horse_images(image_url, angle_profile)
`;

/**
 * Active for-sale listings of a given catalog model, cheapest first.
 * Generalized from the /wishlist Matchmaker query. Anon sees only public,
 * non-deleted horses (RLS) — exactly what a reference page should show.
 */
export async function getActiveListingsForCatalog(
    catalogId: string,
    limit = 12,
): Promise<ReferenceListing[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("user_horses")
        .select(HORSE_SELECT)
        .eq("is_public", true)
        .eq("catalog_id", catalogId)
        .is("deleted_at", null)
        .in("trade_status", ["For Sale", "Open to Offers"])
        .order("listing_price", { ascending: true, nullsFirst: false })
        .limit(limit);

    const rows = (data ?? []) as unknown as RawHorseRow[];
    const rawThumbs = rows.map((r) => pickThumb(r.horse_images)).filter(Boolean) as string[];
    const urlMap = getPublicImageUrls(rawThumbs);

    return rows.map((r) => {
        const raw = pickThumb(r.horse_images);
        return {
            id: r.id,
            name: r.custom_name ?? "Unnamed",
            tradeStatus: r.trade_status ?? "",
            price: r.listing_price,
            notes: r.marketplace_notes,
            thumbnailUrl: raw ? (urlMap.get(raw) ?? raw) : null,
            ownerAlias: aliasOf(r.users),
        };
    });
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
    const { data } = await supabase
        .from("user_horses")
        .select(`id, custom_name, horse_images(image_url, angle_profile)`)
        .eq("is_public", true)
        .eq("catalog_id", catalogId)
        .is("deleted_at", null)
        .limit(limit);

    const rows = (data ?? []) as unknown as {
        custom_name: string | null;
        horse_images: RawHorseRow["horse_images"];
    }[];
    const withPhoto = rows
        .map((r) => ({ raw: pickThumb(r.horse_images), name: r.custom_name ?? "" }))
        .filter((x) => x.raw) as { raw: string; name: string }[];
    const urlMap = getPublicImageUrls(withPhoto.map((x) => x.raw));
    return withPhoto.map((x) => ({ url: urlMap.get(x.raw) ?? x.raw, name: x.name }));
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
