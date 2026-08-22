import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * ONE HORSE, ONE SALE — the guard both accept paths were missing.
 *
 * There are two ways an offer becomes a sale, and until now only one of
 * them tidied up after itself:
 *
 *   · the seller accepting the buyer's ORIGINAL offer
 *     (transactions.ts respondToOffer → respond_to_offer_atomic), which
 *     cancelled the other offers on the horse in an inline loop, and
 *   · either side accepting a COUNTER
 *     (deals.ts respondToCounter → deal_offer_move_atomic), which did
 *     not.
 *
 * Neither one asked whether the horse was still available. The result is
 * a double sell: accept a counter on txn1 (horse → Pending Sale, txn2
 * untouched), then accept txn2 through the original path — its RPC only
 * gates on `status = 'offer_made'`, never on the horse — and two buyers
 * are both in pending_payment for one physical model.
 *
 * This module is the shared answer, so the two paths cannot drift again:
 *
 *   assertHorseAvailable   refuse to accept a horse that is already
 *                          spoken for.
 *   cancelSiblingOffers    close every other standing offer once one
 *                          wins, and tell those buyers why.
 *
 * WHY THE ADMIN CLIENT. Both questions are about rows that belong to
 * OTHER people: transactions RLS (`txn_select`, migration 044) shows a
 * caller only the transactions they are a party to, so a buyer accepting
 * a counter cannot see the rival offer that would make their accept a
 * double sell — the check would pass by blindness. Cancelling those
 * rival offers is likewise a cross-user write. Both are used here only
 * to answer "is this horse still free" and "close the losers", never to
 * return another member's data to the caller.
 *
 * We are still app-layer and unlocked, which is why migration 180 adds
 * the same refusal inside the two row-locked RPCs. This layer gives the
 * seller a sentence; that layer makes the race impossible.
 */

/** Statuses that mean a sale on this horse is already under way. */
export const LIVE_SALE_STATUSES = [
    "pending_payment",
    "funds_verified",
    "completed",
] as const;

/** The trade_status the accept paths stamp on a horse that is spoken for. */
export const PENDING_SALE = "Pending Sale";

export type AvailabilityResult = { ok: true } | { ok: false; reason: string };

/**
 * Is this horse still free to be sold on `transactionId`?
 *
 * Two independent tests, because they fail in different ways: a live
 * sibling TRANSACTION is the authoritative "already sold" (it survives a
 * hand-edited listing), while `trade_status = 'Pending Sale'` catches a
 * lock left by an accept whose transaction row we cannot see. Neither is
 * a status a member can pick — 'Pending Sale' is absent from
 * TRADE_STATUS_OPTIONS (src/lib/forms/registry.ts) and is written only
 * by the accept paths — so refusing on it never blocks an ordinary sale.
 */
export async function assertHorseAvailable(input: {
    horseId: string | null | undefined;
    /** The transaction being accepted — never counts against itself. */
    transactionId: string;
}): Promise<AvailabilityResult> {
    if (!input.horseId) return { ok: true };

    const admin = getAdminClient();

    const { data: rivals, error: rivalError } = await admin
        .from("transactions")
        .select("id")
        .eq("horse_id", input.horseId)
        .in("status", LIVE_SALE_STATUSES as unknown as string[])
        .neq("id", input.transactionId)
        .limit(1);

    if (rivalError) {
        // Fail OPEN on an infrastructure error rather than blocking every
        // accept on the site: the row-locked refusal in migration 180 is
        // the authority, and a legitimate seller must not be stranded by
        // a transient read failure.
        logger.error("Commerce", "Horse availability check failed (allowing accept)", rivalError);
        return { ok: true };
    }

    if (rivals && rivals.length > 0) {
        return {
            ok: false,
            reason:
                "Another sale on this horse is already under way. Cancel that one first if it fell through.",
        };
    }

    const { data: horse } = await admin
        .from("user_horses")
        .select("trade_status")
        .eq("id", input.horseId)
        .maybeSingle();

    const tradeStatus = (horse as { trade_status: string | null } | null)?.trade_status ?? null;
    if (tradeStatus === PENDING_SALE) {
        return {
            ok: false,
            reason:
                "This horse is already marked Pending Sale. Cancel that sale first if it fell through.",
        };
    }

    return { ok: true };
}

/**
 * Close every OTHER standing offer on the horse, and tell those buyers.
 *
 * Best-effort by design: the sale that just succeeded is not unwound
 * because a losing buyer's notification failed. Returns how many offers
 * were closed so the caller can log it.
 */
export async function cancelSiblingOffers(input: {
    horseId: string | null | undefined;
    /** The offer that just won. */
    keepTransactionId: string;
    /** Who accepted — the actor on the resulting notifications. */
    actorId: string;
    /** For the sentence the losing buyer reads. */
    horseName: string;
}): Promise<{ cancelled: number }> {
    if (!input.horseId) return { cancelled: 0 };

    const admin = getAdminClient();

    const { data: others, error } = await admin
        .from("transactions")
        .select("id, party_b_id, conversation_id")
        .eq("horse_id", input.horseId)
        .eq("status", "offer_made")
        .neq("id", input.keepTransactionId);

    if (error) {
        logger.error("Commerce", "Sibling-offer sweep failed", error);
        return { cancelled: 0 };
    }

    const losers = (others ?? []) as {
        id: string;
        party_b_id: string | null;
        conversation_id: string | null;
    }[];
    if (losers.length === 0) return { cancelled: 0 };

    let cancelled = 0;
    for (const other of losers) {
        const { error: cancelError } = await admin
            .from("transactions")
            .update({ status: "cancelled" })
            .eq("id", other.id)
            .eq("status", "offer_made");
        if (cancelError) {
            logger.error("Commerce", "Losing offer could not be cancelled", cancelError);
            continue;
        }
        cancelled += 1;

        if (!other.party_b_id) continue;
        // Dynamic import inside try/catch: createNotification is
        // server-only and a notify failure must never break the sale.
        try {
            const { createNotification } = await import(
                "@/lib/notifications/createNotification"
            );
            await createNotification({
                userId: other.party_b_id,
                type: "offer",
                actorId: input.actorId,
                content: `Another offer on ${input.horseName} was accepted. Your offer has been cancelled.`,
                conversationId: other.conversation_id ?? undefined,
            });
        } catch (err) {
            logger.error("Commerce", "Losing-buyer notification failed", err);
        }
    }

    return { cancelled };
}
