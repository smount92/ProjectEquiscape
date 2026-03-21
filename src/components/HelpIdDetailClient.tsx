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
            <h2 style={{ fontSize: "calc(var(--font-size-lg) * var(--font-scale))", fontWeight: 700, marginBottom: "var(--space-lg)", marginTop: "var(--space-2xl)" }}>
                💬 Suggestions ({suggestions.length})
            </h2>

            {suggestions.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
                    <p style={{ color: "var(--color-text-muted)" }}>No suggestions yet. Be the first to help!</p>
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
                                <span className="help-id-suggestion-user">{s.userName}</span>
                                {s.isAccepted && <span className="help-id-accepted-badge">✅ Accepted Answer</span>}
                                <span className="help-id-suggestion-date">
                                    {new Date(s.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="mb-4">
                                {s.releaseDisplay && (
                                    <p className="help-id-suggestion-reference">🏷️ {s.releaseDisplay}</p>
                                )}
                                {s.resinDisplay && (
                                    <p className="help-id-suggestion-reference">🎨 {s.resinDisplay}</p>
                                )}
                                {s.free_text && (
                                    <p className="help-id-suggestion-text">{s.free_text}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    className="btn btn-ghost help-id-upvote-btn"
                                    onClick={() => handleUpvote(s.id)}
                                    title="Upvote this suggestion"
                                >
                                    👍 {s.upvotes}
                                </button>

                                {isOwner && !isResolved && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleAccept(s.id)}
                                        style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
                                    >
                                        ✅ Accept
                                    </button>
                                )}

                                {s.isAccepted && (
                                    <button
                                        className="btn btn-primary"
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
                <div style={{ marginTop: "var(--space-xl)" }}>
                    {!showSuggestForm ? (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowSuggestForm(true)}
                            id="add-suggestion-btn"
                        >
                            💡 I Know This Model
                        </button>
                    ) : (
                        <div className="card" style={{ padding: "var(--space-lg)" }}>
                            <h3 style={{ marginBottom: "var(--space-md)" }}>Your Suggestion</h3>
                            <div className="form-group">
                                <textarea
                                    className="form-textarea"
                                    rows={3}
                                    value={suggestText}
                                    onChange={(e) => setSuggestText(e.target.value)}
                                    placeholder="What model do you think this is? Include manufacturer, mold name, release name, model number if known..."
                                    style={{ resize: "vertical" }}
                                />
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-md)" }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => {
                                        setShowSuggestForm(false);
                                        setSuggestText("");
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
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
                <div style={{ marginTop: "var(--space-xl)", textAlign: "right" }}>
                    <button
                        className="btn btn-ghost"
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
