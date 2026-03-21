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
            <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8" style={{ textAlign: "center" }}>
                <div className="text-center py-[var(--space-3xl)] px-8-icon">✅</div>
                <h2>No Pending Suggestions</h2>
                <p>All database suggestions have been reviewed.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {items.map((s) => (
                <div
                    key={s.id}
                    className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all admin-message hover:opacity-[1]-unread"
                >
                    <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                        <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-sender">
                            <span className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-name">
                                {typeEmoji[s.suggestion_type] || "📝"}{" "}
                                {typeLabel[s.suggestion_type] || s.suggestion_type}
                            </span>
                            <span className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-email" style={{ cursor: "default" }}>
                                {s.name}
                            </span>
                        </div>
                        <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-actions">
                            <span className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-date">
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
                        <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-body">{s.details}</div>
                    )}
                    <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-footer gap-2">
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm"
                            onClick={() => handleReview(s.id, "approved")}
                            disabled={isPending && processingId === s.id}
                        >
                            {isPending && processingId === s.id ? "…" : "✅ Approve"}
                        </button>
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
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
