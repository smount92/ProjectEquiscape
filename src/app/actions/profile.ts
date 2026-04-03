"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getPublicImageUrls } from "@/lib/utils/storage";

const PAGE_SIZE = 24;

export interface ProfileHorseCard {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    thumbnailUrl: string | null;
    collectionName: string | null;
    tradeStatus: string;
    listingPrice: number | null;
    marketplaceNotes: string | null;
}

/**
 * Update the current user's bio.
 */
export async function updateBio(bio: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const trimmed = bio.trim().slice(0, 500);

    const { error } = await supabase
        .from("users")
        .update({ bio: trimmed || null })
        .eq("id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/profile");
    return { success: true };
}

/**
 * Load more profile horses for infinite scroll / Load More button.
 * Uses offset-based pagination via .range().
 */
export async function loadMoreProfileHorses(
    userId: string,
    offset: number
): Promise<{ horses: ProfileHorseCard[]; hasMore: boolean }> {
    const supabase = await createClient();

    const { data: rawHorses, count } = await supabase
        .from("user_horses")
        .select(`
            id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price, marketplace_notes,
            user_collections(name),
            catalog_items:catalog_id(title, maker, item_type),
            horse_images(image_url, angle_profile)
        `, { count: "exact" })
        .eq("owner_id", userId)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    const horses = rawHorses ?? [];

    // Generate public URLs for thumbnails (batch)
    const thumbnailPaths: string[] = [];
    horses.forEach((horse) => {
        const thumb = horse.horse_images?.find(
            (img: { angle_profile: string }) => img.angle_profile === "Primary_Thumbnail"
        );
        const first = horse.horse_images?.[0];
        const url = (thumb as { image_url: string } | undefined)?.image_url
            || (first as { image_url: string } | undefined)?.image_url;
        if (url) thumbnailPaths.push(url);
    });
    const signedUrlMap = getPublicImageUrls(thumbnailPaths);

    const cards: ProfileHorseCard[] = horses.map((horse) => {
        const thumb = horse.horse_images?.find(
            (img: { angle_profile: string }) => img.angle_profile === "Primary_Thumbnail"
        );
        const firstImage = horse.horse_images?.[0];
        const imageUrl = (thumb as { image_url: string } | undefined)?.image_url
            || (firstImage as { image_url: string } | undefined)?.image_url;
        const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

        return {
            id: horse.id,
            customName: horse.custom_name,
            finishType: horse.finish_type ?? "OF",
            conditionGrade: horse.condition_grade ?? "",
            createdAt: horse.created_at,
            refName: horse.catalog_items
                ? `${(horse.catalog_items as { maker: string }).maker} ${(horse.catalog_items as { title: string }).title}`
                : "Unlisted Mold",
            thumbnailUrl: signedUrl || null,
            collectionName: (horse.user_collections as { name: string } | null)?.name || null,
            tradeStatus: horse.trade_status || "Not for Sale",
            listingPrice: horse.listing_price ?? null,
            marketplaceNotes: horse.marketplace_notes || null,
        };
    });

    return {
        horses: cards,
        hasMore: (count ?? 0) > offset + PAGE_SIZE,
    };
}
