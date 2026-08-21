"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sanitizeText } from "@/lib/utils/validation";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
    dealDb,
    getDealColumnSupport,
    isMissingSchema,
} from "@/lib/deals/columnSupport";
import {
    agreedPrice,
    applyAgreement,
    applyEdit,
    boxTitle,
    coerceTerms,
    emptyTerms,
    formatMoney,
    isFullyAgreed,
    withdrawAgreement,
    type DealTerms,
    type TermBox,
} from "@/lib/deals/terms";
import {
    canConfirmReceived,
    canMarkSent,
    coerceInstallments,
    ledgerSummary,
    planMatchesPrice,
    type Installment,
} from "@/lib/deals/ledger";
import {
    inferKind,
    payerParty,
    roleLabel,
    stageForTransaction,
    type DealKind,
    type DealParty,
} from "@/lib/deals/vocabulary";
import type { MessageKind } from "@/lib/deals/transcript";

/**
 * DEAL ROOM — server actions.
 *
 * Rules that hold everywhere in this file, mirroring the studio rebuild
 * (src/app/actions/art-studio.ts) so the two halves of the site behave
 * the same way:
 *
 *   1. WE NEVER HOLD MONEY. Nothing here settles anything. Every
 *      "payment" write is one party's dated statement about money that
 *      moved between the two of them, somewhere else.
 *   2. WE NEVER AUTHOR TERMS. The parties write their own boxes; this
 *      file validates shapes and records confirmations, and refuses to
 *      supply a default for anything they left blank.
 *   3. Every state change writes an ENTRY into the transcript. That is
 *      the whole point of the rebuild: an accepted $300 offer must not
 *      leave a thread reading "hi" / "hi".
 *   4. Every migration-173 column is feature-detected. Until the owner
 *      pastes it, the deal surfaces are hidden and plain chat is
 *      byte-identical to today.
 *   5. Notifications go through createNotification via DYNAMIC import
 *      inside try/catch — it is server-only and must never take an
 *      action down.
 */

type ActionResult = { success: boolean; error?: string };

const NOT_APPLIED =
    "The deal room needs a database update that hasn't been applied yet.";

// ── Shared load ───────────────────────────────────────────────────────

interface LoadedDeal {
    conversationId: string;
    /** Which side of the agreement the caller is on. */
    party: DealParty;
    kind: DealKind | null;
    terms: DealTerms;
    horseId: string | null;
    commissionId: string | null;
    aId: string;
    bId: string;
    otherId: string;
    disputedAt: string | null;
    txn: {
        id: string;
        status: string;
        offerAmount: number | null;
        paidAt: string | null;
        metadata: Record<string, unknown> | null;
    } | null;
}

type LoadResult =
    | { ok: true; deal: LoadedDeal }
    | { ok: false; error: string };

/**
 * One read that answers "who is the caller here, and what is the deal".
 *
 * Party A / party B come from the TRANSACTION when there is one
 * (party_a = seller, party_b = buyer — migration 099), falling back to
 * the conversation's own columns. This is the fix for the header that
 * has been labelling sellers as buyers: buyer_id means "whoever clicked
 * first", and it is never used to decide a role here.
 */
async function loadDeal(
    supabase: SupabaseClient,
    conversationId: string,
    userId: string,
): Promise<LoadResult> {
    const { data: convoRaw, error } = await dealDb(supabase)
        .from("conversations")
        .select("id, buyer_id, seller_id, horse_id, deal_terms, deal_kind, commission_id, disputed_at")
        .eq("id", conversationId)
        .maybeSingle();

    // Pre-173: the deal columns don't exist. Re-read the columns that do
    // so plain-chat callers still get a party answer.
    let convo = convoRaw as Record<string, unknown> | null;
    if (error && isMissingSchema(error)) {
        const { data: legacy } = await supabase
            .from("conversations")
            .select("id, buyer_id, seller_id, horse_id")
            .eq("id", conversationId)
            .maybeSingle();
        convo = legacy as Record<string, unknown> | null;
    } else if (error) {
        return { ok: false, error: error.message };
    }

    if (!convo) return { ok: false, error: "Conversation not found." };

    const buyerId = convo.buyer_id as string;
    const sellerId = convo.seller_id as string;
    if (userId !== buyerId && userId !== sellerId) {
        return { ok: false, error: "You are not part of this conversation." };
    }

    const { data: txnRaw } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, offer_amount, paid_at, metadata")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    const txn = txnRaw as {
        id: string;
        status: string;
        party_a_id: string;
        party_b_id: string | null;
        offer_amount: number | null;
        paid_at: string | null;
        metadata: Record<string, unknown> | null;
    } | null;

    // The transaction is authoritative about who is who; the
    // conversation columns are only the fallback, and only for threads
    // that have no transaction at all.
    const aId = txn?.party_a_id ?? sellerId;
    const bId = txn?.party_b_id ?? buyerId;
    const party: DealParty = userId === aId ? "a" : "b";

    const commissionId = (convo.commission_id as string | null) ?? null;
    const horseId = (convo.horse_id as string | null) ?? null;
    const storedKind = convo.deal_kind as DealKind | null | undefined;
    const kind =
        storedKind ??
        (txn ? inferKind({ commissionId, horseId }) : commissionId ? "commission" : null);

    return {
        ok: true,
        deal: {
            conversationId,
            party,
            kind,
            terms: coerceTerms(convo.deal_terms),
            horseId,
            commissionId,
            aId,
            bId,
            otherId: userId === aId ? bId : aId,
            disputedAt: (convo.disputed_at as string | null) ?? null,
            txn: txn
                ? {
                      id: txn.id,
                      status: txn.status,
                      offerAmount: txn.offer_amount,
                      paidAt: txn.paid_at,
                      metadata: txn.metadata,
                  }
                : null,
        },
    };
}

