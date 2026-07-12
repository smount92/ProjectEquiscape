"use server";

import { logger } from "@/lib/logger";

import { createActivityEvent } from "@/app/actions/activity";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Activity event when a horse is made public.
 * Rule: No photo, no feed — silently skip horses with 0 photos.
 *
 * SECURITY: this is a directly-callable "use server" action (invoked from the
 * client add/edit forms). It must not trust the identity or horse details in
 * its argument — it authenticates the caller and re-reads the horse
 * authoritatively, bailing unless the caller owns a public copy. Otherwise a
 * client could forge feed events and wishlist-match notifications for horses it
 * doesn't own, for arbitrary catalog ids.
 */
export async function notifyHorsePublic(data: {
    userId: string;
    horseId: string;
    horseName: string;
    finishType: string;
    tradeStatus?: string;
    catalogId?: string | null;
    photoCount?: number;
}): Promise<void> {
    // Rule A: No photo, no feed — don't pollute the feed with empty cards
    if (!data.photoCount || data.photoCount === 0) {
        return;
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Authoritative horse read (RLS lets an owner read their own row). Trust the
    // DB row, never the caller-supplied name/catalog/status/owner.
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, owner_id, custom_name, finish_type, catalog_id, trade_status, is_public")
        .eq("id", data.horseId)
        .single<{
            id: string;
            owner_id: string;
            custom_name: string;
            finish_type: string | null;
            catalog_id: string | null;
            trade_status: string | null;
            is_public: boolean;
        }>();
    if (!horse || horse.owner_id !== user.id || !horse.is_public) return;

    // Log the activity event
    await createActivityEvent({
        actorId: user.id,
        eventType: "new_horse",
        horseId: horse.id,
        metadata: { horseName: horse.custom_name, finishType: horse.finish_type ?? "OF" },
    });

    // Check for wishlist matches if horse is listed for sale
    if (
        (horse.trade_status === "For Sale" || horse.trade_status === "Open to Offers") &&
        horse.catalog_id
    ) {
        try {
            await checkWishlistMatches({
                userId: user.id,
                horseId: horse.id,
                horseName: horse.custom_name,
                tradeStatus: horse.trade_status,
                catalogId: horse.catalog_id,
            });
        } catch {
            // Non-blocking — best effort
        }
    }
}

/**
 * Check if any user's wishlist matches a newly-listed horse.
 * Uses Service Role to read across all users' wishlists (RLS restricts SELECT to own).
 * Inputs are trusted — the only caller (notifyHorsePublic) derives them from an
 * authenticated, ownership-verified horse read.
 */
async function checkWishlistMatches(data: {
    userId: string;
    horseId: string;
    horseName: string;
    tradeStatus?: string;
    catalogId?: string | null;
}): Promise<void> {
    try {
        const supabaseAdmin = getAdminClient();

        if (!data.catalogId) return;

        const { data: wishlistMatches } = await supabaseAdmin
            .from("user_wishlists")
            .select("user_id")
            .eq("catalog_id", data.catalogId)
            .neq("user_id", data.userId); // Don't notify the seller

        if (!wishlistMatches || wishlistMatches.length === 0) return;

        // Deduplicate user IDs
        const uniqueUserIds = [...new Set(wishlistMatches.map((m: { user_id: string }) => m.user_id))];

        // Create a notification for each matching user
        for (const matchUserId of uniqueUserIds) {
            await supabaseAdmin.from("notifications").insert({
                user_id: matchUserId,
                type: "wishlist_match",
                actor_id: data.userId,
                content: `A ${data.horseName} matching your Want List is now ${data.tradeStatus}!`,
                horse_id: data.horseId,
            });
        }
    } catch {
        logger.error("WishlistMatch", "Failed to check matches");
    }
}
