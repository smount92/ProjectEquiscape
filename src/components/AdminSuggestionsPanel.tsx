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

export default function AdminSuggestionsPanel({ suggestions }: { suggestions: Suggestion[] }) {
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
            <div
                className="bg-card border-edge rounded-lg border p-12 px-8 py-[var(--space-3xl)] text-center shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                style={{ textAlign: "center" }}
            >
                <div className="px-8-icon py-[var(--space-3xl)] text-center">✅</div>
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
                    className="bg-glass border-edge admin-message hover:opacity-[1]-unread rounded-lg border px-6 py-4 transition-all"
                >
                    <div className="bg-glass border-edge transition-all-sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge top-0 z-[100] flex items-center justify-between rounded-lg border border-b px-6 px-8 py-4 py-[0] transition-all max-sm:py-[0]">
                        <div className="bg-glass border-edge transition-all-sender rounded-lg border px-6 py-4">
                            <span className="bg-glass border-edge transition-all-name rounded-lg border px-6 py-4">
                                {typeEmoji[s.suggestion_type] || "📝"}{" "}
                                {typeLabel[s.suggestion_type] || s.suggestion_type}
                            </span>
                            <span
                                className="bg-glass border-edge transition-all-email rounded-lg border px-6 py-4"
                                style={{ cursor: "default" }}
                            >
                                {s.name}
                            </span>
                        </div>
                        <div className="bg-glass border-edge transition-all-actions rounded-lg border px-6 py-4">
                            <span className="bg-glass border-edge transition-all-date rounded-lg border px-6 py-4">
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
                        <div className="bg-glass border-edge transition-all-body rounded-lg border px-6 py-4">
                            {s.details}
                        </div>
                    )}
                    <div className="bg-glass border-edge transition-all-footer gap-2 rounded-lg border px-6 py-4">
                        <button
                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                            onClick={() => handleReview(s.id, "approved")}
                            disabled={isPending && processingId === s.id}
                        >
                            {isPending && processingId === s.id ? "…" : "✅ Approve"}
                        </button>
                        <button
                            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline transition-all duration-150"
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
