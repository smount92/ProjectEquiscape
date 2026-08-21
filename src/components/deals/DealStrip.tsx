"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
    respondToOffer,
    markPaymentSent,
    verifyFundsAndRelease,
    cancelTransaction,
    retractOffer,
} from "@/app/actions/transactions";
import { counterOffer, respondToCounter } from "@/app/actions/deals";
import { formatMoney } from "@/lib/deals/terms";
import { stageLabel, type DealKind, type DealParty, type DealStage } from "@/lib/deals/vocabulary";

/**
 * THE DEAL STRIP — the current state in one line, with the one action
 * available now.
 *
 * This replaces OfferCard, which sat above the thread and left no trace
 * inside it. Two behaviours change beyond the move:
 *
 *  · Every action here writes a permanent entry into the transcript
 *    (the server actions do it), so the record and the conversation stop
 *    being two different stories.
 *  · Cancelled and declined stop looking identical. OfferCard rendered
 *    every terminal state as "❌ Offer Declined", including a sale the
 *    seller cancelled and one the cron timed out.
 */

interface DealStripProps {
    conversationId: string;
    transaction: {
        id: string;
        status: string;
        offerAmount: number | null;
        offerMessage: string | null;
        paidAt: string | null;
        verifiedAt: string | null;
        offerFrom: DealParty;
        pin: string | null;
    };
    party: DealParty;
    kind: DealKind | null;
    stage: DealStage;
    /** True once the ledger says every installment is confirmed. */
    planComplete: boolean;
    /** A plan exists, so the single "payment sent" button is the wrong UI. */
    hasPlan: boolean;
    frozen: boolean;
}

