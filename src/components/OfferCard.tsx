"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { respondToOffer, markPaymentSent, verifyFundsAndRelease, cancelTransaction, retractOffer } from "@/app/actions/transactions";


interface OfferCardProps {
    transaction: {
        transactionId: string;
        status: string;
        offerAmount: number | null;
        offerMessage: string | null;
        partyAId: string; // seller
        partyBId: string | null; // buyer
        paidAt: string | null;
        verifiedAt: string | null;
        metadata: Record<string, unknown> | null;
    };
    currentUserId: string;
}

export default function OfferCard({ transaction, currentUserId }: OfferCardProps) {
    const [status, setStatus] = useState(transaction.status);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [pin, setPin] = useState<string | null>(
        (transaction.metadata?.pin as string) || null
    );
    const [hasPaid, setHasPaid] = useState(!!transaction.paidAt);
    const router = useRouter();

    const isSeller = currentUserId === transaction.partyAId;
    const isBuyer = currentUserId === transaction.partyBId;
    const amount = transaction.offerAmount;

    const handleRespond = async (action: "accept" | "decline") => {
        setSaving(true);
        setError("");
        const result = await respondToOffer(transaction.transactionId, action);
        if (result.success) {
            setStatus(action === "accept" ? "pending_payment" : "cancelled");
            router.refresh();
        } else {
            setError(result.error || "Failed.");
        }
        setSaving(false);
    };

    const handleMarkPaid = async () => {
        setSaving(true);
        setError("");
        const result = await markPaymentSent(transaction.transactionId);
        if (result.success) {
            setHasPaid(true);
            router.refresh();
        } else {
            setError(result.error || "Failed.");
        }
        setSaving(false);
    };

    const handleVerify = async () => {
        setSaving(true);
        setError("");
        const result = await verifyFundsAndRelease(transaction.transactionId);
        if (result.success) {
            setStatus("funds_verified");
            setPin(result.pin || null);
            router.refresh();
        } else {
            setError(result.error || "Failed.");
        }
        setSaving(false);
    };

    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel this transaction? The horse will be relisted.")) return;
        setSaving(true);
        setError("");
        const result = await cancelTransaction(transaction.transactionId);
        if (result.success) {
            setStatus("cancelled");
            router.refresh();
        } else {
            setError(result.error || "Failed to cancel.");
        }
        setSaving(false);
    };

    // ── Cancelled / Completed ──
    if (status === "cancelled") {
        return (
            <div className="bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)] rounded-lg p-6 mb-4 animate-[fadeInUp_0.3s_ease] opacity-70" id="offer-card">
                <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-1">
                    <span className="font-semibold text-sm text-[#ef4444]">❌ Offer Declined</span>
                    {amount && <span className="text-xl font-bold text-saddle">${amount.toFixed(2)}</span>}
                </div>
            </div>
        );
    }

    if (status === "completed") {
        return (
            <div className="bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.2)] rounded-lg p-6 mb-4 animate-[fadeInUp_0.3s_ease]" id="offer-card">
                <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-1">
                    <span className="font-semibold text-sm text-[#22c55e]">✅ Transaction Complete</span>
                    {amount && <span className="text-xl font-bold text-saddle">${amount.toFixed(2)}</span>}
                </div>
            </div>
        );
    }

    // ── Active states ──
    return (
        <div className="bg-[rgba(44,85,69,0.08)] border border-[rgba(44,85,69,0.2)] rounded-lg p-6 mb-4 animate-[fadeInUp_0.3s_ease]" id="offer-card">
            <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-1">
                <span className="font-semibold text-sm text-saddle">💰 Offer</span>
                {amount && <span className="text-xl font-bold text-saddle">${amount.toFixed(2)}</span>}
            </div>

            {transaction.offerMessage && (
                <p className="mt-2 text-sm text-muted italic leading-relaxed">&ldquo;{transaction.offerMessage}&rdquo;</p>
            )}

            {/* offer_made */}
            {status === "offer_made" && (
                <div className="mt-4">
                    {isSeller ? (
                        <div className="flex gap-2 mt-2 flex-wrap items-center">
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm"
                                onClick={() => handleRespond("accept")}
                                disabled={saving}
                            >
                                {saving ? "…" : "✅ Accept Offer"}
                            </button>
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
                                onClick={() => handleRespond("decline")}
                                disabled={saving}
                            >
                                Decline
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p className="text-sm text-muted">⏳ Waiting for seller response…</p>
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
                                onClick={async () => {
                                    setSaving(true);
                                    const result = await retractOffer(transaction.transactionId);
                                    if (result.success) {
                                        setStatus("cancelled");
                                        router.refresh();
                                    } else {
                                        setError(result.error || "Failed to retract.");
                                    }
                                    setSaving(false);
                                }}
                                disabled={saving}
                                style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}
                            >
                                ↩️ Retract Offer
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* pending_payment */}
            {status === "pending_payment" && (
                <div className="mt-4">
                    <p className="text-sm text-[#22c55e] font-medium">
                        ✅ Offer accepted! {isBuyer ? "Please send payment to the seller." : "Waiting for buyer to send payment."}
                    </p>
                    {isBuyer && !hasPaid && (
                        <div className="flex gap-2 mt-2 flex-wrap items-center">
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm"
                                onClick={handleMarkPaid}
                                disabled={saving}
                            >
                                {saving ? "…" : "💳 I Have Paid"}
                            </button>
                        </div>
                    )}
                    {isBuyer && hasPaid && (
                        <p className="text-sm text-muted">💳 Payment marked as sent. Waiting for seller to verify…</p>
                    )}
                    {isSeller && hasPaid && (
                        <div className="flex gap-2 mt-2 flex-wrap items-center">
                            <p className="text-sm text-muted">💳 Buyer says they&apos;ve paid.</p>
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm"
                                onClick={handleVerify}
                                disabled={saving}
                            >
                                {saving ? "Verifying…" : "✅ Confirm Funds & Release"}
                            </button>
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
                                onClick={handleCancel}
                                disabled={saving}
                                style={{ color: "#ef4444" }}
                            >
                                {saving ? "…" : "🚫 Cancel / Dispute"}
                            </button>
                        </div>
                    )}
                    {isSeller && !hasPaid && (
                        <div className="flex gap-2 mt-2 flex-wrap items-center">
                            <p className="text-sm text-muted">⏳ Waiting for buyer to send payment…</p>
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
                                onClick={handleCancel}
                                disabled={saving}
                                style={{ color: "#ef4444" }}
                            >
                                {saving ? "…" : "🚫 Cancel / Dispute"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* funds_verified */}
            {status === "funds_verified" && (
                <div className="mt-4">
                    {isBuyer && pin ? (
                        <div className="bg-[rgba(92,224,160,0.1)] border-2 border-success rounded-lg p-6 text-center mt-2">
                            <span className="block text-xs text-muted mb-1">🔑 Your Claim PIN</span>
                            <strong className="block text-2xl font-extrabold tracking-[0.15em] text-[#22c55e] font-mono">{pin}</strong>
                            <Link href="/claim" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm mt-2">
                                Go to Claim Page →
                            </Link>
                        </div>
                    ) : isBuyer ? (
                        <p className="text-sm text-muted">✅ Funds verified. Check notifications for your claim PIN.</p>
                    ) : (
                        <p className="text-sm text-muted">✅ PIN released to buyer. Transfer in progress…</p>
                    )}
                </div>
            )}

            {error && <div className="comment-error mt-2">{error}</div>}
        </div>
    );
}
