"use client";

import { useState, useMemo } from"react";
import { useRouter } from"next/navigation";
import { makeOffer } from"@/app/actions/transactions";
import { RISKY_PAYMENT_REGEX, RISKY_PAYMENT_WARNING } from"@/lib/safety";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

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
 const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
 const router = useRouter();

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

 return (
 <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
 <DialogContent className="sm:max-w-[420px]">
 <DialogHeader>
 <DialogTitle>💰 Make an Offer</DialogTitle>
 <DialogDescription>
 🐴 <strong>{horseName}</strong>
 </DialogDescription>
 </DialogHeader>

 <form onSubmit={handleSubmit}>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Your Offer</label>
 <div className="flex items-center gap-1">
 <span className="text-stone-500 text-lg font-bold">$</span>
 <Input
 type="number"
 step="0.01"
 min="0.01"
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 placeholder="0.00"
 required
 autoFocus
 />
 </div>
 {askingPrice && (
 <span className="text-stone-500 mt-1 block text-xs">
 Asking price: ${askingPrice.toLocaleString("en-US")}
 </span>
 )}
 </div>

 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Message (optional)</label>
 <textarea
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 placeholder="Tell the seller about your interest…"
 className="inline-flex min-h-[36px] w-full resize-y rounded-md border border-input bg-transparent px-4 py-2 text-sm transition-all"
 rows={3}
 maxLength={500}
 />
 {showPaymentWarning && (
 <div
 className="mt-2 text-sm text-[var(--color-warning,#eab308)] py-1 px-2 rounded-sm border border-yellow-300 bg-yellow-50"
 >
 {RISKY_PAYMENT_WARNING}
 </div>
 )}
 </div>

 <label className="mb-2 flex cursor-pointer items-center gap-1 text-sm">
 <Input type="checkbox" checked={isBundle} onChange={(e) => setIsBundle(e.target.checked)} />
 This is a bundle/lot sale (excluded from market price index)
 </label>

 <label className="mb-2 flex cursor-pointer items-start gap-2 text-xs text-stone-500 mt-4">
  <Input type="checkbox" checked={disclaimerAccepted} onChange={(e) => setDisclaimerAccepted(e.target.checked)} className="mt-0.5" required />
  <span>
   I understand that Model Horse Hub does not process payments and cannot
   mediate financial disputes. All transactions are between buyer and seller.
  </span>
 </label>

 {error && <div className="mt-2 text-sm text-red-700">{error}</div>}

 <div className="mt-6 flex gap-3 max-sm:flex-col">
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={onClose}
 disabled={saving}
 >
 Cancel
 </button>
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 disabled={saving || !disclaimerAccepted}
 >
 {saving ?"Submitting…" :"Submit Offer"}
 </button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 );
}
