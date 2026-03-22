"use client";

import { useState, useMemo } from"react";
import { createPortal } from"react-dom";
import { useRouter } from"next/navigation";
import { makeOffer } from"@/app/actions/transactions";
import { RISKY_PAYMENT_REGEX, RISKY_PAYMENT_WARNING } from"@/lib/safety";

interface MakeOfferModalProps {
 horseId: string;
 horseName: string;
 sellerId: string;
 askingPrice?: number | null;
 onClose: () => void;
}

export default function MakeOfferModal({ horseId, horseName, sellerId, askingPrice, onClose }: MakeOfferModalProps) {
 const [amount, setAmount] = useState(askingPrice ? String(askingPrice) :"");
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
 setError(result.error ||"Failed to submit offer.");
 setSaving(false);
 }
 };

 return createPortal(
 <div className="modal-overlay" onClick={onClose}>
 <div className="modal-content max-w-[420px] max-sm:max-w-full" onClick={(e) => e.stopPropagation()}>
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <h3>💰 Make an Offer</h3>
 <button
 className="text-muted cursor-pointer rounded-md border-0 bg-transparent p-1 text-[1.2rem] transition-all duration-150"
 onClick={onClose}
 aria-label="Close"
 >
 ×
 </button>
 </div>

 <p className="text-muted mb-4 text-sm">
 🐴 <strong>{horseName}</strong>
 </p>

 <form onSubmit={handleSubmit}>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Your Offer</label>
 <div className="flex items-center gap-1">
 <span className="text-muted text-lg font-bold">$</span>
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
 <span className="text-muted mt-1 block text-xs">
 Asking price: ${askingPrice.toLocaleString("en-US")}
 </span>
 )}
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Message (optional)</label>
 <textarea
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 placeholder="Tell the seller about your interest…"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
 rows={3}
 maxLength={500}
 />
 {showPaymentWarning && (
 <div
 className="mt-2 text-sm text-[var(--color-warning,#eab308)] py-1 px-2 mt-1 rounded-sm border border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.15)]"
 >
 {RISKY_PAYMENT_WARNING}
 </div>
 )}
 </div>

 <label
 className="mb-2 flex cursor-pointer items-center gap-1 text-sm"
 >
 <input type="checkbox" checked={isBundle} onChange={(e) => setIsBundle(e.target.checked)} />
 This is a bundle/lot sale (excluded from market price index)
 </label>

 {error && <div className="mt-2 text-sm text-danger">{error}</div>}

 <div className="mt-6 flex gap-3 max-sm:flex-col">
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={onClose}
 disabled={saving}
 >
 Cancel
 </button>
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={saving}
 >
 {saving ?"Submitting…" :"Submit Offer"}
 </button>
 </div>
 </form>
 </div>
 </div>,
 document.body,
 );
}
