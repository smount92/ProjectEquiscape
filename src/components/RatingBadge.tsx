"use client";

import RatingStars from "@/components/RatingStars";

interface RatingBadgeProps {
    average: number;
    count: number;
}

export default function RatingBadge({ average, count }: RatingBadgeProps) {
    if (count === 0) return null;

    return (
        <span className="rating-badge" id="rating-badge" title={`${average} out of 5 — ${count} rating${count !== 1 ? "s" : ""}`}>
            <RatingStars rating={Math.round(average)} size="sm" />
            <span className="rating-badge-avg">{average}</span>
            <span className="rating-badge-count">({count})</span>
        </span>
    );
}
