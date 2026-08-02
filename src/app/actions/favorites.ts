"use server";

/**
 * Favorites page server actions.
 *
 * ONE query core (queryFavoritesPage) feeds both the first page and
 * Show More — same pattern as the Show Ring (actions/showring.ts), so
 * paging can never drift from the page query.
 *
 * RLS does the privacy work: the user_horses embed returns NULL for
 * horses the viewer may no longer see (went private/unlisted, soft-
 * deleted). shapeFavorites (src/lib/favorites/shape.ts) turns those
 * into id-only "unavailable" entries — no horse fields ever reach the
 * client for them. Hard-deleted horses cascade the favorite row away
 * entirely (FK ON DELETE CASCADE, migration 010).
 */

import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getPublicImageUrls } from "@/lib/utils/storage";
import {
    FAVORITES_PAGE_SIZE,
    shapeFavorites,
    type FavoriteEntry,
    type RawFavoriteRow,
} from "@/lib/favorites/shape";

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

const getFavoritesPageSchema = z.object({
    offset: z.number().int().min(0).max(100_000).default(0),
    limit: z.number().int().min(1).max(FAVORITES_PAGE_SIZE).default(FAVORITES_PAGE_SIZE),
});

const FAVORITE_SELECT = `id, created_at, horse_id,
    user_horses:horse_id (
        id, custom_name, trade_status, listing_price, visibility, deleted_at,
        users:owner_id ( alias_name ),
        horse_images ( image_url, angle_profile )
    )`;

async function queryFavoritesPage(
    supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
    userId: string,
    offset: number,
    limit: number,
): Promise<{ entries: FavoriteEntry[]; totalCount: number }> {
    const { data, count, error } = await supabase
        .from("horse_favorites")
        .select(FAVORITE_SELECT, { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as RawFavoriteRow[];
    const entries = shapeFavorites(rows);

    // Map storage paths → public thumbnail URLs (synchronous).
    const paths = entries.flatMap((e) => (e.kind === "available" && e.imagePath ? [e.imagePath] : []));
    const urlMap = getPublicImageUrls(paths);
    for (const entry of entries) {
        if (entry.kind === "available" && entry.imagePath) {
            entry.thumbnailUrl = urlMap.get(entry.imagePath) ?? null;
            entry.imagePath = null; // never ship raw storage paths to the client
        }
    }

    return { entries, totalCount: count ?? 0 };
}

/** First page of the viewer's favorites, newest-favorited first. */
export async function getFavoritesPage(
    input: z.input<typeof getFavoritesPageSchema> = {},
): Promise<ActionResult<{ entries: FavoriteEntry[]; totalCount: number; hasMore: boolean }>> {
    const parsed = getFavoritesPageSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid page request." };

    try {
        const { supabase, user } = await requireAuth();
        const { offset, limit } = parsed.data;
        const { entries, totalCount } = await queryFavoritesPage(supabase, user.id, offset, limit);
        return {
            success: true,
            entries,
            totalCount,
            hasMore: totalCount > offset + entries.length,
        };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Query failed." };
    }
}

/** Append the next page for the "Show More" button. */
export async function loadMoreFavorites(
    input: z.input<typeof getFavoritesPageSchema>,
): Promise<ActionResult<{ entries: FavoriteEntry[]; hasMore: boolean }>> {
    return getFavoritesPage(input);
}