// ── Writing into the transcript ───────────────────────────────────────

/**
 * Every state change leaves a permanent entry in the thread.
 *
 * `content` carries the same sentence the payload describes, in plain
 * text, for three reasons: the inbox preview reads one column, the
 * pre-173 renderer shows something sensible, and a transcript exported
 * to a payment processor must be readable without our code.
 */
async function writeDealEvent(
    supabase: SupabaseClient,
    conversationId: string,
    senderId: string,
    kind: MessageKind,
    content: string,
    payload: Record<string, unknown>,
): Promise<void> {
    const { error } = await dealDb(supabase)
        .from("messages")
        .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            content,
            kind,
            payload,
            is_read: false,
        });
    if (!error) return;
    if (isMissingSchema(error)) {
        // Pre-173: no kind/payload columns. The sentence still belongs in
        // the thread — that is the whole complaint this rebuild answers —
        // so write it as an ordinary message rather than losing it.
        const { error: fallbackError } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: senderId,
            content,
        });
        if (fallbackError) {
            logger.error("Deals", "Transcript entry failed (pre-173 path)", fallbackError);
        }
        return;
    }
    logger.error("Deals", "Transcript entry failed", error);
}

/** Bell notification, deferred and never fatal. */
function notifyOther(
    userId: string,
    actorId: string,
    conversationId: string,
    content: string,
): void {
    after(async () => {
        try {
            const { createNotification } = await import(
                "@/lib/notifications/createNotification"
            );
            await createNotification({
                userId,
                type: "offer",
                actorId,
                content,
                conversationId,
                linkUrl: `/inbox/${conversationId}`,
            });
        } catch (err) {
            Sentry.captureException(err, { tags: { domain: "deals" }, level: "warning" });
            logger.error("Deals", "Deferred notification failed", err);
        }
    });
}

function revalidateThread(conversationId: string): void {
    revalidatePath(`/inbox/${conversationId}`);
    revalidatePath("/inbox");
}

/** The name the transcript uses for the actor. */
async function aliasOf(supabase: SupabaseClient, userId: string): Promise<string> {
    const { data } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", userId)
        .maybeSingle();
    return (data as { alias_name: string } | null)?.alias_name ?? "Someone";
}

// ══════════════════════════════════════════════════════════════
// THE CONTRACT BOXES
// ══════════════════════════════════════════════════════════════

/**
 * Write (or rewrite) the terms boxes.
 *
 * Either party may edit while the terms are unagreed; any edit clears
 * BOTH confirmations, because agreeing to revision 3 says nothing about
 * revision 4. Once both have confirmed, this refuses — and on a pasted
 * database trg_conversations_guard refuses too, so the promise holds
 * even against a caller that bypasses this action.
 */
export async function proposeTerms(
    conversationId: string,
    boxes: TermBox[],
): Promise<ActionResult & { terms?: DealTerms }> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.conversationDeal) return { success: false, error: NOT_APPLIED };

    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const deal = loaded.deal;

    if (deal.disputedAt) {
        return {
            success: false,
            error: "This deal is disputed. The record is frozen so it can be used as evidence.",
        };
    }

    // Cheap throttle — terms are cheap to write and expensive to notify.
    const allowed = await checkRateLimit(`deal_terms:${user.id}`, 30, 10, user.id);
    if (!allowed) {
        return { success: false, error: "Slow down a moment — try again in a few minutes." };
    }

    const edit = applyEdit(deal.terms, boxes, deal.party);
    if (!edit.ok) return { success: false, error: edit.reason };

    const { error } = await dealDb(supabase)
        .from("conversations")
        .update({
            deal_terms: edit.terms,
            ...(deal.kind ? { deal_kind: deal.kind } : {}),
        })
        .eq("id", conversationId);
    if (error) return { success: false, error: error.message };

    const alias = await aliasOf(supabase, user.id);
    const titles = edit.terms.boxes.map(boxTitle);
    await writeDealEvent(
        supabase,
        conversationId,
        user.id,
        "terms_proposed",
        `@${alias} wrote the terms — ${titles.join(", ") || "no boxes"}`,
        {
            revision: edit.terms.revision,
            boxTitles: titles,
            agreedPrice: agreedPrice(edit.terms),
        },
    );

    notifyOther(
        deal.otherId,
        user.id,
        conversationId,
        `@${alias} updated the terms of your deal — take a look`,
    );
    revalidateThread(conversationId);
    return { success: true, terms: edit.terms };
}

