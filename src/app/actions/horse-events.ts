"use server";

import { createActivityEvent } from "@/app/actions/activity";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Fire-and-forget activity event when a horse is made public.
 * Called from client-side add/edit forms after successful insert/update.
 */
export async function notifyHorsePublic(data: {
    userId: string;
    horseId: string;
    horseName: string;
    finishType: string;
    tradeStatus?: string;
    catalogId?: string | null;
}): Promise<void> {
    // Log the activity event
    await createActivityEvent({
        actorId: data.userId,
        eventType: "new_horse",
        horseId: data.horseId,
        metadata: { horseName: data.horseName, finishType: data.finishType },
    });

    // Check for wishlist matches if horse is listed for sale
    if (
        (data.tradeStatus === "For Sale" || data.tradeStatus === "Open to Offers") &&
        data.catalogId
    ) {
        try {
            await checkWishlistMatches(data);
        } catch {
            // Non-blocking — best effort
        }
    }
}

/**
 * Check if any user's wishlist matches a newly-listed horse.
 * Uses Service Role to read across all users' wishlists (RLS restricts SELECT to own).
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
                content: `A ${data.horseName} matching your wishlist is now ${data.tradeStatus}!`,
                horse_id: data.horseId,
            });
        }
    } catch {
        console.error("[WishlistMatch] Failed to check matches");
    }
}
