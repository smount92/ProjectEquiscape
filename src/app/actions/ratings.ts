"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/app/actions/notifications";
import { createActivityEvent } from "@/app/actions/activity";

/**
 * Leave a rating for the other party in a conversation.
 * One rating per user per conversation (unique constraint enforced).
 */
export async function leaveRating(data: {
    conversationId: string;
    reviewedId: string;
    stars: number;
    reviewText?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (data.stars < 1 || data.stars > 5) return { success: false, error: "Stars must be 1-5." };
    if (user.id === data.reviewedId) return { success: false, error: "You cannot rate yourself." };

    const { error } = await supabase.from("user_ratings").insert({
        conversation_id: data.conversationId,
        reviewer_id: user.id,
        reviewed_id: data.reviewedId,
        stars: data.stars,
        review_text: data.reviewText?.trim() || null,
    });

    if (error) {
        if (error.code === "23505") {
            return { success: false, error: "You have already rated this transaction." };
        }
        return { success: false, error: error.message };
    }

    // Notify rated user (fire-and-forget)
    const { data: actor } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
    await createNotification({
        userId: data.reviewedId,
        type: "rating",
        actorId: user.id,
        content: `@${alias} left you a ★${data.stars} rating`,
        conversationId: data.conversationId,
    });
    await createActivityEvent({
        actorId: user.id,
        eventType: "rating",
        metadata: { stars: data.stars, targetAlias: alias },
    });

    return { success: true };
}

/**
 * Delete (retract) a rating. Reviewer-only via RLS.
 */
export async function deleteRating(
    ratingId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    const { error } = await supabase
        .from("user_ratings")
        .delete()
        .eq("id", ratingId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Get a user's rating summary: average, total count, and the individual ratings.
 */
export async function getUserRatingSummary(
    userId: string
): Promise<{
    average: number;
    count: number;
    ratings: {
        id: string;
        stars: number;
        reviewText: string | null;
        reviewerAlias: string;
        createdAt: string;
    }[];
}> {
    const supabase = await createClient();

    const { data: rawRatings } = await supabase
        .from("user_ratings")
        .select("id, stars, review_text, created_at, reviewer_id")
        .eq("reviewed_id", userId)
        .order("created_at", { ascending: false });

    const ratings = (rawRatings ?? []) as {
        id: string;
        stars: number;
        review_text: string | null;
        created_at: string;
        reviewer_id: string;
    }[];

    if (ratings.length === 0) {
        return { average: 0, count: 0, ratings: [] };
    }

    // Batch-fetch reviewer aliases
    const reviewerIds = [...new Set(ratings.map((r) => r.reviewer_id))];
    const aliasMap = new Map<string, string>();
    if (reviewerIds.length > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", reviewerIds);
        users?.forEach((u: { id: string; alias_name: string }) => {
            aliasMap.set(u.id, u.alias_name);
        });
    }

    const total = ratings.reduce((sum, r) => sum + r.stars, 0);
    const average = Math.round((total / ratings.length) * 10) / 10;

    return {
        average,
        count: ratings.length,
        ratings: ratings.map((r) => ({
            id: r.id,
            stars: r.stars,
            reviewText: r.review_text,
            reviewerAlias: aliasMap.get(r.reviewer_id) ?? "Unknown",
            createdAt: r.created_at,
        })),
    };
}
