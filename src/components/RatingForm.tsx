"use client";

import { useState } from"react";
import { leaveReview, deleteReview } from"@/app/actions/transactions";
import RatingStars from"@/components/RatingStars";

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
 const [status, setStatus] = useState<"idle" |"saving" |"saved" |"error" |"retracting">("idle");
 const [errorMsg, setErrorMsg] = useState("");

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (stars === 0 || status ==="saving") return;

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
 id:"pending",
 stars,
 reviewText: reviewText || null,
 createdAt: new Date().toISOString(),
 });
 } else {
 setErrorMsg(result.error ||"Failed to submit review.");
 setStatus("error");
 }
 };

 const handleRetract = async () => {
 if (!rating || status ==="retracting") return;

 setStatus("retracting");
 const result = await deleteReview(rating.id);

 if (result.success) {
 setRating(null);
 setStars(0);
 setReviewText("");
 setStatus("idle");
 } else {
 setErrorMsg(result.error ||"Failed to retract.");
 setStatus("error");
 }
 };

 // Already rated — show the existing rating
 if (rating) {
 return (
 <div className="border-edge mt-6 rounded-lg border bg-[rgba(0,0,0,0.05)] p-6" id="rating-section">
 <div className="mb-4 flex items-center gap-2 text-base font-semibold">
 <span>⭐ Your Rating for @{targetAlias}</span>
 </div>
 <div className="py-4 text-center">
 <RatingStars rating={rating.stars} size="md" />
 {rating.reviewText && (
 <p className="text-muted mt-4 text-sm italic">&ldquo;{rating.reviewText}&rdquo;</p>
 )}
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleRetract}
 disabled={status ==="retracting"}
 >
 {status ==="retracting" ?"Retracting…" :"Retract Rating"}
 </button>
 </div>
 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-danger">{errorMsg}</div>}
 </div>
 );
 }

 // Rating form
 return (
 <div className="border-edge mt-6 rounded-lg border bg-[rgba(0,0,0,0.05)] p-6" id="rating-section">
 <div className="mb-4 flex items-center gap-2 text-base font-semibold">
 <span>⭐ Rate your experience with @{targetAlias}</span>
 </div>

 {hasVerifiedTransfer === false && (
 <div
 style={{
 display:"flex",
 alignItems:"center",
 gap:"var(--space-xs)",
 padding:"var(--space-xs) var(--space-sm)",
 background:"var(--color-bg-elevated)",
 borderRadius:"var(--radius-sm)",
 fontSize: "0.75rem",
 color:"var(--color-text-muted)",
 marginBottom:"var(--space-md)",
 }}
 >
 ℹ️ No verified Hoofprint™ transfer found between you and this user.
 </div>
 )}
 <form onSubmit={handleSubmit}>
 <div className="flex justify-center py-4">
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

 <div className="mb-6">
 <textarea
 className="form-input"
 value={reviewText}
 onChange={(e) => setReviewText(e.target.value)}
 placeholder="Optional: Share details about your experience…"
 maxLength={300}
 rows={2}
 id="rating-review-text"
 />
 <div className="text-muted mt-1 text-right text-xs">{reviewText.length}/300</div>
 </div>

 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-danger mb-4">{errorMsg}</div>}

 {status ==="saved" && (
 <div className="mb-4 rounded-md border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] px-4 py-2 text-sm text-[#22C55E]">
 ✅ Rating submitted! Thank you.
 </div>
 )}

 <div className="show-record-form-actions">
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={stars === 0 || status ==="saving"}
 >
 {status ==="saving" ?"Submitting…" :"Submit Rating"}
 </button>
 </div>
 </form>
 </div>
 );
}
