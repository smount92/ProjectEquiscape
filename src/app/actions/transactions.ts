"use server";

import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import type { Database } from "@/lib/types/database.generated";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/app/actions/notifications";
import { createActivityEvent } from "@/app/actions/activity";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import {
    canPerform,
    requirePaidAt,
    type TransactionStatus,
} from "@/lib/commerce/stateMachine";
import {
    conversationIdSchema,
    createTransactionSchema,
    firstZodError,
    leaveReviewSchema,
    makeOfferSchema,
    respondToOfferSchema,
    reviewIdSchema,
    transactionIdSchema,
    userIdSchema,
} from "@/lib/commerce/schemas";

type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

// ============================================================
// UNIVERSAL TRUST ENGINE — Server Actions
// Replaces ratings.ts. Reviews attach to transactions, not conversations.
//
// Every action follows the house pattern (src/app/actions/stable.ts):
//   1. zod-parse the input (src/lib/commerce/schemas.ts),
//   2. requireAuth(),
//   3. party + status guard via src/lib/commerce/stateMachine.ts,
//   4. the pre-existing write logic, unchanged.
// ============================================================

/** Shape of the transaction row the commerce actions read before writing. */
type CommerceTxnRow = {
    id: string;
    status: string;
    party_a_id: string;
    party_b_id: string;
    horse_id: string;
    conversation_id: string;
    offer_amount: number;
    paid_at?: string | null;
};

// ── Create Transaction ──
// Called internally by claim flows. NOT user-facing.
/**
 * Create a transaction record between two parties.
 * Called internally by transfer/claim flows — NOT user-facing, but it IS
 * an exported "use server" action, so it validates and requires that the
 * caller is one of the two parties (true for every internal call site:
 * messaging, parked-export, hoofprint, art-studio).
 * Uses the admin client to bypass RLS (cross-user write).
 * @param data - Transaction data including type, party IDs, and optional horse/commission/conversation IDs
 * @returns The created transaction's UUID
 */
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
    const parsed = createTransactionSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const input = parsed.data;

    const { user } = await requireAuth();
    // Party guard: a caller may only create a transaction they are part of.
    // Every internal flow satisfies this (the claimant/buyer/seller/artist
    // is always party A or B); it blocks direct invocation from forging
    // provenance records between two OTHER users.
    if (user.id !== input.partyAId && user.id !== input.partyBId) {
        return { success: false, error: "You must be a party to the transaction." };
    }

    // Admin client justified: the transactions table has NO INSERT policy
    // (migration 044 defines only txn_select / txn_update), so RLS forbids
    // this insert for every caller — and the row names the OTHER user as
    // counterparty, which is inherently a cross-user write.
    const admin = getAdminClient();

    const insertData: TransactionInsert = {
        type: input.type,
        status: input.status || "completed",
        party_a_id: input.partyAId,
        party_b_id: input.partyBId,
    };
    if (input.horseId) insertData.horse_id = input.horseId;
    if (input.commissionId) insertData.commission_id = input.commissionId;
    if (input.conversationId) insertData.conversation_id = input.conversationId;
    if (input.metadata) insertData.metadata = input.metadata as TransactionInsert["metadata"];
    if (input.status === "completed") insertData.completed_at = new Date().toISOString();

    const { data: row, error } = await admin
        .from("transactions")
        .insert(insertData)
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, transactionId: (row as { id: string }).id };
}

// ── Complete Transaction ──
/**
 * Mark a transaction as completed. Triggers Blue Book price refresh
 * and deferred achievement evaluation.
 * Guarded: caller must be a party; legal only from 'pending' (legacy
 * flow) or 'funds_verified' (Safe-Trade claim flow).
 * @param transactionId - UUID of the transaction to complete
 */
