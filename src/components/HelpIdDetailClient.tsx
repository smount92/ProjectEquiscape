"use client";

import { useState } from "react";
import Link from "next/link";
import {
    upvoteSuggestion,
    acceptSuggestion,
    addIdentifiedHorse,
    createSuggestion,
    deleteIdRequest,
} from "@/app/actions/help-id";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/social";
import { Button } from "@/components/ui/button";

/**
 * Suggestions + the ID-confirmation flow on a Help ID request.
 *
 * Restyle only: upvoting, accepting, adding the identified horse to the
 * stable, suggesting and deleting all behave exactly as before. The
 * markup was reaching for `.help-id-suggestion-card` and `.accepted`,
 * neither of which exists in the stylesheet — so every suggestion
 * rendered as unstyled text on the page background, and the ACCEPTED
 * answer looked identical to the rejected ones. That was the loudest
 * problem on a page whose whole job is showing which answer won.
 *
 * Suggestions are now ledger leaves; the accepted one wears a forest
 * ring and an "Accepted" stamp.
 */

interface Suggestion {
    id: string;
    user_id: string;
    free_text: string | null;
    upvotes: number;
    created_at: string;
    userName: string;
    catalogId: string | null;
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

    // acceptedSuggestionId is the server's record of the confirmed ID;
    // each row also carries isAccepted, so trust either.
    const hasAccepted = acceptedSuggestionId !== null;

    return (
        <div>
            {/* Suggestion List */}
            <h2 className="text-forest mt-12 mb-5 font-serif text-lg font-bold tracking-[0.14em] uppercase">
                Suggestions ({suggestions.length})
            </h2>

            {suggestions.length === 0 ? (
                <div className="ledger-card py-10 text-center">
                    <p className="text-secondary-foreground">
                        No suggestions yet. Be the first to help!
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {suggestions.map((s) => (
                        <article
                            key={s.id}
                            className={`ledger-card ${
                                s.isAccepted ? "ring-forest/45 shadow-lg ring-2" : ""
                            }`}
                            id={`suggestion-${s.id}`}
                        >
                            <div className="mb-3 flex flex-wrap items-center gap-3">
                                <UserAvatar src={null} alias={s.userName} size="sm" />
                                <span className="text-foreground text-sm font-semibold">
                                    {s.userName}
                                </span>
                                {s.isAccepted && <span className="stamp">Accepted answer</span>}
                                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                                    {new Date(s.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="mb-4">
                                {s.releaseDisplay && (
                                    <p className="text-forest mb-1 font-serif text-sm font-bold">
                                        🏷️{" "}
                                        {s.catalogId ? (
                                            <Link
                                                href={`/catalog/${s.catalogId}`}
                                                className="no-underline hover:underline"
                                            >
                                                {s.releaseDisplay}
                                            </Link>
                                        ) : (
                                            s.releaseDisplay
                                        )}
                                    </p>
                                )}
                                {s.resinDisplay && (
                                    <p className="text-forest mb-1 font-serif text-sm font-bold">
                                        🎨 {s.resinDisplay}
                                    </p>
                                )}
                                {s.free_text && (
                                    <p className="text-secondary-foreground text-sm leading-[1.6]">
                                        {s.free_text}
                                    </p>
                                )}
                            </div>

                            <div className="border-forest/15 flex flex-wrap items-center gap-3 border-t pt-3">
                                <Button
                                    variant="outline"
                                    className="text-muted-foreground"
                                    onClick={() => handleUpvote(s.id)}
                                    title="Upvote this suggestion"
                                >
                                    👍 <span className="tabular-nums">{s.upvotes}</span>
                                </Button>

                                {isOwner && !isResolved && (
                                    <button
                                        type="button"
                                        className="btn-brass"
                                        onClick={() => handleAccept(s.id)}
                                    >
                                        ✅ Accept this ID
                                    </button>
                                )}

                                {s.isAccepted && (
                                    <button
                                        type="button"
                                        className="btn-brass disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={() => handleAddToStable(s.id)}
                                        disabled={addingHorse === s.id}
                                    >
                                        {addingHorse === s.id ? (
                                            <>
                                                <span className="spinner-inline" /> Adding…
                                            </>
                                        ) : (
                                            "🐴 Add to my stable"
                                        )}
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Add Suggestion */}
            {!isResolved && (
                <div className="mt-8">
                    {!showSuggestForm ? (
                        <button
                            type="button"
                            className="btn-brass"
                            onClick={() => setShowSuggestForm(true)}
                            id="add-suggestion-btn"
                        >
                            💡 I know this model
                        </button>
                    ) : (
                        <div className="ledger-card">
                            <span className="ledger-tab">Your suggestion</span>
                            <div className="mb-4">
                                <Textarea
                                    rows={3}
                                    value={suggestText}
                                    onChange={(e) => setSuggestText(e.target.value)}
                                    placeholder="What model do you think this is? Include manufacturer, mold name, release name, model number if known..."
                                    className="resize-y"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <Button
                                    variant="outline"
                                    size="wide"
                                    className="text-muted-foreground"
                                    onClick={() => {
                                        setShowSuggestForm(false);
                                        setSuggestText("");
                                    }}
                                >
                                    Cancel
                                </Button>
                                <button
                                    type="button"
                                    className="btn-brass disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={handleSuggest}
                                    disabled={submitting || !suggestText.trim()}
                                >
                                    {submitting ? (
                                        <>
                                            <span className="spinner-inline" /> Submitting…
                                        </>
                                    ) : (
                                        "Submit suggestion"
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Resolved with no accepted row visible — the request is
                closed, so say so instead of leaving a dead section. */}
            {isResolved && !hasAccepted && (
                <div className="ledger-card mt-8 text-center">
                    <span className="stamp">Closed</span>
                    <p className="text-secondary-foreground mt-3 text-sm">
                        This request has been marked resolved.
                    </p>
                </div>
            )}

            {/* Owner: Delete Request */}
            {isOwner && (
                <div className="mt-8 text-right">
                    <Button
                        variant="destructive-outline"
                        size="wide"
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
                        🗑️ Delete request
                    </Button>
                </div>
            )}
        </div>
    );
}
