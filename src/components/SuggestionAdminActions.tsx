"use client";

import { useState, useTransition } from"react";
import { reviewSuggestion } from"@/app/actions/catalog-suggestions";
import { useRouter } from"next/navigation";
import { useToast } from"@/lib/context/ToastContext";

interface Props {
 suggestionId: string;
}

export default function SuggestionAdminActions({ suggestionId }: Props) {
 const router = useRouter();
 const { toast } = useToast();
 const [isPending, startTransition] = useTransition();
 const [notes, setNotes] = useState("");
 const [showRejectForm, setShowRejectForm] = useState(false);

 const handleApprove = () => {
 startTransition(async () => {
 const result = await reviewSuggestion({
 suggestionId,
 decision:"approved",
 adminNotes: notes || undefined,
 });
 if (result.success) {
 toast("✅ Suggestion approved and changes applied.","success");
 router.refresh();
 } else {
 toast(result.error ??"Failed to approve.","error");
 }
 });
 };

 const handleReject = () => {
 if (!notes.trim()) {
 toast("Please provide a reason for rejection.","error");
 return;
 }
 startTransition(async () => {
 const result = await reviewSuggestion({
 suggestionId,
 decision:"rejected",
 adminNotes: notes.trim(),
 });
 if (result.success) {
 toast("❌ Suggestion rejected. User notified.","success");
 router.refresh();
 } else {
 toast(result.error ??"Failed to reject.","error");
 }
 });
 };

 return (
 <div className="mt-2 flex flex-col gap-2">
 {!showRejectForm ? (
 <div className="flex gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleApprove}
 disabled={isPending}
 >
 {isPending ?"Applying…" :"✅ Approve"}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={() => setShowRejectForm(true)}
 disabled={isPending}
 >
 ❌ Reject
 </button>
 </div>
 ) : (
 <div className="flex flex-col gap-2">
 <textarea
 className="input"
 placeholder="Reason for rejection (required)…"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={2}
 />
 <div className="flex gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={handleReject}
 disabled={isPending || !notes.trim()}
 >
 {isPending ?"Rejecting…" :"Confirm Reject"}
 </button>
 <button
 className="inline-flex min-h-[36px] max-md:min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setShowRejectForm(false)}
 >
 Cancel
 </button>
 </div>
 </div>
 )}

 {/* Optional notes for approve */}
 {!showRejectForm && (
 <input
 type="text"
 className="input bg-[rgba(255,193,7,0.05)] rounded-r-md my-3-input border-l-[3px] border-[#f9a825] px-4 py-2"
 placeholder="Optional admin notes…"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 />
 )}
 </div>
 );
}
