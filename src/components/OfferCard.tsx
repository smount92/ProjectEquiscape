"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { respondToOffer, markPaymentSent, verifyFundsAndRelease } from "@/app/actions/transactions";
import styles from "./OfferCard.module.css";

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
            <div className={`${styles.card} ${styles.cardCancelled}`} id="offer-card">
                <div className={styles.header}>
                    <span className={`${styles.badge} ${styles.badgeCancelled}`}>❌ Offer Declined</span>
                    {amount && <span className={styles.amount}>${amount.toFixed(2)}</span>}
                </div>
            </div>
        );
    }

    if (status === "completed") {
        return (
            <div className={`${styles.card} ${styles.cardCompleted}`} id="offer-card">
                <div className={styles.header}>
                    <span className={`${styles.badge} ${styles.badgeCompleted}`}>✅ Transaction Complete</span>
                    {amount && <span className={styles.amount}>${amount.toFixed(2)}</span>}
                </div>
            </div>
        );
    }

    // ── Active states ──
    return (
        <div className={styles.card} id="offer-card">
            <div className={styles.header}>
                <span className={styles.badge}>💰 Offer</span>
                {amount && <span className={styles.amount}>${amount.toFixed(2)}</span>}
            </div>

            {transaction.offerMessage && (
                <p className={styles.message}>&ldquo;{transaction.offerMessage}&rdquo;</p>
            )}

            {/* offer_made */}
            {status === "offer_made" && (
                <div className={styles.state}>
                    {isSeller ? (
                        <div className={styles.actions}>
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
                        <p className={styles.statusText}>⏳ Waiting for seller response…</p>
                    )}
                </div>
            )}

            {/* pending_payment */}
            {status === "pending_payment" && (
                <div className={styles.state}>
                    <p className={`${styles.statusText} ${styles.statusAccepted}`}>
                        ✅ Offer accepted! {isBuyer ? "Please send payment to the seller." : "Waiting for buyer to send payment."}
                    </p>
                    {isBuyer && !hasPaid && (
                        <div className={styles.actions}>
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
                        <p className={styles.statusText}>💳 Payment marked as sent. Waiting for seller to verify…</p>
                    )}
                    {isSeller && hasPaid && (
                        <div className={styles.actions}>
                            <p className={styles.statusText}>💳 Buyer says they&apos;ve paid.</p>
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
                        <p className={styles.statusText}>⏳ Waiting for buyer to send payment…</p>
                    )}
                </div>
            )}

            {/* funds_verified */}
            {status === "funds_verified" && (
                <div className={styles.state}>
                    {isBuyer && pin ? (
                        <div className={styles.pinReveal}>
                            <span className={styles.pinLabel}>🔑 Your Claim PIN</span>
                            <strong className={styles.pinCode}>{pin}</strong>
                            <Link href="/claim" className="btn btn-primary btn-sm" style={{ marginTop: "var(--space-sm)" }}>
                                Go to Claim Page →
                            </Link>
                        </div>
                    ) : isBuyer ? (
                        <p className={styles.statusText}>✅ Funds verified. Check notifications for your claim PIN.</p>
                    ) : (
                        <p className={styles.statusText}>✅ PIN released to buyer. Transfer in progress…</p>
                    )}
                </div>
            )}

            {error && <div className="comment-error" style={{ marginTop: "var(--space-sm)" }}>{error}</div>}
        </div>
    );
}
