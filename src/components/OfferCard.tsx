"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { respondToOffer, markPaymentSent, verifyFundsAndRelease } from "@/app/actions/transactions";

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

    // ── Cancelled / Completed ──
    if (status === "cancelled") {
        return (
            <div className="offer-card offer-card-cancelled" id="offer-card">
                <div className="offer-card-header">
                    <span className="offer-badge offer-badge-cancelled">❌ Offer Declined</span>
                    {amount && <span className="offer-amount">${amount.toFixed(2)}</span>}
                </div>
            </div>
        );
    }

    if (status === "completed") {
        return (
            <div className="offer-card offer-card-completed" id="offer-card">
                <div className="offer-card-header">
                    <span className="offer-badge offer-badge-completed">✅ Transaction Complete</span>
                    {amount && <span className="offer-amount">${amount.toFixed(2)}</span>}
                </div>
            </div>
        );
    }

    // ── Active states ──
    return (
        <div className="offer-card" id="offer-card">
            <div className="offer-card-header">
                <span className="offer-badge">💰 Offer</span>
                {amount && <span className="offer-amount">${amount.toFixed(2)}</span>}
            </div>

            {transaction.offerMessage && (
                <p className="offer-message">&ldquo;{transaction.offerMessage}&rdquo;</p>
            )}

            {/* offer_made */}
            {status === "offer_made" && (
                <div className="offer-state">
                    {isSeller ? (
                        <div className="offer-actions">
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleRespond("accept")}
                                disabled={saving}
                            >
                                {saving ? "…" : "✅ Accept Offer"}
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleRespond("decline")}
                                disabled={saving}
                            >
                                Decline
                            </button>
                        </div>
                    ) : (
                        <p className="offer-status-text">⏳ Waiting for seller response…</p>
                    )}
                </div>
            )}

            {/* pending_payment */}
            {status === "pending_payment" && (
                <div className="offer-state">
                    <p className="offer-status-text offer-accepted">
                        ✅ Offer accepted! {isBuyer ? "Please send payment to the seller." : "Waiting for buyer to send payment."}
                    </p>
                    {isBuyer && !hasPaid && (
                        <div className="offer-actions">
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleMarkPaid}
                                disabled={saving}
                            >
                                {saving ? "…" : "💳 I Have Paid"}
                            </button>
                        </div>
                    )}
                    {isBuyer && hasPaid && (
                        <p className="offer-status-text">💳 Payment marked as sent. Waiting for seller to verify…</p>
                    )}
                    {isSeller && hasPaid && (
                        <div className="offer-actions">
                            <p className="offer-status-text">💳 Buyer says they&apos;ve paid.</p>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleVerify}
                                disabled={saving}
                            >
                                {saving ? "Verifying…" : "✅ Confirm Funds & Release"}
                            </button>
                        </div>
                    )}
                    {isSeller && !hasPaid && (
                        <p className="offer-status-text">⏳ Waiting for buyer to send payment…</p>
                    )}
                </div>
            )}

            {/* funds_verified */}
            {status === "funds_verified" && (
                <div className="offer-state">
                    {isBuyer && pin ? (
                        <div className="pin-reveal">
                            <span className="pin-label">🔑 Your Claim PIN</span>
                            <strong className="pin-code">{pin}</strong>
                            <Link href="/claim" className="btn btn-primary btn-sm" style={{ marginTop: "var(--space-sm)" }}>
                                Go to Claim Page →
                            </Link>
                        </div>
                    ) : isBuyer ? (
                        <p className="offer-status-text">✅ Funds verified. Check notifications for your claim PIN.</p>
                    ) : (
                        <p className="offer-status-text">✅ PIN released to buyer. Transfer in progress…</p>
                    )}
                </div>
            )}

            {error && <div className="comment-error" style={{ marginTop: "var(--space-sm)" }}>{error}</div>}
        </div>
    );
}
