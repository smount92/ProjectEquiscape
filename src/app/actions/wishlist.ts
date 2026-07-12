"use server";

import { logger } from "@/lib/logger";

import { createClient } from "@/lib/supabase/server";

/**
 * Add a catalog item to the current user's wishlist.
 * @param catalogItemId - UUID of the catalog item
 */
export async function addToWishlist(
    catalogId: string | null,
    notes?: string
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "You must be logged in.", success: false };
    }

    // Allow either a catalogId OR notes-only (custom escape hatch)
    if (!catalogId && !notes?.trim()) {
        return { error: "No reference or custom note to wishlist.", success: false };
    }

    const { error } = await supabase.from("user_wishlists").insert({
        user_id: user.id,
        catalog_id: catalogId || null,
        notes: notes?.trim() || null,
    });

    if (error) {
        // Unique constraint violation = already wishlisted
        if (error.code === "23505") {
            return { error: "Already in your wishlist!", success: false };
        }
        logger.error("Wishlist", "Insert error", error);
        return { error: "Failed to add to wishlist.", success: false };
    }

    // Wanted engine (MOVE 1): nudge owners of this model that someone wants it.
    // Gated behind NEXT_PUBLIC_WANTED_NUDGE so we can ship the passive counts
    // first and switch on active nudging deliberately. The RPC is aggregate,
    // anonymous, throttled, and opt-out-aware (migration 130); errors here must
    // never fail the wishlist add.
    if (catalogId && process.env.NEXT_PUBLIC_WANTED_NUDGE === "1") {
        const { error: nudgeError } = await supabase.rpc("notify_catalog_owners_of_demand", {
            p_catalog_id: catalogId,
            p_wanter_id: user.id,
        });
        if (nudgeError) logger.error("Wishlist", "Demand nudge failed", nudgeError);
    }

    return { error: null, success: true };
}

/**
 * Remove a catalog item from the current user's wishlist.
 * @param catalogItemId - UUID of the catalog item
 */
export async function removeFromWishlist(wishlistId: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "You must be logged in.", success: false };
    }

    const { error } = await supabase
        .from("user_wishlists")
        .delete()
        .eq("id", wishlistId)
        .eq("user_id", user.id);

    if (error) {
        logger.error("Wishlist", "Delete error", error);
        return { error: "Failed to remove from wishlist.", success: false };
    }

    return { error: null, success: true };
}

/**
 * Per-user wishlist state for a catalog item — whether the viewer is logged in
 * and whether they already want it. Called client-side by the reference page's
 * WantButton so the page itself stays cookie-free and cacheable.
 */
export async function getWishlistState(
    catalogId: string,
): Promise<{ loggedIn: boolean; wanted: boolean }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { loggedIn: false, wanted: false };

    const { data } = await supabase
        .from("user_wishlists")
        .select("id")
        .eq("user_id", user.id)
        .eq("catalog_id", catalogId)
        .maybeSingle();
    return { loggedIn: true, wanted: Boolean(data) };
}
