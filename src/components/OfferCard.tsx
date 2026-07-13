"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import {
 respondToOffer,
 markPaymentSent,
 verifyFundsAndRelease,
 cancelTransaction,
 retractOffer,
} from"@/app/actions/transactions";
import { Button } from "@/components/ui/button";

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
 const [pin, setPin] = useState<string | null>((transaction.metadata?.pin as string) || null);
 const [hasPaid, setHasPaid] = useState(!!transaction.paidAt);
 const router = useRouter();

 const isSeller = currentUserId === transaction.partyAId;
 const isBuyer = currentUserId === transaction.partyBId;
 const amount = transaction.offerAmount;

 const handleRespond = async (action:"accept" |"decline") => {
 setSaving(true);
 setError("");
 const result = await respondToOffer(transaction.transactionId, action);
 if (result.success) {
 setStatus(action ==="accept" ?"pending_payment" :"cancelled");
 router.refresh();
 } else {
 setError(result.error ||"Failed.");
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
 setError(result.error ||"Failed.");
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
 setError(result.error ||"Failed.");
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
 setError(result.error ||"Failed to cancel.");
 }
 setSaving(false);
 };

 // ── Cancelled / Completed ──
 if (status ==="cancelled") {
 return (
 <div
 className="mb-4 animate-[fadeInUp_0.3s_ease] rounded-lg border border-red-200 bg-red-50/60 p-6 opacity-70"
 id="offer-card"
 >
 <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-1">
 <span className="text-sm font-semibold text-[#ef4444]">❌ Offer Declined</span>
 {amount && <span className="text-saddle text-xl font-bold">${amount.toFixed(2)}</span>}
 </div>
 </div>
 );
 }

 if (status ==="completed") {
 return (
 <div
 className="mb-4 animate-[fadeInUp_0.3s_ease] rounded-lg border border-emerald-200 bg-emerald-50/60 p-6"
 id="offer-card"
 >
 <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-1">
 <span className="text-sm font-semibold text-[#22c55e]">✅ Transaction Complete</span>
 {amount && <span className="text-saddle text-xl font-bold">${amount.toFixed(2)}</span>}
 </div>
 </div>
 );
 }

 // ── Active states ──
 return (
 <div
 className="mb-4 animate-[fadeInUp_0.3s_ease] rounded-lg border border-emerald-200 bg-emerald-50/80 p-6"
 id="offer-card"
 >
 <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-1">
 <span className="text-saddle text-sm font-semibold">💰 Offer</span>
 {amount && <span className="text-saddle text-xl font-bold">${amount.toFixed(2)}</span>}
 </div>

 {transaction.offerMessage && (
 <p className="text-muted-foreground mt-2 text-sm leading-relaxed italic">
 &ldquo;{transaction.offerMessage}&rdquo;
 </p>
 )}

 {/* offer_made */}
 {status ==="offer_made" && (
 <div className="mt-4">
 {isSeller ? (
 <div className="mt-2 flex flex-wrap items-center gap-2">
 <Button
 onClick={() => handleRespond("accept")}
 disabled={saving}
 >
 {saving ?"…" :"✅ Accept Offer"}
 </Button>
 <Button variant="outline" size="wide"
 onClick={() => handleRespond("decline")}
 disabled={saving}
 >
 Decline
 </Button>
 </div>
 ) : (
 <div>
 <p className="text-muted-foreground text-sm">⏳ Waiting for seller response…</p>
 <Button variant="outline" size="wide" className="text-muted-foreground mt-1"
 onClick={async () => {
 setSaving(true);
 const result = await retractOffer(transaction.transactionId);
 if (result.success) {
 setStatus("cancelled");
 router.refresh();
 } else {
 setError(result.error ||"Failed to retract.");
 }
 setSaving(false);
 }}
 disabled={saving}
 >
 ↩️ Retract Offer
 </Button>
 </div>
 )}
 </div>
 )}

 {/* pending_payment */}
 {status ==="pending_payment" && (
 <div className="mt-4">
 <p className="text-sm font-medium text-[#22c55e]">
 ✅ Offer accepted!{""}
 {isBuyer ?"Please send payment to the seller." :"Waiting for buyer to send payment."}
 </p>
 {isBuyer && !hasPaid && (
 <div className="mt-2 flex flex-wrap items-center gap-2">
 <Button
 onClick={handleMarkPaid}
 disabled={saving}
 >
 {saving ?"…" :"💳 External Payment Sent"}
 </Button>
 </div>
 )}
 {isBuyer && hasPaid && (
 <p className="text-muted-foreground text-sm">💳 Payment marked as sent. Waiting for seller to verify…</p>
 )}
 {isSeller && hasPaid && (
 <div className="mt-2 flex flex-wrap items-center gap-2">
 <p className="text-muted-foreground text-sm">💳 Buyer says they&apos;ve paid.</p>
 <Button
 onClick={handleVerify}
 disabled={saving}
 >
 {saving ?"Verifying…" :"✅ Acknowledge External Payment & Release"}
 </Button>
 <Button variant="destructive-outline" size="wide"
 onClick={handleCancel}
 disabled={saving}
 >
 {saving ?"…" :"🚫 Cancel / Dispute"}
 </Button>
 </div>
 )}
 {isSeller && !hasPaid && (
 <div className="mt-2 flex flex-wrap items-center gap-2">
 <p className="text-muted-foreground text-sm">⏳ Waiting for buyer to send payment…</p>
 <Button variant="destructive-outline" size="wide"
 onClick={handleCancel}
 disabled={saving}
 >
 {saving ?"…" :"🚫 Cancel / Dispute"}
 </Button>
 </div>
 )}
 </div>
 )}

 {/* funds_verified */}
 {status ==="funds_verified" && (
 <div className="mt-4">
 {isBuyer && pin ? (
 <div className="border-success mt-2 rounded-lg border-2 bg-emerald-50 p-6 text-center">
 <span className="text-muted-foreground mb-1 block text-xs">🔑 Your Claim PIN</span>
 <strong className="block font-mono text-2xl font-extrabold tracking-[0.15em] text-[#22c55e]">
 {pin}
 </strong>
 <Button asChild variant="outline"><Link
 href="/claim"
 >
 Go to Claim Page →
 </Link></Button>
 </div>
 ) : isBuyer ? (
 <p className="text-muted-foreground text-sm">✅ Funds verified. Check notifications for your claim PIN.</p>
 ) : (
 <div className="mt-2 flex flex-wrap items-center gap-2">
 <p className="text-muted-foreground text-sm">✅ PIN released to buyer. Transfer in progress…</p>
 <Button variant="destructive-outline" size="wide"
 onClick={handleCancel}
 disabled={saving}
 >
 {saving ?"…" :"🚫 Cancel Sale"}
 </Button>
 </div>
 )}
 </div>
 )}

 {error && <div className="mt-2 text-sm text-red-700 mt-2">{error}</div>}
 </div>
 );
}
