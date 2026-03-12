"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/app/actions/notifications";
import { createActivityEvent } from "@/app/actions/activity";
import { revalidatePath } from "next/cache";

// ============================================================
// UNIVERSAL TRUST ENGINE — Server Actions
// Replaces ratings.ts. Reviews attach to transactions, not conversations.
// ============================================================

// ── Create Transaction ──
// Called internally by claim flows. NOT user-facing.
export async function createTransaction(data: {
    type: "transfer" | "parked_sale" | "commission" | "marketplace_sale";
    partyAId: string;
    partyBId: string;
    horseId?: string;
    commissionId?: string;
    conversationId?: string;
    status?: "pending" | "completed";
    metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const admin = getAdminClient();

    const insertData: Record<string, unknown> = {
        type: data.type,
        status: data.status || "completed",
        party_a_id: data.partyAId,
        party_b_id: data.partyBId,
    };
    if (data.horseId) insertData.horse_id = data.horseId;
    if (data.commissionId) insertData.commission_id = data.commissionId;
    if (data.conversationId) insertData.conversation_id = data.conversationId;
    if (data.metadata) insertData.metadata = data.metadata;
    if (data.status === "completed") insertData.completed_at = new Date().toISOString();

    const { data: row, error } = await admin
        .from("transactions")
        .insert(insertData)
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, transactionId: (row as { id: string }).id };
}

// ── Complete Transaction ──
export async function completeTransaction(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase
        .from("transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", transactionId);

    if (error) return { success: false, error: error.message };

    // Market price refresh handled by Vercel cron (/api/cron/refresh-market)

    return { success: true };
}

