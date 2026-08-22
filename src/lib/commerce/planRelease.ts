import type { SupabaseClient } from "@supabase/supabase-js";

import { coerceInstallments, ledgerSummary } from "@/lib/deals/ledger";
import { dealDb, isMissingSchema } from "@/lib/deals/columnSupport";
import { logger } from "@/lib/logger";

/**
 * THE BRIDGE BETWEEN THE LEDGER AND THE SAFE-TRADE RELEASE.
 *
 * The time-payment ledger (migration 173) and the Safe-Trade transaction
 * kept two separate records of the same money and never spoke:
 *
 *   · `payment_installments` holds N pairs of self-attestations — the
 *     buyer says "sent", the seller says "received".
 *   · `transactions.paid_at` is the single stamp `verifyFundsAndRelease`
 *     requires before it will park the horse and mint a claim PIN.
 *
 * Nothing wrote the second from the first, and the buyer's one-shot
 * "External payment sent" button is hidden as soon as a plan exists
 * (DealStrip.tsx), so a plan confirmed six times out of six dead-ended
 * at "Buyer has not yet marked payment as sent." The headline feature of
 * the deal room could not complete a sale (audit C2).
 *
 * The rule this module encodes: a plan whose every row the SELLER has
 * confirmed as received IS the buyer having paid. Nothing here settles
 * money or authors terms — it copies a conclusion both parties already
 * wrote into the ledger onto the column the release path reads.
 */

/** Every installment on the thread is confirmed received. Null = no plan. */
export async function planFullyConfirmed(
    supabase: SupabaseClient,
    conversationId: string | null | undefined,
): Promise<boolean> {
    if (!conversationId) return false;

    const { data, error } = await dealDb(supabase)
        .from("payment_installments")
        .select("id, seq, amount, due_date, marked_sent_at, confirmed_at, note")
        .eq("conversation_id", conversationId);

    // Pre-173 there is no ledger, so there is no plan to be complete.
    if (error) {
        if (!isMissingSchema(error)) {
            logger.error("Commerce", "Installment read failed", error);
        }
        return false;
    }

    const summary = ledgerSummary(coerceInstallments(data));
    return summary.count > 0 && summary.allConfirmed;
}

/**
 * Stamp `transactions.paid_at` if — and only if — the thread's plan is
 * fully confirmed. Returns the stamp written (or the reason-free null
 * when there was nothing to write).
 *
 * Idempotent: the write is conditioned on `paid_at IS NULL`, so a second
 * caller never moves a stamp that already exists.
 */
export async function stampPaidAtFromLedger(
    supabase: SupabaseClient,
    input: { transactionId: string; conversationId: string | null | undefined },
): Promise<string | null> {
    const complete = await planFullyConfirmed(supabase, input.conversationId);
    if (!complete) return null;
    return stampTransactionPaid(supabase, input.transactionId);
}

/**
 * Write the paid stamp onto a transaction that has none.
 *
 * USER client: both parties are party_a/party_b, so `txn_update`
 * (migration 044) permits the write. A failure is logged, never fatal —
 * the seller's release path re-derives the same answer from the ledger,
 * so a missed stamp costs a query and not a sale.
 */
export async function stampTransactionPaid(
    supabase: SupabaseClient,
    transactionId: string,
): Promise<string | null> {
    const stamp = new Date().toISOString();
    const { error } = await supabase
        .from("transactions")
        .update({ paid_at: stamp })
        .eq("id", transactionId)
        .is("paid_at", null);

    if (error) {
        logger.error("Commerce", "paid_at stamp from ledger failed", error);
        return null;
    }
    return stamp;
}
