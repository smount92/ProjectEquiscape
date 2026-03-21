"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markTransactionComplete } from "@/app/actions/messaging";

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
            setError(result.error || "Failed to mark as complete.");
        }
        setSaving(false);
    };

    if (status === "completed") {
        return (
            <div
                className="mt-4 rounded-lg border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.06)] px-6 py-4"
                id="transaction-status"
            >
                <span className="text-[calc(0.95rem*var(--font-scale))] font-semibold text-[#22C55E]">
                    ✅ Transaction Complete
                </span>
                {!hasRating && (
                    <span className="text-muted mt-2 block text-[calc(0.8rem*var(--font-scale))]">
                        Leave a rating below to close the loop! ⬇️
                    </span>
                )}
            </div>
        );
    }

    return (
        <div
            className="bg-[var(--color-bg-card border-edge transition-all-bg,rgba(0,0,0,0.05))] border-edge mt-4 rounded-lg border p-12 px-6 py-4 shadow-md max-[480px]:rounded-[var(--radius-md)]"
            id="transaction-status"
        >
            <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
                <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Transaction is open</span>
                <button
                    className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                    onClick={handleComplete}
                    disabled={saving}
                >
                    {saving ? "Completing…" : "✅ Mark as Complete"}
                </button>
            </div>
            {error && <div className="comment-error mt-2">{error}</div>}
        </div>
    );
}