/**
 * Confirm the current revision as your side.
 *
 * When this completes the pair, the agreed price is stamped onto the
 * transaction's metadata so the deal strip, the Blue Book and the vault
 * hand-off all read the same number.
 */
export async function agreeToTerms(
    conversationId: string,
): Promise<ActionResult & { fullyAgreed?: boolean }> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.conversationDeal) return { success: false, error: NOT_APPLIED };

    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const deal = loaded.deal;

    if (deal.disputedAt) {
        return { success: false, error: "This deal is disputed — the terms are frozen." };
    }
    if (isFullyAgreed(deal.terms)) {
        return { success: false, error: "Both sides have already agreed these terms." };
    }

    const applied = applyAgreement(deal.terms, deal.party);
    if (!applied.ok) return { success: false, error: applied.reason };

    const { error } = await dealDb(supabase)
        .from("conversations")
        .update({ deal_terms: applied.terms })
        .eq("id", conversationId);
    if (error) return { success: false, error: error.message };

    const alias = await aliasOf(supabase, user.id);
    const price = agreedPrice(applied.terms);
    const complete = isFullyAgreed(applied.terms);

    await writeDealEvent(
        supabase,
        conversationId,
        user.id,
        "terms_agreed",
        complete
            ? `@${alias} agreed to the terms — both sides are now agreed${
                  price !== null ? ` at ${formatMoney(price)}` : ""
              }`
            : `@${alias} agreed to the terms — waiting on the other side`,
        { revision: applied.terms.revision, agreedPrice: price, complete },
    );

    // Stamp the agreed price where the rest of the commerce stack reads
    // it. metadata rather than offer_amount: offer_amount is what was
    // OFFERED and the record should keep both numbers.
    if (complete && price !== null && deal.txn) {
        const merged = { ...(deal.txn.metadata ?? {}), agreed_price: price };
        const { error: stampError } = await supabase
            .from("transactions")
            .update({ metadata: merged })
            .eq("id", deal.txn.id);
        if (stampError) {
            logger.warn("Deals", `Agreed-price stamp failed: ${stampError.message}`);
        }
    }

    notifyOther(
        deal.otherId,
        user.id,
        conversationId,
        complete
            ? `Your deal terms are agreed by both sides${price !== null ? ` at ${formatMoney(price)}` : ""}`
            : `@${alias} agreed to the terms — your confirmation is the last one needed`,
    );
    revalidateThread(conversationId);
    return { success: true, fullyAgreed: complete };
}

/** Take your own confirmation back while the other side is still deciding. */
export async function withdrawTermsAgreement(
    conversationId: string,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.conversationDeal) return { success: false, error: NOT_APPLIED };

    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const deal = loaded.deal;

    const applied = withdrawAgreement(deal.terms, deal.party);
    if (!applied.ok) return { success: false, error: applied.reason };

    const { error } = await dealDb(supabase)
        .from("conversations")
        .update({ deal_terms: applied.terms })
        .eq("id", conversationId);
    if (error) return { success: false, error: error.message };

    revalidateThread(conversationId);
    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// THE PAYMENT LEDGER
// ══════════════════════════════════════════════════════════════

/**
 * Write the installment rows.
 *
 * Replaces the whole plan, which is only possible while no row has been
 * marked or confirmed — a plan with money already moving against it is
 * part of the record. The amounts and dates are the parties'; this
 * checks arithmetic and nothing else.
 */
