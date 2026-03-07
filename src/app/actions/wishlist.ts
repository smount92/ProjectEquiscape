"use server";

import { createClient } from "@/lib/supabase/server";

export async function addToWishlist(
    moldId: string | null,
    releaseId: string | null,
    notes?: string
) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "You must be logged in.", success: false };
    }

    // Allow either a mold/release ID OR notes-only (custom escape hatch)
    if (!moldId && !releaseId && !notes?.trim()) {
        return { error: "No mold, release, or custom note to wishlist.", success: false };
    }

    const { error } = await supabase.from("user_wishlists").insert({
        user_id: user.id,
        mold_id: moldId || null,
        release_id: releaseId || null,
        notes: notes?.trim() || null,
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
