"use server";

import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// Social Actions — Favorites (Likes)
// ============================================================

/**
 * Favorite or unfavorite a horse. Idempotent toggle.
 * @param horseId - UUID of the horse to favorite/unfavorite
 */
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

            // Deferred: tell the owner. Hearts were previously invisible
            // to the hearted — the notification icon, prefs key
            // ("favorites"), and bell renderer all already exist for this
            // type; only the emitter was missing. Favorite-only (never on
            // unfavorite), and createNotification handles the self-guard
            // and prefs gate.
            const actorId = user.id;
            after(async () => {
                try {
                    const supabaseDeferred = await createClient();
                    const [{ data: horse }, { data: actor }] = await Promise.all([
                        supabaseDeferred
                            .from("user_horses")
                            .select("owner_id, custom_name")
                            .eq("id", horseId)
                            .single(),
                        supabaseDeferred
                            .from("users")
                            .select("alias_name")
                            .eq("id", actorId)
                            .single(),
                    ]);
                    if (!horse) return;
                    const owner = (horse as { owner_id: string }).owner_id;
                    if (owner === actorId) return;
                    const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
                    const { createNotification } = await import("@/lib/notifications/createNotification");
                    await createNotification({
                        userId: owner,
                        type: "favorite",
                        actorId,
                        content: `@${alias} favorited ${(horse as { custom_name: string }).custom_name}`,
                        linkUrl: `/community/${horseId}`,
                    });
                } catch {
                    // Fire-and-forget — never fail the toggle.
                }
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
