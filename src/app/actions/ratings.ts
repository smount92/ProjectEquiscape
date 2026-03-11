"use server";

// ============================================================
// LEGACY SHIMS — Redirect to Universal Trust Engine
// These functions are DEPRECATED. Use transactions.ts directly.
// ============================================================

import { leaveReview, deleteReview, getUserReviewSummary } from "@/app/actions/transactions";

/**
 * @deprecated Use leaveReview() from transactions.ts
 */
export async function leaveRating(data: {
    conversationId: string;
    reviewedId: string;
    stars: number;
    reviewText?: string;
}): Promise<{ success: boolean; error?: string }> {
    // Legacy shim: try to find a transaction for this conversation
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data: txn } = await supabase
        .from("transactions")
        .select("id")
        .eq("conversation_id", data.conversationId)
        .eq("type", "marketplace_sale")
        .maybeSingle();

    if (!txn) {
        return { success: false, error: "No completed transaction found for this conversation. Mark the transaction as complete first." };
    }

    return leaveReview({
        transactionId: (txn as { id: string }).id,
        targetId: data.reviewedId,
        stars: data.stars,
        content: data.reviewText,
    });
}

/**
 * @deprecated Use deleteReview() from transactions.ts
 */
export async function deleteRating(ratingId: string): Promise<{ success: boolean; error?: string }> {
    return deleteReview(ratingId);
}

/**
 * @deprecated Use getUserReviewSummary() from transactions.ts
 */
export async function getUserRatingSummary(userId: string) {
    return getUserReviewSummary(userId);
}
