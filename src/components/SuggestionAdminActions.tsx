"use client";

import { useState, useTransition } from "react";
import { reviewSuggestion } from "@/app/actions/catalog-suggestions";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/context/ToastContext";

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
                decision: "approved",
                adminNotes: notes || undefined,
            });
            if (result.success) {
                toast("✅ Suggestion approved and changes applied.", "success");
                router.refresh();
            } else {
                toast(result.error ?? "Failed to approve.", "error");
            }
        });
    };

    const handleReject = () => {
        if (!notes.trim()) {
            toast("Please provide a reason for rejection.", "error");
            return;
        }
        startTransition(async () => {
            const result = await reviewSuggestion({
                suggestionId,
                decision: "rejected",
                adminNotes: notes.trim(),
            });
            if (result.success) {
                toast("❌ Suggestion rejected. User notified.", "success");
                router.refresh();
            } else {
                toast(result.error ?? "Failed to reject.", "error");
            }
        });
    };

    return (
        <div className="flex flex-col gap-2 mt-2">
            {!showRejectForm ? (
                <div className="flex gap-2">
                    <button
                        className="btn btn-primary"
                        onClick={handleApprove}
                        disabled={isPending}
                    >
                        {isPending ? "Applying…" : "✅ Approve"}
                    </button>
                    <button
                        className="btn btn-danger"
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
                            className="btn btn-danger"
                            onClick={handleReject}
                            disabled={isPending || !notes.trim()}
                        >
                            {isPending ? "Rejecting…" : "Confirm Reject"}
                        </button>
                        <button
                            className="btn btn-secondary"
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
                    className="input border-l-[3px] border-[#f9a825] py-2 px-4 bg-[rgba(255, 193, 7, 0.05)] rounded-[0 var(--radius-md) var(--radius-md) 0] m-[var(--space-md) 0]-input"
                    placeholder="Optional admin notes…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            )}
        </div>
    );
}
