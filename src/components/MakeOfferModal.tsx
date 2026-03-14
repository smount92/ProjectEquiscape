"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { makeOffer } from "@/app/actions/transactions";
import { RISKY_PAYMENT_REGEX, RISKY_PAYMENT_WARNING } from "@/lib/safety";
import styles from "./MakeOfferModal.module.css";

interface MakeOfferModalProps {
    horseId: string;
    horseName: string;
    sellerId: string;
    askingPrice?: number | null;
    onClose: () => void;
}

export default function MakeOfferModal({
    horseId,
    horseName,
    sellerId,
    askingPrice,
    onClose,
}: MakeOfferModalProps) {
    const [amount, setAmount] = useState(askingPrice ? String(askingPrice) : "");
    const [message, setMessage] = useState("");
    const [isBundle, setIsBundle] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    // Risky payment detection
    const showPaymentWarning = useMemo(() => RISKY_PAYMENT_REGEX.test(message), [message]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            setError("Please enter a valid amount.");
            return;
        }

        setSaving(true);
        setError("");
        const result = await makeOffer({
            horseId,
            sellerId,
            amount: numAmount,
            message: message.trim() || undefined,
            isBundle,
        });

        if (result.success && result.conversationId) {
            router.push(`/inbox/${result.conversationId}`);
        } else {
            setError(result.error || "Failed to submit offer.");
            setSaving(false);
        }
    };

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className={`modal-content ${styles.modal}`} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>💰 Make an Offer</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>

                <p className={styles.horse}>
                    🐴 <strong>{horseName}</strong>
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Your Offer</label>
                        <div className={styles.amountInput}>
                            <span className={styles.currency}>$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="form-input"
                                required
                                autoFocus
                            />
                        </div>
                        {askingPrice && (
                            <span className="form-hint">
                                Asking price: ${askingPrice.toLocaleString("en-US")}
                            </span>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Message (optional)</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Tell the seller about your interest…"
                            className="form-input"
                            rows={3}
                            maxLength={500}
                        />
                        {showPaymentWarning && (
                            <div className="comment-error" style={{ marginTop: "var(--space-xs)", background: "rgba(234, 179, 8, 0.15)", color: "var(--color-warning, #eab308)", border: "1px solid rgba(234, 179, 8, 0.3)", borderRadius: "var(--radius-sm)", padding: "var(--space-xs) var(--space-sm)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                {RISKY_PAYMENT_WARNING}
                            </div>
                        )}
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer", marginBottom: "var(--space-sm)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                        <input type="checkbox" checked={isBundle} onChange={e => setIsBundle(e.target.checked)} />
                        This is a bundle/lot sale (excluded from market price index)
                    </label>

                    {error && <div className="comment-error">{error}</div>}

                    <div className={styles.actions}>
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            {saving ? "Submitting…" : "Submit Offer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
