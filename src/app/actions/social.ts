"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// FAVORITES
// ============================================================

/**
 * Toggle a favorite on a public horse.
 * If already favorited → removes it. If not → adds it.
 * Returns the new state and updated count.
 */
export async function toggleFavorite(
    horseId: string
): Promise<{ success: boolean; isFavorited?: boolean; count?: number; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    // Check if already favorited
    const { data: existing } = await supabase
        .from("horse_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("horse_id", horseId)
        .maybeSingle();

    if (existing) {
        // Unfavorite
        const { error } = await supabase
            .from("horse_favorites")
            .delete()
            .eq("id", existing.id);

        if (error) return { success: false, error: error.message };
    } else {
        // Favorite
        const { error } = await supabase
            .from("horse_favorites")
            .insert({ user_id: user.id, horse_id: horseId });

        if (error) {
            // Race condition — already favorited
            if (error.code === "23505") {
                return { success: true, isFavorited: true };
            }
            return { success: false, error: error.message };
        }
    }

    // Fetch updated count
    const { count } = await supabase
        .from("horse_favorites")
        .select("id", { count: "exact", head: true })
        .eq("horse_id", horseId);

    return {
        success: true,
        isFavorited: !existing,
        count: count ?? 0,
    };
}

// ============================================================
// COMMENTS
// ============================================================

/**
 * Add a comment to a public horse.
 * 500 character max. RLS enforces public-only commenting.
 */
export async function addComment(
    horseId: string,
    content: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (!content.trim()) return { success: false, error: "Comment cannot be empty." };
    if (content.trim().length > 500) return { success: false, error: "Comment is too long (500 char max)." };

    const { error } = await supabase.from("horse_comments").insert({
        user_id: user.id,
        horse_id: horseId,
        content: content.trim(),
    });

    if (error) return { success: false, error: error.message };

    return { success: true };
}

/**
 * Delete a comment.
 * RLS enforces: only comment author OR horse owner can delete.
 */
export async function deleteComment(
    commentId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    const { error } = await supabase
        .from("horse_comments")
        .delete()
        .eq("id", commentId);

    if (error) return { success: false, error: error.message };

    return { success: true };
}
