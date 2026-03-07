"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/app/actions/notifications";
import { createActivityEvent } from "@/app/actions/activity";

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

        // Notify horse owner (fire-and-forget)
        const { data: horse } = await supabase
            .from("user_horses")
            .select("owner_id, custom_name")
            .eq("id", horseId)
            .single();
        if (horse) {
            const h = horse as { owner_id: string; custom_name: string };
            const { data: actor } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
            const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
            createNotification({
                userId: h.owner_id,
                type: "favorite",
                actorId: user.id,
                content: `@${alias} ❤️ your horse ${h.custom_name}`,
                horseId,
            });
            createActivityEvent({
                actorId: user.id,
                eventType: "favorite",
                horseId,
            });
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

    // Notify + activity event (fire-and-forget)
    const { data: horse } = await supabase
        .from("user_horses")
        .select("owner_id, custom_name")
        .eq("id", horseId)
        .single();
    if (horse) {
        const h = horse as { owner_id: string; custom_name: string };
        const { data: actor } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
        const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
        createNotification({
            userId: h.owner_id,
            type: "comment",
            actorId: user.id,
            content: `@${alias} commented on ${h.custom_name}`,
            horseId,
        });
        createActivityEvent({
            actorId: user.id,
            eventType: "comment",
            horseId,
        });
    }

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
