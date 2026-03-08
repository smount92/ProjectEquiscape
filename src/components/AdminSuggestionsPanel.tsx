"use client";

import { useState, useTransition } from "react";
import { reviewSuggestion } from "@/app/actions/suggestions";

interface Suggestion {
    id: string;
    suggestion_type: "mold" | "release" | "resin";
    name: string;
    details: string | null;
    status: string;
    created_at: string;
    submitted_by: string;
    admin_notes: string | null;
}

export default function AdminSuggestionsPanel({
    suggestions,
}: {
    suggestions: Suggestion[];
}) {
    const [items, setItems] = useState(suggestions);
    const [isPending, startTransition] = useTransition();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleReview = (id: string, status: "approved" | "rejected") => {
        setProcessingId(id);
        startTransition(async () => {
            const { success } = await reviewSuggestion(id, status);
            if (success) {
                setItems((prev) => prev.filter((s) => s.id !== id));
            }
            setProcessingId(null);
        });
    };

    const typeEmoji: Record<string, string> = {
        mold: "🐴",
        release: "📦",
        resin: "🎨",
    };

    const typeLabel: Record<string, string> = {
        mold: "Mold",
        release: "Release",
        resin: "Artist Resin",
    };

    if (items.length === 0) {
        return (
            <div className="card shelf-empty" style={{ textAlign: "center" }}>
                <div className="shelf-empty-icon">✅</div>
                <h2>No Pending Suggestions</h2>
                <p>All database suggestions have been reviewed.</p>
            </div>
        );
    }

    return (
        <div className="admin-mailbox">
            {items.map((s) => (
                <div
                    key={s.id}
                    className="admin-message admin-message-unread"
                >
                    <div className="admin-message-header">
                        <div className="admin-message-sender">
                            <span className="admin-message-name">
                                {typeEmoji[s.suggestion_type] || "📝"}{" "}
                                {typeLabel[s.suggestion_type] || s.suggestion_type}
                            </span>
                            <span className="admin-message-email" style={{ cursor: "default" }}>
                                {s.name}
                            </span>
                        </div>
                        <div className="admin-message-actions">
                            <span className="admin-message-date">
                                {new Date(s.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                })}
                            </span>
                        </div>
                    </div>
                    {s.details && (
                        <div className="admin-message-body">{s.details}</div>
                    )}
                    <div className="admin-message-footer" style={{ gap: "var(--space-sm)" }}>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleReview(s.id, "approved")}
                            disabled={isPending && processingId === s.id}
                        >
                            {isPending && processingId === s.id ? "…" : "✅ Approve"}
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleReview(s.id, "rejected")}
                            disabled={isPending && processingId === s.id}
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            ❌ Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
