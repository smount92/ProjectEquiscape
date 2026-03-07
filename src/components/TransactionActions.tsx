"use client";

import { useState } from "react";
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

    const handleComplete = async () => {
        setSaving(true);
        setError("");
        const result = await markTransactionComplete(conversationId);
        if (result.success) {
            setStatus("completed");
        } else {
            setError(result.error || "Failed to mark as complete.");
        }
        setSaving(false);
    };

    if (status === "completed") {
        return (
            <div className="transaction-status-card transaction-complete" id="transaction-status">
                <span className="transaction-badge">✅ Transaction Complete</span>
                {!hasRating && (
                    <span className="transaction-rate-cta">
                        Leave a rating below to close the loop! ⬇️
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="transaction-status-card" id="transaction-status">
            <div className="transaction-open">
                <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                    Transaction is open
                </span>
                <button
                    className="btn btn-primary btn-sm"
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
