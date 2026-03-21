"use client";

import { useState } from "react";
import { upvoteSuggestion, acceptSuggestion, addIdentifiedHorse, createSuggestion, deleteIdRequest } from "@/app/actions/help-id";
import { useRouter } from "next/navigation";

interface Suggestion {
    id: string;
    user_id: string;
    free_text: string | null;
    upvotes: number;
    created_at: string;
    userName: string;
    releaseDisplay: string | null;
    resinDisplay: string | null;
    isAccepted: boolean;
}

interface HelpIdDetailClientProps {
    requestId: string;
    isOwner: boolean;
    isResolved: boolean;
    acceptedSuggestionId: string | null;
    suggestions: Suggestion[];
}

export default function HelpIdDetailClient({
    requestId,
    isOwner,
    isResolved,
    acceptedSuggestionId,
    suggestions: initialSuggestions,
}: HelpIdDetailClientProps) {
    const router = useRouter();
    const [suggestions, setSuggestions] = useState(initialSuggestions);
    const [showSuggestForm, setShowSuggestForm] = useState(false);
    const [suggestText, setSuggestText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [addingHorse, setAddingHorse] = useState<string | null>(null);

    const handleUpvote = async (suggestionId: string) => {
        // Optimistic update
        setSuggestions((prev) =>
            prev.map((s) => (s.id === suggestionId ? { ...s, upvotes: s.upvotes + 1 } : s))
        );
        await upvoteSuggestion(suggestionId);
    };

    const handleAccept = async (suggestionId: string) => {
        const result = await acceptSuggestion(requestId, suggestionId);
        if (result.success) {
            router.refresh();
        }
    };

    const handleAddToStable = async (suggestionId: string) => {
        setAddingHorse(suggestionId);
        const result = await addIdentifiedHorse(suggestionId);
        setAddingHorse(null);
        if (result.success) {
            router.push(`/dashboard?toast=Horse added to your stable!`);
        }
    };

    const handleSuggest = async () => {
        if (!suggestText.trim()) return;
        setSubmitting(true);
        const result = await createSuggestion(requestId, { freeText: suggestText });
        setSubmitting(false);
        if (result.success) {
            setSuggestText("");
            setShowSuggestForm(false);
            router.refresh();
        }
    };

    return (
        <div>
            {/* Suggestion List */}
            <h2 className="text-lg font-bold mb-6 mt-12" >
                💬 Suggestions ({suggestions.length})
            </h2>

            {suggestions.length === 0 ? (
                <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all p-8" style={{ textAlign: "center" }}>
                    <p className="text-muted" >No suggestions yet. Be the first to help!</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {suggestions.map((s) => (
                        <div
                            key={s.id}
                            className={`help-id-suggestion-card ${s.isAccepted ? "accepted" : ""}`}
                            id={`suggestion-${s.id}`}
                        >
                            <div className="flex items-center gap-4 mb-4 flex-wrap">
                                <span className="font-semibold text-sm text-ink">{s.userName}</span>
                                {s.isAccepted && <span className="py-[2px] px-[10px] bg-[rgba(92, 224, 160, 0.15)] text-success rounded-full text-xs font-semibold">✅ Accepted Answer</span>}
                                <span className="text-xs text-muted ml-auto">
                                    {new Date(s.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="mb-4">
                                {s.releaseDisplay && (
                                    <p className="text-sm text-forest font-semibold mb-1">🏷️ {s.releaseDisplay}</p>
                                )}
                                {s.resinDisplay && (
                                    <p className="text-sm text-forest font-semibold mb-1">🎨 {s.resinDisplay}</p>
                                )}
                                {s.free_text && (
                                    <p className="text-sm text-[var(--color-text-secondary)] leading-[1.6]">{s.free_text}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge inline-flex items-center gap-1 tabular-nums"
                                    onClick={() => handleUpvote(s.id)}
                                    title="Upvote this suggestion"
                                >
                                    👍 {s.upvotes}
                                </button>

                                {isOwner && !isResolved && (
                                    <button
                                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                        onClick={() => handleAccept(s.id)}
                                        style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
                                    >
                                        ✅ Accept
                                    </button>
                                )}

                                {s.isAccepted && (
                                    <button
                                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                        onClick={() => handleAddToStable(s.id)}
                                        disabled={addingHorse === s.id}
                                    >
                                        {addingHorse === s.id ? (
                                            <>
                                                <span className="spinner-inline" /> Adding…
                                            </>
                                        ) : (
                                            "🐴 Add to My Stable"
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Suggestion */}
            {!isResolved && (
                <div className="mt-8" >
                    {!showSuggestForm ? (
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                            onClick={() => setShowSuggestForm(true)}
                            id="add-suggestion-btn"
                        >
                            💡 I Know This Model
                        </button>
                    ) : (
                        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all p-6">
                            <h3 className="mb-4" >Your Suggestion</h3>
                            <div className="mb-6">
                                <textarea
                                    className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150"
                                    rows={3}
                                    value={suggestText}
                                    onChange={(e) => setSuggestText(e.target.value)}
                                    placeholder="What model do you think this is? Include manufacturer, mold name, release name, model number if known..."
                                    style={{ resize: "vertical" }}
                                />
                            </div>
                            <div className="gap-4" style={{ display: "flex" }}>
                                <button
                                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                                    onClick={() => {
                                        setShowSuggestForm(false);
                                        setSuggestText("");
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                    onClick={handleSuggest}
                                    disabled={submitting || !suggestText.trim()}
                                >
                                    {submitting ? (
                                        <>
                                            <span className="spinner-inline" /> Submitting…
                                        </>
                                    ) : (
                                        "Submit Suggestion"
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* Owner: Delete Request */}
            {isOwner && (
                <div className="mt-8" style={{ textAlign: "right" }}>
                    <button
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                        style={{ color: "red" }}
                        onClick={async () => {
                            if (confirm("Delete this Help ID request? This cannot be undone.")) {
                                const result = await deleteIdRequest(requestId);
                                if (result.success) {
                                    router.push("/community/help-id");
                                } else {
                                    alert(result.error || "Failed to delete");
                                }
                            }
                        }}
                    >
                        🗑️ Delete Request
                    </button>
                </div>
            )}
        </div>
    );
}
