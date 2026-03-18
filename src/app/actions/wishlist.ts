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
