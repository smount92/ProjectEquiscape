"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// Social Actions — Favorites (Likes)
// ============================================================

export async function toggleFavorite(horseId: string): Promise<{
    success: boolean;
    isFavorited?: boolean;
    count?: number;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return { success: false, error: "Not authenticated." };

        // Check if already favorited
        const { data: existing } = await supabase
            .from("horse_favorites")
            .select("id")
            .eq("user_id", user.id)
            .eq("horse_id", horseId)
            .maybeSingle();

        if (existing) {
            // Remove favorite
            await supabase
                .from("horse_favorites")
                .delete()
                .eq("id", existing.id);
        } else {
            // Add favorite
            await supabase.from("horse_favorites").insert({
                user_id: user.id,
                horse_id: horseId,
            });
        }

        // Get updated count
        const { count } = await supabase
            .from("horse_favorites")
            .select("id", { count: "exact", head: true })
            .eq("horse_id", horseId);

        return {
            success: true,
            isFavorited: !existing,
            count: count ?? 0,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to toggle favorite.",
        };
    }
}
