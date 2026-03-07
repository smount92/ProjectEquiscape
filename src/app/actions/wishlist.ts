"use server";

import { createClient } from "@/lib/supabase/server";

export async function addToWishlist(moldId: string | null, releaseId: string | null) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "You must be logged in.", success: false };
    }

    if (!moldId && !releaseId) {
        return { error: "No mold or release to wishlist.", success: false };
    }

    const { error } = await supabase.from("user_wishlists").insert({
        user_id: user.id,
        mold_id: moldId || null,
        release_id: releaseId || null,
    });

    if (error) {
        // Unique constraint violation = already wishlisted
        if (error.code === "23505") {
            return { error: "Already in your wishlist!", success: false };
        }
        console.error("Wishlist insert error:", error);
        return { error: "Failed to add to wishlist.", success: false };
    }

    return { error: null, success: true };
}

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
        console.error("Wishlist delete error:", error);
        return { error: "Failed to remove from wishlist.", success: false };
    }

    return { error: null, success: true };
}