// ── Get Transactions for User ──
export async function getTransactionsForUser(): Promise<{
    id: string;
    type: string;
    status: string;
    partyAId: string;
    partyBId: string | null;
    horseId: string | null;
    completedAt: string | null;
    createdAt: string;
    reviews: {
        id: string;
        reviewerId: string;
        targetId: string;
        stars: number;
        content: string | null;
        createdAt: string;
    }[];
}[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: rows } = await supabase
        .from("transactions")
        .select("id, type, status, party_a_id, party_b_id, horse_id, completed_at, created_at")
        .or(`party_a_id.eq.${user.id},party_b_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) return [];

    const txnIds = (rows as { id: string }[]).map(r => r.id);

    const { data: reviewRows } = await supabase
        .from("reviews")
        .select("id, transaction_id, reviewer_id, target_id, stars, content, created_at")
        .in("transaction_id", txnIds);

    const reviewsByTxn = new Map<string, typeof reviewRows>();
    for (const r of (reviewRows ?? []) as { id: string; transaction_id: string; reviewer_id: string; target_id: string; stars: number; content: string | null; created_at: string }[]) {
        const list = reviewsByTxn.get(r.transaction_id) ?? [];
        list.push(r);
        reviewsByTxn.set(r.transaction_id, list);
    }

    return (rows as {
        id: string; type: string; status: string;
        party_a_id: string; party_b_id: string | null;
        horse_id: string | null; completed_at: string | null; created_at: string;
    }[]).map(r => ({
        id: r.id,
        type: r.type,
        status: r.status,
        partyAId: r.party_a_id,
        partyBId: r.party_b_id,
        horseId: r.horse_id,
        completedAt: r.completed_at,
        createdAt: r.created_at,
        reviews: ((reviewsByTxn.get(r.id) ?? []) as {
            id: string; reviewer_id: string; target_id: string;
            stars: number; content: string | null; created_at: string;
        }[]).map(rv => ({
            id: rv.id,
            reviewerId: rv.reviewer_id,
            targetId: rv.target_id,
            stars: rv.stars,
            content: rv.content,
            createdAt: rv.created_at,
        })),
    }));
}

// ── Leave Review ──
// Replaces leaveRating(). Params: transactionId, targetId, stars, content?
export async function leaveReview(data: {
    transactionId: string;
    targetId: string;
    stars: number;
    content?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    if (data.stars < 1 || data.stars > 5) return { success: false, error: "Stars must be 1-5." };
    if (user.id === data.targetId) return { success: false, error: "You cannot review yourself." };

    const { error } = await supabase.from("reviews").insert({
        transaction_id: data.transactionId,
        reviewer_id: user.id,
        target_id: data.targetId,
        stars: data.stars,
        content: data.content?.trim() || null,
    });

    if (error) {
        if (error.code === "23505") {
            return { success: false, error: "You have already reviewed this transaction." };
        }
        return { success: false, error: error.message };
    }

    // Notify reviewed user + activity event (fire-and-forget)
    const { data: actor } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
    await createNotification({
        userId: data.targetId,
        type: "rating",
        actorId: user.id,
        content: `@${alias} left you a ★${data.stars} review`,
    });
    await createActivityEvent({
        actorId: user.id,
        eventType: "rating",
        metadata: { stars: data.stars, targetAlias: alias },
    });

    return { success: true };
}

// ── Delete Review ──
export async function deleteReview(
    reviewId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Get User Review Summary ──
// Replaces getUserRatingSummary(). Reads from reviews table.
export async function getUserReviewSummary(
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

    const { data: rawReviews } = await supabase
        .from("reviews")
        .select("id, stars, content, created_at, reviewer_id, users!reviewer_id(alias_name)")
        .eq("target_id", userId)
        .order("created_at", { ascending: false });

    const reviews = (rawReviews as unknown as {
        id: string;
        stars: number;
        content: string | null;
        created_at: string;
        reviewer_id: string;
        users: { alias_name: string } | null;
    }[]) ?? [];

    if (reviews.length === 0) {
        return { average: 0, count: 0, ratings: [] };
    }

    const total = reviews.reduce((sum, r) => sum + r.stars, 0);
    const average = Math.round((total / reviews.length) * 10) / 10;

    return {
        average,
        count: reviews.length,
        ratings: reviews.map((r) => ({
            id: r.id,
            stars: r.stars,
            reviewText: r.content,
            reviewerAlias: r.users?.alias_name || "Unknown",
            createdAt: r.created_at,
        })),
    };
}

// ── Get Reviewable Transactions ──
// Returns completed transactions where the current user has NOT yet left a review.
export async function getReviewableTransactions(): Promise<{
    transactionId: string;
    type: string;
    targetId: string;
    targetAlias: string;
    horseName: string | null;
    completedAt: string;
}[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Get completed transactions where user is a party
    const { data: txns } = await supabase
        .from("transactions")
        .select("id, type, party_a_id, party_b_id, horse_id, completed_at")
        .eq("status", "completed")
        .or(`party_a_id.eq.${user.id},party_b_id.eq.${user.id}`)
        .order("completed_at", { ascending: false });

    if (!txns || txns.length === 0) return [];

    const txnIds = (txns as { id: string }[]).map(t => t.id);

    // Get reviews the current user has already left
    const { data: myReviews } = await supabase
        .from("reviews")
        .select("transaction_id")
        .eq("reviewer_id", user.id)
        .in("transaction_id", txnIds);

    const reviewedTxnIds = new Set((myReviews ?? []).map((r: { transaction_id: string }) => r.transaction_id));

    // Filter to unreviewed transactions
    const unreviewed = (txns as {
        id: string; type: string; party_a_id: string; party_b_id: string | null;
        horse_id: string | null; completed_at: string;
    }[]).filter(t => !reviewedTxnIds.has(t.id));

    if (unreviewed.length === 0) return [];

    // Batch-fetch target user aliases
    const targetIds = [...new Set(unreviewed.map(t =>
        t.party_a_id === user.id ? t.party_b_id : t.party_a_id
    ).filter(Boolean) as string[])];

    const { data: users } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", targetIds);

    const aliasMap = new Map<string, string>();
    for (const u of (users ?? []) as { id: string; alias_name: string }[]) {
        aliasMap.set(u.id, u.alias_name);
    }

    // Batch-fetch horse names
    const horseIds = [...new Set(unreviewed.map(t => t.horse_id).filter(Boolean) as string[])];
    let horseMap = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: horses } = await supabase
            .from("user_horses")
            .select("id, custom_name")
            .in("id", horseIds);
        for (const h of (horses ?? []) as { id: string; custom_name: string }[]) {
            horseMap.set(h.id, h.custom_name);
        }
    }

    return unreviewed.map(t => {
        const targetId = t.party_a_id === user.id ? t.party_b_id! : t.party_a_id;
        return {
            transactionId: t.id,
            type: t.type,
            targetId,
            targetAlias: aliasMap.get(targetId) || "Unknown",
            horseName: t.horse_id ? (horseMap.get(t.horse_id) || null) : null,
            completedAt: t.completed_at,
        };
    });
}

// ── Find or get transaction by conversation ID ──
// Used by inbox to look up the transaction for a conversation
// Returns full state for OfferCard rendering
export async function getTransactionByConversation(
    conversationId: string
): Promise<{
    transactionId: string;
    status: string;
    type: string;
    offerAmount: number | null;
    offerMessage: string | null;
    partyAId: string;
    partyBId: string | null;
    horseId: string | null;
    paidAt: string | null;
    verifiedAt: string | null;
    metadata: Record<string, unknown> | null;
} | null> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("transactions")
        .select("id, status, type, offer_amount, offer_message, party_a_id, party_b_id, horse_id, paid_at, verified_at, metadata")
        .eq("conversation_id", conversationId)
        .eq("type", "marketplace_sale")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data) return null;
    const d = data as Record<string, unknown>;
    return {
        transactionId: d.id as string,
        status: d.status as string,
        type: d.type as string,
        offerAmount: d.offer_amount as number | null,
        offerMessage: d.offer_message as string | null,
        partyAId: d.party_a_id as string,
        partyBId: d.party_b_id as string | null,
        horseId: d.horse_id as string | null,
        paidAt: d.paid_at as string | null,
        verifiedAt: d.verified_at as string | null,
        metadata: d.metadata as Record<string, unknown> | null,
    };
}

// ============================================================
// COMMERCE STATE MACHINE — Safe-Trade Engine
// offer_made → pending_payment → funds_verified → completed
// ============================================================

// ── Make Offer ──
// Buyer submits an offer on a tradeable horse
export async function makeOffer(data: {
    horseId: string;
    sellerId: string;
    amount: number;
    message?: string;
}): Promise<{ success: boolean; transactionId?: string; conversationId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };
    if (user.id === data.sellerId) return { success: false, error: "You cannot make an offer on your own horse." };
    if (data.amount <= 0) return { success: false, error: "Offer amount must be positive." };

    // Verify horse exists and is tradeable
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, trade_status, custom_name, owner_id")
        .eq("id", data.horseId)
        .single();

    if (!horse) return { success: false, error: "Horse not found." };
    const h = horse as { id: string; trade_status: string; custom_name: string; owner_id: string };
    if (h.owner_id !== data.sellerId) return { success: false, error: "Seller does not own this horse." };
    if (h.trade_status !== "For Sale" && h.trade_status !== "Open to Offers") {
        return { success: false, error: "This horse is not available for offers." };
    }

    // Check for existing active offer by this buyer on this horse
    const admin = getAdminClient();
    const { data: existingOffer } = await admin
        .from("transactions")
        .select("id")
        .eq("horse_id", data.horseId)
        .eq("party_b_id", user.id)
        .in("status", ["offer_made", "pending_payment", "funds_verified"])
        .maybeSingle();

    if (existingOffer) return { success: false, error: "You already have an active offer on this horse." };

    // Create or find conversation
    const { createOrFindConversation } = await import("@/app/actions/messaging");
    const convoResult = await createOrFindConversation(data.sellerId, data.horseId);
    if (!convoResult.success || !convoResult.conversationId) {
        return { success: false, error: convoResult.error || "Failed to create conversation." };
    }

    // Insert transaction with offer_made status
    const { data: txn, error } = await admin
        .from("transactions")
        .insert({
            type: "marketplace_sale",
            status: "offer_made",
            party_a_id: data.sellerId,
            party_b_id: user.id,
            horse_id: data.horseId,
            conversation_id: convoResult.conversationId,
            offer_amount: data.amount,
            offer_message: data.message?.trim() || null,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

    // Get buyer alias for notification
    const { data: buyerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const buyerAlias = (buyerProfile as { alias_name: string } | null)?.alias_name || "Someone";

    // Notify seller
    await createNotification({
        userId: data.sellerId,
        type: "offer",
        actorId: user.id,
        content: `@${buyerAlias} made a $${data.amount.toFixed(2)} offer on ${h.custom_name}`,
        horseId: data.horseId,
        conversationId: convoResult.conversationId,
    });

    revalidatePath(`/inbox/${convoResult.conversationId}`);
    return { success: true, transactionId: (txn as { id: string }).id, conversationId: convoResult.conversationId };
}

// ── Respond to Offer ──
// Seller accepts or declines a buyer's offer
export async function respondToOffer(
    transactionId: string,
    action: "accept" | "decline"
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const admin = getAdminClient();
    const { data: txn } = await admin
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id, offer_amount")
        .eq("id", transactionId)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as { id: string; status: string; party_a_id: string; party_b_id: string; horse_id: string; conversation_id: string; offer_amount: number };

    if (t.party_a_id !== user.id) return { success: false, error: "Only the seller can respond to offers." };
    if (t.status !== "offer_made") return { success: false, error: "This offer is no longer pending." };

    if (action === "decline") {
        await admin.from("transactions").update({ status: "cancelled" }).eq("id", transactionId);

        // Notify buyer
        const { data: sellerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
        const sellerAlias = (sellerProfile as { alias_name: string } | null)?.alias_name || "Seller";
        await createNotification({
            userId: t.party_b_id,
            type: "offer",
            actorId: user.id,
            content: `@${sellerAlias} declined your offer.`,
            conversationId: t.conversation_id,
        });

        revalidatePath(`/inbox/${t.conversation_id}`);
        return { success: true };
    }

    // Accept: update status, lock horse
    await admin.from("transactions").update({
        status: "pending_payment",
        accepted_at: new Date().toISOString(),
    }).eq("id", transactionId);

    // Lock horse trade status
    await admin.from("user_horses").update({ trade_status: "Pending Sale" }).eq("id", t.horse_id);

    // Notify buyer
    const { data: horse } = await supabase.from("user_horses").select("custom_name").eq("id", t.horse_id).single();
    const horseName = (horse as { custom_name: string } | null)?.custom_name || "the horse";
    await createNotification({
        userId: t.party_b_id,
        type: "offer",
        actorId: user.id,
        content: `Your $${t.offer_amount.toFixed(2)} offer on ${horseName} was accepted! Please send payment.`,
        conversationId: t.conversation_id,
    });

    revalidatePath(`/inbox/${t.conversation_id}`);
    revalidatePath(`/community/${t.horse_id}`);
    return { success: true };
}

// ── Mark Payment Sent ──
// Buyer signals they have sent payment
export async function markPaymentSent(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const admin = getAdminClient();
    const { data: txn } = await admin
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id, offer_amount")
        .eq("id", transactionId)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as { id: string; status: string; party_a_id: string; party_b_id: string; horse_id: string; conversation_id: string; offer_amount: number };

    if (t.party_b_id !== user.id) return { success: false, error: "Only the buyer can mark payment as sent." };
    if (t.status !== "pending_payment") return { success: false, error: "This transaction is not awaiting payment." };

    await admin.from("transactions").update({
        paid_at: new Date().toISOString(),
    }).eq("id", transactionId);

    // Notify seller
    const { data: buyerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const buyerAlias = (buyerProfile as { alias_name: string } | null)?.alias_name || "Buyer";
    const { data: horse } = await supabase.from("user_horses").select("custom_name").eq("id", t.horse_id).single();
    const horseName = (horse as { custom_name: string } | null)?.custom_name || "the horse";
    await createNotification({
        userId: t.party_a_id,
        type: "offer",
        actorId: user.id,
        content: `@${buyerAlias} says they've sent $${t.offer_amount.toFixed(2)} for ${horseName}. Please verify.`,
        conversationId: t.conversation_id,
    });

    revalidatePath(`/inbox/${t.conversation_id}`);
    return { success: true };
}

