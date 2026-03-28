"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { markTransactionComplete } from"@/app/actions/messaging";

interface TransactionActionsProps {
 conversationId: string;
 initialStatus: string;
 hasRating: boolean;
}

export default function TransactionActions({ conversationId, initialStatus, hasRating }: TransactionActionsProps) {
 const [status, setStatus] = useState(initialStatus);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const router = useRouter();

 const handleComplete = async () => {
 setSaving(true);
 setError("");
 const result = await markTransactionComplete(conversationId);
 if (result.success) {
 setStatus("completed");
 router.refresh(); // Re-renders page so RatingForm appears
 } else {
 setError(result.error ||"Failed to mark as complete.");
 }
 setSaving(false);
 };

 if (status ==="completed") {
 return (
 <div
 className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-6 py-4"
 id="transaction-status"
 >
 <span className="text-sm font-semibold text-[#22C55E]">
 ✅ Transaction Complete
 </span>
 {!hasRating && (
 <span className="text-stone-500 mt-2 block text-sm">
 Leave a rating below to close the loop! ⬇️
 </span>
 )}
 </div>
 );
 }

 return (
 <div
 className="bg-white border border-stone-200 mt-4 rounded-lg border px-6 py-4 shadow-md"
 id="transaction-status"
 >
 <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
 <span className="text-stone-500 text-sm">Transaction is open</span>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleComplete}
 disabled={saving}
 >
 {saving ?"Completing…" :"✅ Mark as Complete"}
 </button>
 </div>
 {error && <div className="mt-2 text-sm text-red-700 mt-2">{error}</div>}
 </div>
 );
}
