"use client";

import { useState } from "react";
import { leaveReview, deleteReview } from "@/app/actions/transactions";
import RatingStars from "@/components/RatingStars";


interface ExistingRating {
    id: string;
    stars: number;
    reviewText: string | null;
    createdAt: string;
}

interface RatingFormProps {
    transactionId: string;
    targetId: string;
    targetAlias: string;
    existingRating: ExistingRating | null;
    hasVerifiedTransfer?: boolean;
}

export default function RatingForm({
    transactionId,
    targetId,
    targetAlias,
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

        const result = await leaveReview({
            transactionId,
            targetId,
            stars,
            content: reviewText || undefined,
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
            setErrorMsg(result.error || "Failed to submit review.");
            setStatus("error");
        }
    };

    const handleRetract = async () => {
        if (!rating || status === "retracting") return;

        setStatus("retracting");
        const result = await deleteReview(rating.id);

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
            <div className="bg-[rgba(0,0,0,0.05)] border border-border rounded-lg p-lg mt-lg" id="rating-section">
                <div className="text-base font-semibold mb-md flex items-center gap-sm">
                    <span>⭐ Your Rating for @{targetAlias}</span>
                </div>
                <div className="text-center py-md">
                    <RatingStars rating={rating.stars} size="md" />
                    {rating.reviewText && (
                        <p className="mt-md italic text-text-muted text-sm">&ldquo;{rating.reviewText}&rdquo;</p>
                    )}
                    <button
                        className="btn btn-ghost mt-md text-xs text-text-muted hover:text-[#e74c6f]"
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
        <div className="bg-[rgba(0,0,0,0.05)] border border-border rounded-lg p-lg mt-lg" id="rating-section">
            <div className="text-base font-semibold mb-md flex items-center gap-sm">
                <span>⭐ Rate your experience with @{targetAlias}</span>
            </div>

            {
                hasVerifiedTransfer === false && (
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
                )
            }
            <form onSubmit={handleSubmit}>
                <div className="flex justify-center py-md">
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
                    <div className="text-right text-xs text-text-muted mt-xs">
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
        </div >
    );
}