export async function savePaymentPlan(
    conversationId: string,
    rows: { amount: number; dueDate: string | null; note?: string | null }[],
): Promise<ActionResult & { count?: number }> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.installments) return { success: false, error: NOT_APPLIED };

    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const deal = loaded.deal;

    if (deal.disputedAt) {
        return { success: false, error: "This deal is disputed — the ledger is frozen." };
    }
    if (rows.length === 0) return { success: false, error: "A plan needs at least one payment." };
    if (rows.length > 120) return { success: false, error: "A plan can hold at most 120 payments." };

    for (const row of rows) {
        if (!Number.isFinite(row.amount) || row.amount < 0) {
            return { success: false, error: "Every payment needs a valid amount." };
        }
        if (row.amount > 1_000_000) {
            return { success: false, error: "That payment amount looks wrong." };
        }
    }

    const existing = await loadInstallments(supabase, conversationId);
    const touched = existing.find((r) => r.markedSentAt || r.confirmedAt);
    if (touched) {
        return {
            success: false,
            error: `Payment ${touched.seq} has already been marked — the plan can't be rewritten now.`,
        };
    }

    // A plan that doesn't add up to the agreed price is a disagreement
    // waiting to happen. Refuse rather than record a contradiction.
    const price = agreedPrice(deal.terms);
    if (!planMatchesPrice(rows, price)) {
        return {
            success: false,
            error: `Those payments add up to ${formatMoney(
                rows.reduce((s, r) => s + r.amount, 0),
            )}, but the agreed price is ${formatMoney(price)}.`,
        };
    }

    if (existing.length > 0) {
        const { error: delError } = await dealDb(supabase)
            .from("payment_installments")
            .delete()
            .eq("conversation_id", conversationId);
        if (delError) return { success: false, error: delError.message };
    }

    const inserts = rows.map((row, i) => ({
        conversation_id: conversationId,
        transaction_id: deal.txn?.id ?? null,
        seq: i + 1,
        amount: Math.round(row.amount * 100) / 100,
        due_date: row.dueDate,
        note: row.note ? sanitizeText(row.note).slice(0, 500) : null,
    }));

    const { error } = await dealDb(supabase).from("payment_installments").insert(inserts);
    if (error) return { success: false, error: error.message };

    const alias = await aliasOf(supabase, user.id);
    const total = inserts.reduce((s, r) => s + r.amount, 0);
    const withDates = inserts.filter((r) => r.due_date);
    await writeDealEvent(
        supabase,
        conversationId,
        user.id,
        "plan_created",
        `@${alias} set a payment plan — ${inserts.length} payments totalling ${formatMoney(total)}`,
        {
            installmentCount: inserts.length,
            total,
            firstDueDate: withDates[0]?.due_date ?? null,
            lastDueDate: withDates[withDates.length - 1]?.due_date ?? null,
        },
    );

    notifyOther(
        deal.otherId,
        user.id,
        conversationId,
        `@${alias} set a ${inserts.length}-payment plan on your deal`,
    );
    revalidateThread(conversationId);
    return { success: true, count: inserts.length };
}

async function loadInstallments(
    supabase: SupabaseClient,
    conversationId: string,
): Promise<Installment[]> {
    const { data, error } = await dealDb(supabase)
        .from("payment_installments")
        .select("id, seq, amount, due_date, marked_sent_at, confirmed_at, note")
        .eq("conversation_id", conversationId)
        .order("seq", { ascending: true });
    if (error) return [];
    return coerceInstallments(data);
}

/**
 * Which party owes the money. From the deal kind where the kind decides
 * it, and otherwise unanswerable — a trade may involve no money at all,
 * and only the parties' own terms can say who is paying.
 */
function resolvePayer(deal: LoadedDeal): DealParty | null {
    if (deal.kind) {
        const p = payerParty(deal.kind);
        if (p) return p;
    }
    // A thread carrying a Safe-Trade transaction always has a buyer.
    if (deal.txn) return "b";
    return null;
}

/** The buyer says the money left. A statement with a date, nothing more. */
export async function markInstallmentSent(
    installmentId: string,
    input?: { onDate?: string | null; note?: string | null },
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.installments) return { success: false, error: NOT_APPLIED };

    const row = await loadOneInstallment(supabase, installmentId);
    if (!row) return { success: false, error: "Payment not found." };

    const loaded = await loadDeal(supabase, row.conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const deal = loaded.deal;
    if (deal.disputedAt) {
        return { success: false, error: "This deal is disputed — the ledger is frozen." };
    }

    const gate = canMarkSent(row.installment, deal.party, resolvePayer(deal));
    if (!gate.ok) return { success: false, error: gate.reason };

    const stamp = stampFor(input?.onDate);
    const { error } = await dealDb(supabase)
        .from("payment_installments")
        .update({
            marked_sent_at: stamp,
            marked_sent_by: user.id,
            ...(input?.note ? { note: sanitizeText(input.note).slice(0, 500) } : {}),
        })
        .eq("id", installmentId);
    if (error) return { success: false, error: error.message };

    const alias = await aliasOf(supabase, user.id);
    await writeDealEvent(
        supabase,
        row.conversationId,
        user.id,
        "payment_sent",
        `@${alias} marked payment ${row.installment.seq} as sent — ${formatMoney(
            row.installment.amount,
        )}`,
        {
            seq: row.installment.seq,
            amount: row.installment.amount,
            onDate: stamp.slice(0, 10),
            note: input?.note ?? null,
        },
    );

    notifyOther(
        deal.otherId,
        user.id,
        row.conversationId,
        `@${alias} says payment ${row.installment.seq} (${formatMoney(
            row.installment.amount,
        )}) has been sent — confirm when it arrives`,
    );
    revalidateThread(row.conversationId);
    return { success: true };
}

