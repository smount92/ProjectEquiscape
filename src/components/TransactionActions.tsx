"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markTransactionComplete } from "@/app/actions/messaging";

interface TransactionActionsProps {
    conversationId: string;
    initialStatus: string;
    hasRating: boolean;
}

export default function TransactionActions({
    conversationId,
    initialStatus,
    hasRating,
}: TransactionActionsProps) {
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
            setError(result.error || "Failed to mark as complete.");
        }
        setSaving(false);
    };

    if (status === "completed") {
        return (
            <div className="mt-4 py-4 px-6 rounded-lg bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.2)]" id="transaction-status">
                <span className="font-semibold text-[calc(0.95rem*var(--font-scale))] text-[#22C55E]">✅ Transaction Complete</span>
                {!hasRating && (
                    <span className="block mt-2 text-[calc(0.8rem*var(--font-scale))] text-muted">
                        Leave a rating below to close the loop! ⬇️
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="mt-4 py-4 px-6 rounded-lg bg-[var(--color-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all-bg,rgba(0,0,0,0.05))] border border-edge" id="transaction-status">
            <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
                <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                    Transaction is open
                </span>
                <button
                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm"
                    onClick={handleComplete}
                    disabled={saving}
                >
                    {saving ? "Completing…" : "✅ Mark as Complete"}
                </button>
            </div>
            {error && (
                <div className="comment-error" style={{ marginTop: "var(--space-sm)" }}>
                    {error}
                </div>
            )}
        </div>
    );
}
