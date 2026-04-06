"use server";

import { createClient } from "@/lib/supabase/server";
import { getPublicImageUrls } from "@/lib/utils/storage";

const PAGE_SIZE = 24;

export interface ShowRingCard {
    id: string;
    ownerId: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    releaseLine: string | null;
    ownerAlias: string;
    thumbnailUrl: string | null;
    sculptor: string | null;
    tradeStatus: string;
    listingPrice: number | null;
    marketplaceNotes: string | null;
    moldName: string | null;
    releaseName: string | null;
    refMoldId: string | null;
    catalogId: string | null;
    favoriteCount: number;
    isFavorited: boolean;
    scale: string | null;
    hoofprintCount: number;
    assetCategory: string;
}

/**
 * Load more Show Ring horses for the "Load More" button.
 * Uses cursor-based pagination on created_at for stable ordering.
 */
export async function loadMoreShowRing(
    offset: number,
    filters?: {
        q?: string;
        finishType?: string;
        tradeStatus?: string;
        sortBy?: string;
    }
): Promise<{ cards: ShowRingCard[]; hasMore: boolean }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { cards: [], hasMore: false };

    // Build query — mirrors the page's initial query
    let query = supabase
        .from("user_horses")
        .select(
            `
            id, owner_id, custom_name, finish_type, condition_grade, asset_category, created_at, sculptor, trade_status, listing_price, marketplace_notes, catalog_id,
            users!inner(alias_name),
            catalog_items:catalog_id(title, maker, scale, item_type),
            horse_images(image_url, angle_profile)
            `,
            { count: "exact" }
        )
        .eq("visibility", "public");

    // Apply filters
    if (filters?.q) {
        query = query.or(`custom_name.ilike.%${filters.q}%,sculptor.ilike.%${filters.q}%`);
    }
    if (filters?.finishType && filters.finishType !== "all") {
        query = query.eq("finish_type", filters.finishType as "OF" | "Custom" | "Artist Resin");
    }
    if (filters?.tradeStatus && filters.tradeStatus !== "all") {
        query = query.eq("trade_status", filters.tradeStatus);
    }

    // Sorting
    if (filters?.sortBy === "oldest") {
        query = query.order("created_at", { ascending: true });
    } else {
        query = query.order("created_at", { ascending: false });
    }

    const { data: rawHorses, count } = await query.range(offset, offset + PAGE_SIZE - 1);

    // Filter out blocked users
    const { data: myBlocks } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
    const blockedOwnerIds = new Set((myBlocks ?? []).map((b) => b.blocked_id));

    const horses = (rawHorses ?? []).filter((h) => !blockedOwnerIds.has(h.owner_id));

    // Generate signed URLs for thumbnails
    const thumbnailUrls: string[] = [];
    horses.forEach((horse) => {
        const thumb = horse.horse_images?.find((img: { angle_profile: string }) => img.angle_profile === "Primary_Thumbnail");
        const first = horse.horse_images?.[0];
        const url = (thumb as { image_url: string } | undefined)?.image_url
            || (first as { image_url: string } | undefined)?.image_url;
        if (url) thumbnailUrls.push(url);
    });
    const signedUrlMap = getPublicImageUrls(thumbnailUrls);

    // Social data: favorites + hoofprints
    const horseIds = horses.map((h) => h.id);

    const { data: allFavs } = horseIds.length > 0
        ? await supabase.from("horse_favorites").select("horse_id").in("horse_id", horseIds)
        : { data: [] };

    const favCountMap = new Map<string, number>();
    (allFavs ?? []).forEach((f) => {
        favCountMap.set(f.horse_id, (favCountMap.get(f.horse_id) || 0) + 1);
    });

    const { data: userFavs } = horseIds.length > 0
        ? await supabase.from("horse_favorites").select("horse_id").eq("user_id", user.id).in("horse_id", horseIds)
        : { data: [] };
    const userFavSet = new Set((userFavs ?? []).map((f) => f.horse_id));

    const { data: hoofprintData } = horseIds.length > 0
        ? await supabase.from("v_horse_hoofprint").select("horse_id").in("horse_id", horseIds).eq("is_public", true)
        : { data: [] };
    const hoofprintCountMap = new Map<string, number>();
    (hoofprintData ?? []).forEach((e) => {
        if (e.horse_id) hoofprintCountMap.set(e.horse_id, (hoofprintCountMap.get(e.horse_id) || 0) + 1);
    });

    // Build cards
    const cards: ShowRingCard[] = horses.map((horse) => {
        const thumb = horse.horse_images?.find((img: { angle_profile: string }) => img.angle_profile === "Primary_Thumbnail");
        const firstImage = horse.horse_images?.[0];
        const imageUrl = (thumb as { image_url: string } | undefined)?.image_url
            || (firstImage as { image_url: string } | undefined)?.image_url;
        const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

        const catItem = horse.catalog_items as { title: string; maker: string; scale: string } | null;
        const refName = catItem
            ? `${catItem.maker} ${catItem.title}`
            : "Unlisted Mold";
        const ownerAlias = (horse.users as { alias_name: string })?.alias_name ?? "Unknown";

        return {
            id: horse.id,
            ownerId: horse.owner_id,
            customName: horse.custom_name,
            finishType: horse.finish_type ?? "OF",
            conditionGrade: horse.condition_grade ?? "",
            createdAt: horse.created_at,
            refName,
            releaseLine: null,
            ownerAlias,
            thumbnailUrl: signedUrl || null,
            sculptor: horse.sculptor || null,
            tradeStatus: horse.trade_status || "Not for Sale",
            listingPrice: horse.listing_price ?? null,
            marketplaceNotes: horse.marketplace_notes || null,
            moldName: catItem?.title || null,
            releaseName: catItem?.title || null,
            refMoldId: horse.catalog_id || null,
            catalogId: horse.catalog_id || null,
            favoriteCount: favCountMap.get(horse.id) || 0,
            isFavorited: userFavSet.has(horse.id),
            scale: catItem?.scale || null,
            hoofprintCount: hoofprintCountMap.get(horse.id) || 0,
            assetCategory: horse.asset_category || "model",
        };
    });

    return {
        cards,
        hasMore: (count ?? 0) > offset + PAGE_SIZE,
    };
}