export default function DealStrip({
    transaction,
    party,
    stage,
    planComplete,
    hasPlan,
    frozen,
}: DealStripProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [countering, setCountering] = useState(false);
    const [counterAmount, setCounterAmount] = useState(
        transaction.offerAmount ? String(transaction.offerAmount) : "",
    );
    const [counterNote, setCounterNote] = useState("");
    const router = useRouter();

    const isSeller = party === "a";
    const isBuyer = party === "b";
    const amount = transaction.offerAmount;
    /** The standing offer is mine, so I cannot accept it — only they can. */
    const mineIsStanding = transaction.offerFrom === party;

    const run = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
        setBusy(true);
        setError("");
        const result = await fn();
        if (result.success) {
            setCountering(false);
            router.refresh();
        } else {
            setError(result.error || "That didn't work.");
        }
        setBusy(false);
    };

    const submitCounter = async () => {
        const value = Number(counterAmount);
        if (!Number.isFinite(value) || value <= 0) {
            setError("Enter an amount.");
            return;
        }
        await run(() => counterOffer(transaction.id, Math.round(value * 100) / 100, counterNote));
    };

    // ── Terminal states, told apart ──────────────────────────
    if (stage === "closed") {
        return (
            <Strip tone="muted" id="offer-card">
                <span className="text-muted-foreground text-sm font-semibold">
                    This deal ended without completing
                </span>
                {amount !== null && <Amount value={amount} muted />}
            </Strip>
        );
    }

    if (stage === "settled") {
        return (
            <Strip tone="good" id="offer-card">
                <span className="text-success text-sm font-semibold">🏁 Sale complete</span>
                {amount !== null && <Amount value={amount} />}
            </Strip>
        );
    }

    return (
        <div
            className="border-input bg-card animate-fade-in-up mb-4 rounded-lg border p-4 shadow-md sm:p-6"
            id="offer-card"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="stamp">{stageLabel(stage)}</span>
                    {frozen && <span className="stamp stamp-red">Disputed</span>}
                </div>
                {amount !== null && <Amount value={amount} />}
            </div>

            {transaction.offerMessage && (
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed italic">
                    &ldquo;{transaction.offerMessage}&rdquo;
                </p>
            )}

            {frozen ? (
                <p className="text-muted-foreground mt-3 text-sm">
                    This deal is disputed. The record is frozen so both sides keep the same copy of
                    what happened — export it from the record panel below.
                </p>
            ) : (
                <>
                    {/* ── An offer is on the table ── */}
                    {transaction.status === "offer_made" && (
                        <div className="mt-4">
                            {mineIsStanding ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-muted-foreground m-0 text-sm">
                                        ⏳ Waiting on the other side.
                                    </p>
                                    {isBuyer && (
                                        <Button
                                            variant="outline"
                                            size="wide"
                                            onClick={() => run(() => retractOffer(transaction.id))}
                                            disabled={busy}
                                        >
                                            ↩️ Retract offer
                                        </Button>
                                    )}
                                    {isSeller && (
                                        <Button
                                            variant="destructive-outline"
                                            size="wide"
                                            onClick={() =>
                                                run(() => cancelTransaction(transaction.id))
                                            }
                                            disabled={busy}
                                        >
                                            Withdraw
                                        </Button>
                                    )}
                                </div>
                            ) : countering ? (
                                <div className="border-input bg-muted/40 mt-2 rounded-lg border p-4">
                                    <label
                                        className="mb-1 block text-sm font-semibold"
                                        htmlFor="counter-amount"
                                    >
                                        Your counter
                                    </label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            id="counter-amount"
                                            type="number"
                                            min="1"
                                            step="0.01"
                                            className="border-input bg-card h-9 w-32 rounded-md border px-3 text-sm"
                                            value={counterAmount}
                                            onChange={(e) => setCounterAmount(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            maxLength={500}
                                            placeholder="A line about why (optional)"
                                            className="border-input bg-card h-9 min-w-[180px] flex-1 rounded-md border px-3 text-sm"
                                            value={counterNote}
                                            onChange={(e) => setCounterNote(e.target.value)}
                                        />
                                        <Button onClick={submitCounter} disabled={busy}>
                                            {busy ? "…" : "Send counter"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="wide"
                                            onClick={() => setCountering(false)}
                                            disabled={busy}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        onClick={() =>
                                            run(() =>
                                                // The seller answering the ORIGINAL offer keeps the
                                                // long-standing path (respond_to_offer_atomic, only
                                                // just repaired in 172). A counter is answered by
                                                // the newer move function.
                                                transaction.offerFrom === "b" && isSeller
                                                    ? respondToOffer(transaction.id, "accept")
                                                    : respondToCounter(transaction.id, "accept"),
                                            )
                                        }
                                        disabled={busy}
                                    >
                                        {busy ? "…" : `✅ Accept ${formatMoney(amount)}`}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="wide"
                                        onClick={() => setCountering(true)}
                                        disabled={busy}
                                    >
                                        ↔️ Counter
                                    </Button>
                                    <Button
                                        variant="destructive-outline"
                                        size="wide"
                                        onClick={() =>
                                            run(() =>
                                                transaction.offerFrom === "b" && isSeller
                                                    ? respondToOffer(transaction.id, "decline")
                                                    : respondToCounter(transaction.id, "decline"),
                                            )
                                        }
                                        disabled={busy}
                                    >
                                        Decline
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Accepted, money moving ── */}
                    {transaction.status === "pending_payment" && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            {hasPlan ? (
                                <p className="text-muted-foreground m-0 text-sm">
                                    {planComplete
                                        ? "Every payment is confirmed — the seller can release the horse."
                                        : "Payments are tracked in the ledger below."}
                                </p>
                            ) : isBuyer && !transaction.paidAt ? (
                                <>
                                    <p className="text-muted-foreground m-0 w-full text-sm">
                                        Offer accepted. Pay the seller directly — Model Horse Hub
                                        never holds funds — then say so here.
                                    </p>
                                    <Button
                                        onClick={() => run(() => markPaymentSent(transaction.id))}
                                        disabled={busy}
                                    >
                                        {busy ? "…" : "💳 External payment sent"}
                                    </Button>
                                </>
                            ) : isBuyer ? (
                                <p className="text-muted-foreground m-0 text-sm">
                                    💳 Payment marked as sent. Waiting for the seller to confirm it
                                    arrived.
                                </p>
                            ) : null}

                            {isSeller && (transaction.paidAt || planComplete) && (
                                <>
                                    <p className="text-muted-foreground m-0 w-full text-sm">
                                        {planComplete
                                            ? "The plan is paid in full."
                                            : "The buyer says they have paid."}
                                    </p>
                                    <Button
                                        onClick={() =>
                                            run(() => verifyFundsAndRelease(transaction.id))
                                        }
                                        disabled={busy}
                                    >
                                        {busy ? "Verifying…" : "✅ Confirm payment & release"}
                                    </Button>
                                </>
                            )}
                            {isSeller && !transaction.paidAt && !planComplete && !hasPlan && (
                                <p className="text-muted-foreground m-0 text-sm">
                                    ⏳ Waiting for the buyer to send payment.
                                </p>
                            )}
                            {isSeller && (
                                <Button
                                    variant="destructive-outline"
                                    size="wide"
                                    onClick={() => run(() => cancelTransaction(transaction.id))}
                                    disabled={busy}
                                >
                                    Cancel sale
                                </Button>
                            )}
                        </div>
                    )}

                    {/* ── Funds confirmed, horse moving ── */}
                    {transaction.status === "funds_verified" && (
                        <div className="mt-4">
                            {isBuyer && transaction.pin ? (
                                <div className="border-success bg-success/10 mt-2 rounded-lg border-2 p-6 text-center">
                                    <span className="text-muted-foreground mb-1 block text-xs">
                                        🔑 Your claim PIN
                                    </span>
                                    <strong className="text-success block font-mono text-2xl font-extrabold tracking-[0.15em]">
                                        {transaction.pin}
                                    </strong>
                                    <Button asChild variant="outline" size="wide">
                                        <Link href="/claim">Go to the claim page →</Link>
                                    </Button>
                                </div>
                            ) : isBuyer ? (
                                <p className="text-muted-foreground m-0 text-sm">
                                    ✅ Funds confirmed. Your claim PIN is in your notifications.
                                </p>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-muted-foreground m-0 text-sm">
                                        ✅ PIN released to the buyer. Transfer in progress.
                                    </p>
                                    <Button
                                        variant="destructive-outline"
                                        size="wide"
                                        onClick={() => run(() => cancelTransaction(transaction.id))}
                                        disabled={busy}
                                    >
                                        Cancel sale
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {error && <p className="text-destructive mt-3 mb-0 text-sm">{error}</p>}
        </div>
    );
}

function Strip({
    children,
    tone,
    id,
}: {
    children: React.ReactNode;
    tone: "muted" | "good";
    id?: string;
}) {
    return (
        <div
            id={id}
            className={`animate-fade-in-up mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 sm:p-6 ${
                tone === "good" ? "border-success/40 bg-success/10" : "border-input bg-muted/40"
            }`}
        >
            {children}
        </div>
    );
}

function Amount({ value, muted = false }: { value: number; muted?: boolean }) {
    return (
        <span
            className={`font-serif text-xl font-bold ${muted ? "text-muted-foreground" : "text-saddle"}`}
        >
            {formatMoney(value)}
        </span>
    );
}
