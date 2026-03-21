"use client";

interface RatingStarsProps {
    rating: number;
    size?: "sm" | "md" | "lg";
    interactive?: boolean;
    onSelect?: (stars: number) => void;
    hoverValue?: number;
    onHover?: (stars: number) => void;
    onHoverEnd?: () => void;
}

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function RatingStars({
    rating,
    size = "md",
    interactive = false,
    onSelect,
    hoverValue,
    onHover,
    onHoverEnd,
}: RatingStarsProps) {
    const displayValue = hoverValue && hoverValue > 0 ? hoverValue : rating;

    return (
        <div
            className={`rating-stars rating-stars-${size} ${interactive ? "rating-stars-interactive" : ""}`}
            onMouseLeave={onHoverEnd}
        >
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    className={`rating-star ${star <= displayValue ? "rating-star-filled" : "rating-star-empty"}`}
                    onClick={interactive ? () => onSelect?.(star) : undefined}
                    onMouseEnter={interactive ? () => onHover?.(star) : undefined}
                    role={interactive ? "button" : undefined}
                    aria-label={interactive ? `${star} star${star > 1 ? "s" : ""} — ${STAR_LABELS[star]}` : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onKeyDown={
                        interactive
                            ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") onSelect?.(star);
                              }
                            : undefined
                    }
                >
                    ★
                </span>
            ))}
            {interactive && displayValue > 0 && (
                <span className="ml-2 text-[calc(0.85rem*var(--font-scale))] font-medium text-[#F59E0B]">
                    {STAR_LABELS[displayValue]}
                </span>
            )}
        </div>
    );
}