// ── Verify Funds & Release ──
// Seller confirms payment, parks horse, generates claim PIN
export async function verifyFundsAndRelease(
    transactionId: string
): Promise<{ success: boolean; pin?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const admin = getAdminClient();
    const { data: txn } = await admin
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id, paid_at")
        .eq("id", transactionId)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as { id: string; status: string; party_a_id: string; party_b_id: string; horse_id: string; conversation_id: string; paid_at: string | null };

    if (t.party_a_id !== user.id) return { success: false, error: "Only the seller can verify funds." };
    if (t.status !== "pending_payment") return { success: false, error: "This transaction is not awaiting verification." };
    if (!t.paid_at) return { success: false, error: "Buyer has not yet marked payment as sent." };

    // Park horse and generate claim PIN
    const { parkHorse } = await import("@/app/actions/parked-export");
    const parkResult = await parkHorse(t.horse_id);
    if (!parkResult.success || !parkResult.pin) {
        return { success: false, error: parkResult.error || "Failed to generate claim PIN." };
    }

    // Update transaction
    await admin.from("transactions").update({
        status: "funds_verified",
        verified_at: new Date().toISOString(),
        metadata: { pin: parkResult.pin },
    }).eq("id", transactionId);

    // Notify buyer with PIN
    const { data: horse } = await supabase.from("user_horses").select("custom_name").eq("id", t.horse_id).single();
    const horseName = (horse as { custom_name: string } | null)?.custom_name || "the horse";
    await createNotification({
        userId: t.party_b_id,
        type: "offer",
        actorId: user.id,
        content: `Funds verified! Your claim PIN for ${horseName} is ready in the chat.`,
        conversationId: t.conversation_id,
    });

    revalidatePath(`/inbox/${t.conversation_id}`);
    return { success: true, pin: parkResult.pin };
}