export async function completeTransaction(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const parsedId = transactionIdSchema.safeParse(transactionId);
    if (!parsedId.success) return { success: false, error: firstZodError(parsedId.error) };

    const { supabase, user } = await requireAuth();

    // Party + status guard (user client: txn_select RLS restricts the read
    // to the caller's own transactions, so non-parties get "not found").
    const { data: txn } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id")
        .eq("id", parsedId.data)
        .maybeSingle();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as { id: string; status: string; party_a_id: string; party_b_id: string | null };

    const gate = canPerform("complete_transaction", user.id, {
        status: t.status as TransactionStatus,
        partyAId: t.party_a_id,
        partyBId: t.party_b_id,
    });
    if (!gate.ok) return { success: false, error: gate.reason };

    const { error } = await supabase
        .from("transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", parsedId.data);

    if (error) return { success: false, error: error.message };

    // Immediately refresh Blue Book prices so the sale appears in /market
    try {
        // Admin client justified: refresh_market_prices refreshes the
        // mv_market_prices materialized view — a system-wide maintenance
        // RPC with no user-scoped grant (only SELECT on the view is
        // granted to authenticated, migration 055/067).
        const admin = getAdminClient();
        await admin.rpc("refresh_market_prices");
    } catch (err) {
        // Non-blocking — cron will catch it within 6 hours
        Sentry.captureException(err, { tags: { domain: "commerce" }, level: "warning" });
        logger.warn("completeTransaction", "Market price refresh failed (non-blocking)");
    }

    // Deferred: evaluate commerce achievements
    const completingUserId = user.id;
    after(async () => {
        try {
            const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
            await evaluateUserAchievements(completingUserId, "transaction_completed");
        } catch (err) { Sentry.captureException(err, { tags: { domain: "commerce" } }); logger.error("Commerce", "Background task failed", err); }
    });

    return { success: true };
}

// ── Get Transactions for User ──
/**
 * Get all transactions where the current user is a party (buyer or seller).
 * Includes attached reviews for each transaction.
 * @returns Transactions with camelCase field names and nested reviews
 */
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
    const { supabase, user } = await requireAuth();

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
/**
 * Leave a review on a completed transaction.
 * Enforces one review per user per transaction (DB unique constraint).
 * Guarded: caller must be a party to a COMPLETED transaction, and the
 * target must be the other party (the reviews_insert RLS policy remains
 * the authoritative enforcement; this surfaces readable refusals).
 * Creates a notification and activity event for the reviewed user.
 * @param data - Review data: transactionId, targetId, stars (1-5), optional content
 */
export async function leaveReview(data: {
    transactionId: string;
    targetId: string;
    stars: number;
    content?: string;
}): Promise<{ success: boolean; error?: string }> {
    const parsed = leaveReviewSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const input = parsed.data;

    const { supabase, user } = await requireAuth();

    if (user.id === input.targetId) return { success: false, error: "You cannot review yourself." };

    // Party + status guard (user client: txn_select RLS means non-parties
    // simply don't see the row).
    const { data: txn } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id")
        .eq("id", input.transactionId)
        .maybeSingle();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as { status: string; party_a_id: string; party_b_id: string | null };
    if (t.status !== "completed") {
        return { success: false, error: "You can only review a completed transaction." };
    }
    if (input.targetId !== t.party_a_id && input.targetId !== t.party_b_id) {
        return { success: false, error: "You can only review the other party to this transaction." };
    }

    const { error } = await supabase.from("reviews").insert({
        transaction_id: input.transactionId,
        reviewer_id: user.id,
        target_id: input.targetId,
        stars: input.stars,
        content: input.content?.trim() || null,
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
        userId: input.targetId,
        type: "rating",
        actorId: user.id,
        content: `@${alias} left you a ★${input.stars} review`,
    });
    await createActivityEvent({
        actorId: user.id,
        eventType: "rating",
        metadata: { stars: input.stars, targetAlias: alias },
    });

    return { success: true };
}

// ── Delete Review ──
/**
 * Delete a review the current user has written.
 * The reviews_delete RLS policy scopes the delete to the caller's own
 * reviews (a non-matching id is a silent no-op, preserved behavior).
 * @param reviewId - UUID of the review to delete
 */
