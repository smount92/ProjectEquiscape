"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { makeOffer } from "@/app/actions/transactions";
import { RISKY_PAYMENT_REGEX, RISKY_PAYMENT_WARNING } from "@/lib/safety";


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
            <div className="modal-content max-w-[420px]" onClick={(e) => e.stopPropagation()}>
                <div className="modal-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                    <h3>💰 Make an Offer</h3>
                    <button className="bg-transparent border-0 text-muted text-[1.2rem] cursor-pointer p-1 rounded-md transition-all duration-150" onClick={onClose} aria-label="Close">×</button>
                </div>

                <p className="text-sm text-muted mb-4">
                    🐴 <strong>{horseName}</strong>
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Your Offer</label>
                        <div className="flex items-center gap-1">
                            <span className="text-lg font-bold text-muted">$</span>
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
                            <span className="block mt-1 text-xs text-muted">
                                Asking price: ${askingPrice.toLocaleString("en-US")}
                            </span>
                        )}
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Message (optional)</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Tell the seller about your interest…"
                            className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150"
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

                    <div className="flex gap-2 justify-end mt-6 max-sm:flex-col max-sm:[&_.inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none]:w-full">
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
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