/** The seller says the money arrived. This is the receipt, and it is final. */
export async function confirmInstallmentReceived(
    installmentId: string,
    input?: { onDate?: string | null },
): Promise<ActionResult & { allConfirmed?: boolean }> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.installments) return { success: false, error: NOT_APPLIED };

    const row = await loadOneInstallment(supabase, installmentId);
    if (!row) return { success: false, error: "Payment not found." };

    const loaded = await loadDeal(supabase, row.conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const deal = loaded.deal;
    if (deal.disputedAt) {
        return { success: false, error: "This deal is disputed — the ledger is frozen." };
    }

    const gate = canConfirmReceived(row.installment, deal.party, resolvePayer(deal));
    if (!gate.ok) return { success: false, error: gate.reason };

    const stamp = stampFor(input?.onDate);
    const { error } = await dealDb(supabase)
        .from("payment_installments")
        .update({ confirmed_at: stamp, confirmed_by: user.id })
        .eq("id", installmentId);
    if (error) return { success: false, error: error.message };

    const remainingRows = await loadInstallments(supabase, row.conversationId);
    const summary = ledgerSummary(remainingRows);
    const alias = await aliasOf(supabase, user.id);

    await writeDealEvent(
        supabase,
        row.conversationId,
        user.id,
        "payment_confirmed",
        `@${alias} confirmed payment ${row.installment.seq} received — ${formatMoney(
            row.installment.amount,
        )}`,
        {
            seq: row.installment.seq,
            amount: row.installment.amount,
            onDate: stamp.slice(0, 10),
            remaining: summary.remaining,
        },
    );

    notifyOther(
        deal.otherId,
        user.id,
        row.conversationId,
        summary.allConfirmed
            ? `Payment ${row.installment.seq} confirmed — the plan is paid in full`
            : `Payment ${row.installment.seq} confirmed · ${formatMoney(
                  summary.remaining,
              )} still outstanding`,
    );
    revalidateThread(row.conversationId);
    return { success: true, allConfirmed: summary.allConfirmed };
}

async function loadOneInstallment(
    supabase: SupabaseClient,
    installmentId: string,
): Promise<{ conversationId: string; installment: Installment } | null> {
    const { data, error } = await dealDb(supabase)
        .from("payment_installments")
        .select("id, conversation_id, seq, amount, due_date, marked_sent_at, confirmed_at, note")
        .eq("id", installmentId)
        .maybeSingle();
    if (error || !data) return null;
    const rows = coerceInstallments([data]);
    if (rows.length === 0) return null;
    return {
        conversationId: (data as { conversation_id: string }).conversation_id,
        installment: rows[0],
    };
}

/**
 * A party may state the date the money actually moved, which is often
 * not the date they got round to clicking. The stamp is clamped to now
 * so nobody can post-date a payment into the future.
 */