export async function deleteReview(
    reviewId: string
): Promise<{ success: boolean; error?: string }> {
    const parsedId = reviewIdSchema.safeParse(reviewId);
    if (!parsedId.success) return { success: false, error: firstZodError(parsedId.error) };

    const { supabase } = await requireAuth();

    const { error } = await supabase.from("reviews").delete().eq("id", parsedId.data);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Get User Review Summary ──
// Replaces getUserRatingSummary(). Reads from reviews table.
/**
 * Get a user's review summary: average stars, count, and individual reviews.
 * Public endpoint — does not require authentication (rendered on public
 * profile pages).
 * @param userId - UUID of the user to get reviews for
 * @returns Average rating, total count, and list of reviews with reviewer aliases
 */
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
    // Return type has no error channel — an invalid id yields the same
    // empty summary a nonexistent user would (preserved behavior).
    const parsedId = userIdSchema.safeParse(userId);
    if (!parsedId.success) return { average: 0, count: 0, ratings: [] };

    const supabase = await createClient();

    const { data: rawReviews } = await supabase
        .from("reviews")
        .select("id, stars, content, created_at, reviewer_id, users!reviewer_id(alias_name)")
        .eq("target_id", parsedId.data)
        .order("created_at", { ascending: false });

    const reviews = rawReviews ?? [];

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
/**
 * Get completed transactions where the current user has NOT yet left a review.
 * Batch-fetches target user aliases and horse names for display.
 * @returns Unreviewed transactions with target alias and horse name
 */
export async function getReviewableTransactions(): Promise<{
    transactionId: string;
    type: string;
    targetId: string;
    targetAlias: string;
    horseName: string | null;
    completedAt: string;
}[]> {
    const { supabase, user } = await requireAuth();

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
    const horseMap = new Map<string, string>();
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
/**
 * Look up the marketplace transaction attached to a DM conversation.
 * Used by the inbox to render the OfferCard with current state.
 * Reads on the caller's client — txn_select RLS scopes results to the
 * caller's own transactions (anonymous/non-party callers get null).
 * @param conversationId - UUID of the DM conversation
 * @returns Full transaction state for OfferCard rendering, or null if none
 */
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
    // Return type has no error channel — an invalid id behaves like a
    // conversation with no transaction (preserved behavior).
    const parsedId = conversationIdSchema.safeParse(conversationId);
    if (!parsedId.success) return null;

    const supabase = await createClient();

    const { data } = await supabase
        .from("transactions")
        .select("id, status, type, offer_amount, offer_message, party_a_id, party_b_id, horse_id, paid_at, verified_at, metadata")
        .eq("conversation_id", parsedId.data)
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
// Status graph + actor rules live in src/lib/commerce/stateMachine.ts.
// ============================================================

// ── Make Offer ──
// Buyer submits an offer on a tradeable horse
/**
 * Buyer makes a purchase offer on a horse.
 * Creates an offer_made transaction and a DM conversation.
 * Validates: horse must be for sale/open to offers, no self-offers,
 * buyer must not be blocked by seller.
 * @param data - Offer data: horseId, sellerId, amount, optional message
 */
export async function makeOffer(data: {
    horseId: string;
    sellerId: string;
    amount: number;
    message?: string;
    isBundle?: boolean;
}): Promise<{ success: boolean; transactionId?: string; conversationId?: string; error?: string }> {
    const parsed = makeOfferSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const input = parsed.data;

    const { supabase, user } = await requireAuth();
    if (user.id === input.sellerId) return { success: false, error: "You cannot make an offer on your own horse." };

    // Pre-fetch horse name for notifications (non-blocking if RPC fails)
    const { data: horse } = await supabase
        .from("user_horses")
        .select("custom_name")
        .eq("id", input.horseId)
        .single();
    const horseName = (horse as { custom_name: string } | null)?.custom_name || "the horse";

    // Create or find conversation (needed before the atomic RPC)
    const { createOrFindConversation } = await import("@/app/actions/messaging");
    const convoResult = await createOrFindConversation(input.sellerId, input.horseId);
    if (!convoResult.success || !convoResult.conversationId) {
        return { success: false, error: convoResult.error || "Failed to create conversation." };
    }

    // Atomic RPC: row-locks horse + checks state + inserts transaction in one
    // Postgres call. Runs on the USER client — make_offer_atomic is SECURITY
    // DEFINER with EXECUTE granted to authenticated (migration 099), so no
    // admin client is needed (downgraded from getAdminClient).
    const { data: rpcResult, error: rpcError } = await supabase.rpc("make_offer_atomic", {
        p_horse_id: input.horseId,
        p_buyer_id: user.id,
        p_seller_id: input.sellerId,
        p_offered_price: input.amount,
        p_conversation_id: convoResult.conversationId,
        p_message: input.message || undefined,
        p_is_bundle: input.isBundle || false,
    });

    if (rpcError) return { success: false, error: rpcError.message };

    const result = rpcResult as { success: boolean; error?: string; transaction_id?: string };
    if (!result.success) return { success: false, error: result.error || "Offer failed." };

    // Get buyer alias for notification
    const { data: buyerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const buyerAlias = (buyerProfile as { alias_name: string } | null)?.alias_name || "Someone";

    // Notify seller
    await createNotification({
        userId: input.sellerId,
        type: "offer",
        actorId: user.id,
        content: `@${buyerAlias} made a $${input.amount.toFixed(2)} offer on ${horseName}`,
        horseId: input.horseId,
        conversationId: convoResult.conversationId,
    });

    revalidatePath(`/inbox/${convoResult.conversationId}`);
    return { success: true, transactionId: result.transaction_id, conversationId: convoResult.conversationId };
}

// ── Respond to Offer ──
// Seller accepts or declines a buyer's offer
/**
 * Seller accepts or declines a buyer's offer.
 * On accept: transitions to pending_payment and notifies buyer.
 * On decline: transitions to cancelled and notifies buyer.
 * Party/status pre-checked via the commerce state machine; the atomic
 * RPC respond_to_offer_atomic remains the authoritative row-locked check.
 * @param transactionId - UUID of the offer_made transaction
 * @param action - "accept" or "decline"
 */
export async function respondToOffer(
    transactionId: string,
    action: "accept" | "decline"
): Promise<{ success: boolean; error?: string }> {
    const parsed = respondToOfferSchema.safeParse({ transactionId, action });
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

    const { supabase, user } = await requireAuth();

    // Read on the user client (downgraded from getAdminClient): txn_select
    // RLS lets the seller read their own transaction; a non-party caller
    // gets "not found" instead of leaking transaction state.
    const { data: txn } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id, offer_amount")
        .eq("id", parsed.data.transactionId)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as CommerceTxnRow;

    // State machine pre-check (defense in depth — the RPC re-validates
    // under a row lock).
    const gate = canPerform(
        parsed.data.action === "accept" ? "accept_offer" : "decline_offer",
        user.id,
        { status: t.status as TransactionStatus, partyAId: t.party_a_id, partyBId: t.party_b_id },
    );
    if (!gate.ok) return { success: false, error: gate.reason };

    // Atomic RPC for the state transition (row-locked in Postgres).
    // USER client (downgraded): respond_to_offer_atomic is SECURITY DEFINER
    // with EXECUTE granted to authenticated (migration 099).
    const { data: rpcResult, error: rpcError } = await supabase.rpc("respond_to_offer_atomic", {
        p_transaction_id: parsed.data.transactionId,
        p_seller_id: user.id,
        p_action: parsed.data.action,
    });

    if (rpcError) return { success: false, error: rpcError.message };
    const result = rpcResult as { success: boolean; error?: string };
    if (!result.success) return { success: false, error: result.error || "Action failed." };

    if (parsed.data.action === "decline") {
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

    // Accept path: lock horse trade status.
    // USER client (downgraded): the seller owns the horse, so the
    // user_horses_update_own RLS policy permits this write.
    await supabase.from("user_horses").update({ trade_status: "Pending Sale" }).eq("id", t.horse_id);

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

    // Auto-cancel all other active offers on this horse.
    // USER client (downgraded): the caller is party_a (seller) of every
    // offer on their own horse, so txn_select/txn_update RLS permits both
    // the read and the status write.
    const { data: otherOffers } = await supabase
        .from("transactions")
        .select("id, party_b_id, conversation_id")
        .eq("horse_id", t.horse_id)
        .eq("status", "offer_made")
        .neq("id", parsed.data.transactionId);

    if (otherOffers && otherOffers.length > 0) {
        for (const other of otherOffers as { id: string; party_b_id: string; conversation_id: string }[]) {
            await supabase.from("transactions").update({ status: "cancelled" }).eq("id", other.id);
            // Notify the losing buyer
            await createNotification({
                userId: other.party_b_id,
                type: "offer",
                actorId: user.id,
                content: `Another offer on ${horseName} was accepted. Your offer has been cancelled.`,
                conversationId: other.conversation_id,
            });
        }
    }

    revalidatePath(`/inbox/${t.conversation_id}`);
    revalidatePath(`/community/${t.horse_id}`);
    return { success: true };
}

// ── Mark Payment Sent ──
// Buyer signals they have sent payment
/**
 * Buyer marks that they have sent payment.
 * Stamps paid_at on the pending_payment transaction (status unchanged —
 * paid_at is the "funds sent" substate the OfferCard renders from).
 * Notifies the seller.
 * @param transactionId - UUID of the pending_payment transaction
 */
export async function markPaymentSent(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const parsedId = transactionIdSchema.safeParse(transactionId);
    if (!parsedId.success) return { success: false, error: firstZodError(parsedId.error) };

    const { supabase, user } = await requireAuth();

    // Read on the user client (downgraded from getAdminClient): the buyer
    // is party_b, so txn_select RLS permits the read.
    const { data: txn } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id, offer_amount")
        .eq("id", parsedId.data)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as CommerceTxnRow;

    const gate = canPerform("mark_payment_sent", user.id, {
        status: t.status as TransactionStatus,
        partyAId: t.party_a_id,
        partyBId: t.party_b_id,
    });
    if (!gate.ok) return { success: false, error: gate.reason };

    // USER client (downgraded): the buyer is a party, so txn_update RLS
    // permits stamping paid_at on their own transaction. Surface write
    // failures — a silent RLS no-op here would notify the seller of a
    // payment the row never recorded (adversarial-review S1).
    const { error: paidError } = await supabase.from("transactions").update({
        paid_at: new Date().toISOString(),
    }).eq("id", parsedId.data);
    if (paidError) return { success: false, error: paidError.message };

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
/**
 * Seller verifies payment received and releases the horse.
 * Transitions from pending_payment (with paid_at stamped) to funds_verified.
 * Parks the horse, generates a claim PIN, and notifies the buyer.
 * @param transactionId - UUID of the pending_payment transaction
 */
export async function verifyFundsAndRelease(
    transactionId: string
): Promise<{ success: boolean; pin?: string; error?: string }> {
    const parsedId = transactionIdSchema.safeParse(transactionId);
    if (!parsedId.success) return { success: false, error: firstZodError(parsedId.error) };

    const { supabase, user } = await requireAuth();

    // Read on the user client (downgraded from getAdminClient): the seller
    // is party_a, so txn_select RLS permits the read.
    const { data: txn } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id, paid_at")
        .eq("id", parsedId.data)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as CommerceTxnRow;

    const gate = canPerform("verify_funds", user.id, {
        status: t.status as TransactionStatus,
        partyAId: t.party_a_id,
        partyBId: t.party_b_id,
    });
    if (!gate.ok) return { success: false, error: gate.reason };

    const paidGate = requirePaidAt(t.paid_at ?? null);
    if (!paidGate.ok) return { success: false, error: paidGate.reason };

    // Park horse and generate claim PIN
    const { parkHorse } = await import("@/app/actions/parked-export");
    const parkResult = await parkHorse(t.horse_id);
    if (!parkResult.success || !parkResult.pin) {
        return { success: false, error: parkResult.error || "Failed to generate claim PIN." };
    }

    // Update transaction.
    // USER client (downgraded): the seller is a party, so txn_update RLS
    // permits the status write. Surface failures — the horse is already
    // parked at this point, and a silent no-op would hand out a PIN while
    // the transaction stays pending_payment (adversarial-review S1; the
    // park-then-update ordering itself is the documented atomicity
    // follow-up requiring a cancel/verify RPC).
    const { error: verifyError } = await supabase.from("transactions").update({
        status: "funds_verified",
        verified_at: new Date().toISOString(),
        metadata: { pin: parkResult.pin },
    }).eq("id", parsedId.data);
    if (verifyError) {
        return {
            success: false,
            error: `Funds verification did not complete (${verifyError.message}). The horse was parked for transfer — cancel the transaction to unpark it, then retry.`,
        };
    }

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

// ── Cancel Transaction ──
// Seller can cancel when buyer ghosts during pending_payment
// Also handles funds_verified (PIN released but not claimed)
/**
 * Cancel an active transaction (seller only).
 * Can only cancel from: offer_made, pending_payment, or funds_verified.
 * Reverts the horse to "Open to Offers" and, if the horse was parked,
 * unparks it and cancels pending claim PINs.
 * @param transactionId - UUID of the transaction to cancel
 */
export async function cancelTransaction(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const parsedId = transactionIdSchema.safeParse(transactionId);
    if (!parsedId.success) return { success: false, error: firstZodError(parsedId.error) };

    const { supabase, user } = await requireAuth();

    // Read on the user client (downgraded from getAdminClient): the seller
    // is party_a, so txn_select RLS permits the read.
    const { data: txn } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id")
        .eq("id", parsedId.data)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as CommerceTxnRow;

    // Only the seller may cancel; legal from offer_made, pending_payment,
    // or funds_verified (state machine encodes the same set the inline
    // check enforced).
    const gate = canPerform("cancel_transaction", user.id, {
        status: t.status as TransactionStatus,
        partyAId: t.party_a_id,
        partyBId: t.party_b_id,
    });
    if (!gate.ok) return { success: false, error: gate.reason };

    // 1. Cancel the transaction.
    // USER client (downgraded): the seller is a party → txn_update RLS.
    const { error: cancelErr } = await supabase.from("transactions").update({ status: "cancelled" }).eq("id", parsedId.data);
    if (cancelErr) return { success: false, error: `Database error: ${cancelErr.message}` };

    // 2. Revert horse trade_status to "Open to Offers".
    // USER client (downgraded): the seller owns the horse → user_horses_update_own RLS.
    await supabase.from("user_horses").update({ trade_status: "Open to Offers" }).eq("id", t.horse_id);

    // 3. If horse was parked (funds_verified state), unpark it
    if (t.status === "funds_verified") {
        await supabase.from("user_horses")
            .update({ life_stage: "completed" })
            .eq("id", t.horse_id)
            .eq("life_stage", "parked");

        // Cancel any pending transfer PINs for this horse.
        // USER client (downgraded): the seller is the transfer sender →
        // "Sender cancels transfer" RLS policy (migration 022).
        await supabase.from("horse_transfers")
            .update({ status: "cancelled" })
            .eq("horse_id", t.horse_id)
            .eq("status", "pending");
    }

    // 4. Notify the buyer
    const { data: sellerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const sellerAlias = (sellerProfile as { alias_name: string } | null)?.alias_name || "Seller";
    await createNotification({
        userId: t.party_b_id,
        type: "offer",
        actorId: user.id,
        content: `@${sellerAlias} cancelled the transaction.`,
        conversationId: t.conversation_id,
    });

    revalidatePath(`/inbox/${t.conversation_id}`);
    return { success: true };
}

/** Buyer retracts their offer while still in offer_made state */
export async function retractOffer(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const parsedId = transactionIdSchema.safeParse(transactionId);
    if (!parsedId.success) return { success: false, error: firstZodError(parsedId.error) };

    const { supabase, user } = await requireAuth();

    // Read on the user client (downgraded from getAdminClient): the buyer
    // is party_b, so txn_select RLS permits the read.
    const { data: txn } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id")
        .eq("id", parsedId.data)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as CommerceTxnRow;

    // Only the buyer (party_b) can retract; only from offer_made.
    const gate = canPerform("retract_offer", user.id, {
        status: t.status as TransactionStatus,
        partyAId: t.party_a_id,
        partyBId: t.party_b_id,
    });
    if (!gate.ok) return { success: false, error: gate.reason };

    // Cancel the transaction.
    // USER client (downgraded): the buyer is a party → txn_update RLS.
    // Surface write failures — a silent no-op would tell the seller the
    // offer was retracted while it stays live (adversarial-review S1).
    const { error: retractError } = await supabase
        .from("transactions")
        .update({ status: "cancelled" })
        .eq("id", parsedId.data);
    if (retractError) return { success: false, error: retractError.message };

    // Notify seller
    const { data: buyerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const buyerAlias = (buyerProfile as { alias_name: string } | null)?.alias_name || "Buyer";
    await createNotification({
        userId: t.party_a_id,
        type: "offer",
        actorId: user.id,
        content: `@${buyerAlias} retracted their offer.`,
        conversationId: t.conversation_id,
    });

    revalidatePath(`/inbox/${t.conversation_id}`);
    return { success: true };
}
