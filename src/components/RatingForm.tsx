"use client";

import { useState } from "react";
import { leaveRating, deleteRating } from "@/app/actions/ratings";
import RatingStars from "@/components/RatingStars";

interface ExistingRating {
    id: string;
    stars: number;
    reviewText: string | null;
    createdAt: string;
}

interface RatingFormProps {
    conversationId: string;
    reviewedId: string;
    reviewedAlias: string;
    existingRating: ExistingRating | null;
    hasVerifiedTransfer?: boolean;
}

export default function RatingForm({
    conversationId,
    reviewedId,
    reviewedAlias,
    existingRating,
    hasVerifiedTransfer,
}: RatingFormProps) {
    const [rating, setRating] = useState<ExistingRating | null>(existingRating);
    const [stars, setStars] = useState(0);
    const [hoverStars, setHoverStars] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "retracting">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (stars === 0 || status === "saving") return;

        setStatus("saving");
        setErrorMsg("");

        const result = await leaveRating({
            conversationId,
            reviewedId,
            stars,
            reviewText: reviewText || undefined,
        });

        if (result.success) {
            setStatus("saved");
            setRating({
                id: "pending",
                stars,
                reviewText: reviewText || null,
                createdAt: new Date().toISOString(),
            });
        } else {
            setErrorMsg(result.error || "Failed to submit rating.");
            setStatus("error");
        }
    };

    const handleRetract = async () => {
        if (!rating || status === "retracting") return;

        setStatus("retracting");
        const result = await deleteRating(rating.id);

        if (result.success) {
            setRating(null);
            setStars(0);
            setReviewText("");
            setStatus("idle");
        } else {
            setErrorMsg(result.error || "Failed to retract.");
            setStatus("error");
        }
    };

    // Already rated — show the existing rating
    if (rating) {
        return (
            <div className="rating-form-card" id="rating-section">
                <div className="rating-form-header">
                    <span>⭐ Your Rating for @{reviewedAlias}</span>
                </div>
                <div className="rating-existing">
                    <RatingStars rating={rating.stars} size="md" />
                    {rating.reviewText && (
                        <p className="rating-existing-text">&ldquo;{rating.reviewText}&rdquo;</p>
                    )}
                    <button
                        className="btn btn-ghost rating-retract-btn"
                        onClick={handleRetract}
                        disabled={status === "retracting"}
                    >
                        {status === "retracting" ? "Retracting…" : "Retract Rating"}
                    </button>
                </div>
                {status === "error" && errorMsg && (
                    <div className="comment-error">{errorMsg}</div>
                )}
            </div>
        );
    }

    // Rating form
    return (
        <div className="rating-form-card" id="rating-section">
            <div className="rating-form-header">
                <span>⭐ Rate your experience with @{reviewedAlias}</span>
            </div>

            {hasVerifiedTransfer === false && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-xs)",
                    padding: "var(--space-xs) var(--space-sm)",
                    background: "var(--color-bg-elevated)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                    color: "var(--color-text-muted)",
                    marginBottom: "var(--space-md)",
                }}>
                    ℹ️ No verified Hoofprint™ transfer found between you and this user.
                </div>
            )}
            <form onSubmit={handleSubmit}>
                <div className="rating-form-stars">
                    <RatingStars
                        rating={stars}
                        size="lg"
                        interactive
                        onSelect={setStars}
                        hoverValue={hoverStars}
                        onHover={setHoverStars}
                        onHoverEnd={() => setHoverStars(0)}
                    />
                </div>

                <div className="form-group">
                    <textarea
                        className="form-input"
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Optional: Share details about your experience…"
                        maxLength={300}
                        rows={2}
                        id="rating-review-text"
                    />
                    <div className="rating-char-counter">
                        {reviewText.length}/300
                    </div>
                </div>

                {status === "error" && errorMsg && (
                    <div className="comment-error" style={{ marginBottom: "var(--space-md)" }}>
                        {errorMsg}
                    </div>
                )}

                {status === "saved" && (
                    <div className="comment-success" style={{ marginBottom: "var(--space-md)" }}>
                        ✅ Rating submitted! Thank you.
                    </div>
                )}

                <div className="show-record-form-actions">
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={stars === 0 || status === "saving"}
                    >
                        {status === "saving" ? "Submitting…" : "Submit Rating"}
                    </button>
                </div>
            </form>
        </div>
    );
}