function stampFor(onDate: string | null | undefined): string {
    const now = new Date();
    if (!onDate) return now.toISOString();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(onDate.trim());
    if (!m) return now.toISOString();
    const d = new Date(`${onDate.trim()}T12:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime()) return now.toISOString();
    return d.toISOString();
}

// ══════════════════════════════════════════════════════════════
// COUNTER-OFFERS
// ══════════════════════════════════════════════════════════════

/**
 * Counter the offer on the table.
 *
 * Today the seller can only accept or decline — "$300?" "no." — and the
 * deal dies there. Either party may counter while the offer stands; the
 * side whose number is standing cannot counter themselves.
 */
export async function counterOffer(
    transactionId: string,
    amount: number,
    message?: string,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: "Offer amount must be positive." };
    }
    if (amount > 1_000_000) {
        return { success: false, error: "That offer amount looks wrong." };
    }

    const allowed = await checkRateLimit(`deal_counter:${user.id}`, 20, 60, user.id);
    if (!allowed) {
        return { success: false, error: "Too many counter-offers. Try again in a little while." };
    }

    const { data: txnRaw } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, conversation_id, offer_amount, metadata")
        .eq("id", transactionId)
        .maybeSingle();
    const txn = txnRaw as {
        id: string;
        status: string;
        party_a_id: string;
        party_b_id: string | null;
        conversation_id: string | null;
        offer_amount: number | null;
        metadata: Record<string, unknown> | null;
    } | null;
    if (!txn) return { success: false, error: "Transaction not found." };
    if (!txn.conversation_id) return { success: false, error: "This deal has no thread." };

    const { data: rpcResult, error: rpcError } = await dealDb(supabase).rpc("deal_offer_move_atomic", {
        p_transaction_id: transactionId,
        p_actor_id: user.id,
        p_move: "counter",
        p_amount: amount,
        p_message: message?.trim() ? sanitizeText(message).slice(0, 500) : null,
    });
    if (rpcError) {
        if (isMissingSchema(rpcError) || rpcError.code === "42883" || rpcError.code === "PGRST202") {
            return { success: false, error: NOT_APPLIED };
        }
        return { success: false, error: rpcError.message };
    }
    const result = rpcResult as { success: boolean; error?: string };
    if (!result?.success) return { success: false, error: result?.error ?? "Counter failed." };

    const alias = await aliasOf(supabase, user.id);
    const otherId = user.id === txn.party_a_id ? txn.party_b_id : txn.party_a_id;

    await writeDealEvent(
        supabase,
        txn.conversation_id,
        user.id,
        "counter_offer",
        `@${alias} countered at ${formatMoney(amount)}`,
        {
            amount,
            previousAmount: txn.offer_amount,
            note: message?.trim() || null,
            transactionId,
        },
    );

    if (otherId) {
        notifyOther(
            otherId,
            user.id,
            txn.conversation_id,
            `@${alias} countered at ${formatMoney(amount)}`,
        );
    }
    revalidateThread(txn.conversation_id);
    return { success: true };
}

/**
 * Accept or decline a counter that is standing against you.
 *
 * The seller's plain accept/decline of the buyer's ORIGINAL offer still
 * goes through respondToOffer / respond_to_offer_atomic, which was only
 * just repaired in migration 172 and is left alone.
 */
export async function respondToCounter(
    transactionId: string,
    action: "accept" | "decline",
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const { data: txnRaw } = await supabase
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, conversation_id, horse_id, offer_amount")
        .eq("id", transactionId)
        .maybeSingle();
    const txn = txnRaw as {
        id: string;
        status: string;
        party_a_id: string;
        party_b_id: string | null;
        conversation_id: string | null;
        horse_id: string | null;
        offer_amount: number | null;
    } | null;
    if (!txn) return { success: false, error: "Transaction not found." };
    if (!txn.conversation_id) return { success: false, error: "This deal has no thread." };

    const { data: rpcResult, error: rpcError } = await dealDb(supabase).rpc("deal_offer_move_atomic", {
        p_transaction_id: transactionId,
        p_actor_id: user.id,
        p_move: action,
        p_amount: null,
        p_message: null,
    });
    if (rpcError) {
        if (isMissingSchema(rpcError) || rpcError.code === "42883" || rpcError.code === "PGRST202") {
            return { success: false, error: NOT_APPLIED };
        }
        return { success: false, error: rpcError.message };
    }
    const result = rpcResult as { success: boolean; error?: string };
    if (!result?.success) return { success: false, error: result?.error ?? "Action failed." };

    const alias = await aliasOf(supabase, user.id);
    const otherId = user.id === txn.party_a_id ? txn.party_b_id : txn.party_a_id;

    await writeDealEvent(
        supabase,
        txn.conversation_id,
        user.id,
        "offer_response",
        action === "accept"
            ? `@${alias} accepted the ${formatMoney(txn.offer_amount)} counter-offer`
            : `@${alias} declined the ${formatMoney(txn.offer_amount)} counter-offer`,
        { action, amount: txn.offer_amount },
    );

    // Accepting locks the horse, exactly as the seller's accept path does.
    // Logged rather than fatal on a pre-172 database, matching that path.
    if (action === "accept" && txn.horse_id) {
        const { error: lockError } = await supabase
            .from("user_horses")
            .update({ trade_status: "Pending Sale" })
            .eq("id", txn.horse_id);
        if (lockError) {
            logger.error(
                "Deals",
                "Pending Sale lock failed (migration 172 not applied?) — horse stays listed",
                lockError,
            );
        }
    }

    if (otherId) {
        notifyOther(
            otherId,
            user.id,
            txn.conversation_id,
            action === "accept"
                ? `@${alias} accepted your ${formatMoney(txn.offer_amount)} counter-offer`
                : `@${alias} declined your counter-offer`,
        );
    }
    revalidateThread(txn.conversation_id);
    if (txn.horse_id) revalidatePath(`/community/${txn.horse_id}`);
    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// DISPUTES — we freeze and preserve; we do not judge
// ══════════════════════════════════════════════════════════════

/**
 * Say this deal went wrong.
 *
 * Model Horse Hub takes no position on who is right. What raising a
 * dispute DOES: stamps the record, freezes the terms and the ledger so
 * neither side can edit history, and unlocks the evidence pack for
 * export. Both parties keep every other right they had, including
 * leaving a review.
 */
export async function raiseDispute(
    conversationId: string,
    reason: string,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.conversationDeal) return { success: false, error: NOT_APPLIED };

    const trimmed = reason?.trim() ?? "";
    if (trimmed.length < 10) {
        return {
            success: false,
            error: "Say what went wrong in a sentence or two — this becomes part of the record.",
        };
    }

    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const deal = loaded.deal;
    if (deal.disputedAt) {
        return { success: false, error: "This deal is already marked as disputed." };
    }

    const { error } = await dealDb(supabase)
        .from("conversations")
        .update({
            disputed_at: new Date().toISOString(),
            dispute_reason: sanitizeText(trimmed).slice(0, 2000),
            disputed_by: user.id,
        })
        .eq("id", conversationId);
    if (error) return { success: false, error: error.message };

    const alias = await aliasOf(supabase, user.id);
    await writeDealEvent(
        supabase,
        conversationId,
        user.id,
        "dispute",
        `@${alias} raised a dispute — this record is now frozen`,
        { reason: sanitizeText(trimmed).slice(0, 2000), resolved: false },
    );

    notifyOther(
        deal.otherId,
        user.id,
        conversationId,
        `@${alias} raised a dispute on your deal — the record has been frozen`,
    );
    revalidateThread(conversationId);
    return { success: true };
}

/** Stand the dispute down. Only the person who raised it may. */
export async function standDownDispute(
    conversationId: string,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.conversationDeal) return { success: false, error: NOT_APPLIED };

    const { data: convo } = await dealDb(supabase)
        .from("conversations")
        .select("id, buyer_id, seller_id, disputed_at, disputed_by")
        .eq("id", conversationId)
        .maybeSingle();
    const c = convo as {
        buyer_id: string;
        seller_id: string;
        disputed_at: string | null;
        disputed_by: string | null;
    } | null;
    if (!c) return { success: false, error: "Conversation not found." };
    if (user.id !== c.buyer_id && user.id !== c.seller_id) {
        return { success: false, error: "You are not part of this conversation." };
    }
    if (!c.disputed_at) return { success: false, error: "This deal isn't disputed." };
    if (c.disputed_by && c.disputed_by !== user.id) {
        return {
            success: false,
            error: "Only the person who raised the dispute can stand it down.",
        };
    }

    const { error } = await dealDb(supabase)
        .from("conversations")
        .update({ disputed_at: null, disputed_by: null })
        .eq("id", conversationId);
    if (error) return { success: false, error: error.message };

    const alias = await aliasOf(supabase, user.id);
    await writeDealEvent(
        supabase,
        conversationId,
        user.id,
        "dispute",
        `@${alias} stood the dispute down`,
        { resolved: true },
    );

    revalidateThread(conversationId);
    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// THE VAULT HAND-OFF
// ══════════════════════════════════════════════════════════════

/**
 * File what this horse cost into the BUYER's private vault.
 *
 * Mirrors recordCommissionInVault in the studio, deliberately: same
 * moment (they know the number and care about it now — asking later
 * means they never do it), same one-click shape, same owner-only write.
 * The difference is the column: a purchase lands in `purchase_price`,
 * because that is exactly what it is. The studio's `commission_cost`
 * exists so "what I paid to acquire it" and "what I have invested in
 * having it painted" stay separate numbers; this is the first kind.
 *
 * Only the buyer, only for a horse they now own, and only once.
 */
export async function recordSaleInVault(
    conversationId: string,
): Promise<ActionResult & { amount?: number }> {
    const { supabase, user } = await requireAuth();

    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const deal = loaded.deal;

    if (deal.party !== "b") {
        return { success: false, error: "Only the buyer files a purchase into their vault." };
    }
    if (!deal.horseId) {
        return { success: false, error: "This deal has no horse attached." };
    }
    if (!deal.txn || deal.txn.status !== "completed") {
        return { success: false, error: "Wait until the sale is complete." };
    }

    const meta = deal.txn.metadata ?? {};
    if (meta.vault_recorded_at) {
        return { success: false, error: "This purchase is already in the horse's vault." };
    }

    const price =
        agreedPrice(deal.terms) ??
        (typeof meta.agreed_price === "number" ? (meta.agreed_price as number) : null) ??
        deal.txn.offerAmount;
    if (price == null || !(price > 0)) {
        return { success: false, error: "This deal has no agreed price to record." };
    }

    // The vault is owner-only at the database. Confirm ownership here too
    // so the failure is a sentence rather than a silent zero-row update.
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", deal.horseId)
        .eq("owner_id", user.id)
        .maybeSingle();
    if (!horse) {
        return {
            success: false,
            error: "Claim the horse into your stable first — the vault is the owner's record.",
        };
    }

    const { data: vaultRow } = await supabase
        .from("financial_vault")
        .select("*")
        .eq("horse_id", deal.horseId)
        .maybeSingle();
    const existing = vaultRow as Record<string, unknown> | null;

    // Never overwrite a number the owner typed themselves.
    const currentPrice = existing?.purchase_price;
    if (typeof currentPrice === "number" && currentPrice > 0) {
        return {
            success: false,
            error: `This horse's vault already records a purchase price of ${formatMoney(
                currentPrice,
            )}.`,
        };
    }

    const patch = {
        purchase_price: Math.round(price * 100) / 100,
        purchase_date: new Date().toISOString().slice(0, 10),
    };

    let writeError: { message: string } | null = null;
    if (existing) {
        const { error } = await supabase
            .from("financial_vault")
            .update(patch as never)
            .eq("horse_id", deal.horseId);
        writeError = error;
    } else {
        const { error } = await supabase
            .from("financial_vault")
            .insert({ horse_id: deal.horseId, ...patch } as never);
        writeError = error;
    }
    if (writeError) return { success: false, error: writeError.message };

    // Stamp it so the offer stops appearing and cannot double-count.
    await supabase
        .from("transactions")
        .update({ metadata: { ...meta, vault_recorded_at: new Date().toISOString() } })
        .eq("id", deal.txn.id);

    revalidateThread(conversationId);
    revalidatePath(`/stable/${deal.horseId}`);
    return { success: true, amount: patch.purchase_price };
}

// ══════════════════════════════════════════════════════════════
// THREAD STATE — read, mute, archive
// ══════════════════════════════════════════════════════════════

/**
 * Mark the thread read up to now.
 *
 * Read state has been a side effect of RENDERING a page since 2024,
 * computed three different ways in three places, with a header badge
 * that stayed stale for up to thirty seconds. One row, one column, one
 * source of truth.
 */
export async function markThreadRead(conversationId: string): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (support.participants) {
        const now = new Date().toISOString();
        const { error } = await dealDb(supabase)
            .from("conversation_participants")
            .update({ last_read_at: now })
            .eq("conversation_id", conversationId)
            .eq("user_id", user.id);
        if (error && !isMissingSchema(error)) {
            return { success: false, error: error.message };
        }
        // A thread the caller was never enrolled in (pre-173 row created
        // after the backfill ran) — enrol them now, best effort.
        await dealDb(supabase)
            .from("conversation_participants")
            .upsert(
                { conversation_id: conversationId, user_id: user.id, last_read_at: now },
                { onConflict: "conversation_id,user_id" },
            );
    }

    // Keep the legacy boolean in step so a rollback loses nothing and the
    // pre-173 header badge stays correct.
    await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .eq("is_read", false);

    return { success: true };
}

export async function setThreadMuted(
    conversationId: string,
    muted: boolean,
): Promise<ActionResult> {
    return setThreadFlag(conversationId, { muted });
}

export async function setThreadArchived(
    conversationId: string,
    archived: boolean,
): Promise<ActionResult> {
    return setThreadFlag(conversationId, { archived });
}

async function setThreadFlag(
    conversationId: string,
    patch: { muted?: boolean; archived?: boolean },
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.participants) return { success: false, error: NOT_APPLIED };

    const { error } = await dealDb(supabase)
        .from("conversation_participants")
        .upsert(
            { conversation_id: conversationId, user_id: user.id, ...patch },
            { onConflict: "conversation_id,user_id" },
        );
    if (error) return { success: false, error: error.message };

    revalidatePath("/inbox");
    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// SUBJECT CONTEXT
// ══════════════════════════════════════════════════════════════

/**
 * Point a thread at a commission, so a studio job and its conversation
 * are one deal rather than two records that never meet.
 *
 * The studio pipeline is NOT rebuilt here — it keeps its own statuses,
 * its terms_snapshot and its commission_updates. This only teaches the
 * thread which commission it is about, so the deal room can render the
 * same agreement vocabulary over it.
 */
export async function attachCommissionToThread(
    conversationId: string,
    commissionId: string,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.conversationDeal) return { success: false, error: NOT_APPLIED };

    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };

    // The caller must be a party to BOTH — otherwise a thread could be
    // pointed at someone else's commission to read its terms.
    const { data: commission } = await supabase
        .from("commissions")
        .select("id, artist_id, client_id")
        .eq("id", commissionId)
        .maybeSingle();
    const c = commission as { artist_id: string; client_id: string | null } | null;
    if (!c) return { success: false, error: "Commission not found." };
    if (user.id !== c.artist_id && user.id !== c.client_id) {
        return { success: false, error: "You are not part of that commission." };
    }

    const { error } = await dealDb(supabase)
        .from("conversations")
        .update({ commission_id: commissionId, deal_kind: "commission" })
        .eq("id", conversationId);
    if (error) return { success: false, error: error.message };

    revalidateThread(conversationId);
    return { success: true };
}

/**
 * The stage sentence for a thread, so surfaces outside the inbox (the
 * dashboard's "sales needing attention" panel) can speak the vocabulary
 * without duplicating the mapping.
 */
export async function getDealStage(
    conversationId: string,
): Promise<{ stage: string; role: string } | null> {
    const { supabase, user } = await requireAuth();
    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return null;
    const deal = loaded.deal;

    const stage = deal.disputedAt
        ? "disputed"
        : deal.txn
          ? stageForTransaction({ status: deal.txn.status, paidAt: deal.txn.paidAt })
          : "talking";

    return {
        stage,
        role: deal.kind ? roleLabel(deal.kind, deal.party) : "Member",
    };
}

/** Exposed so the thread can start from a clean document. */
export async function clearTerms(conversationId: string): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const support = await getDealColumnSupport(supabase);
    if (!support.conversationDeal) return { success: false, error: NOT_APPLIED };

    const loaded = await loadDeal(supabase, conversationId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    if (isFullyAgreed(loaded.deal.terms)) {
        return { success: false, error: "Agreed terms are part of the record and cannot be cleared." };
    }

    const { error } = await dealDb(supabase)
        .from("conversations")
        .update({ deal_terms: emptyTerms() })
        .eq("id", conversationId);
    if (error) return { success: false, error: error.message };

    revalidateThread(conversationId);
    return { success: true };
}
