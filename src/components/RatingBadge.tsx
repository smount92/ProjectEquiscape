"use client";

import RatingStars from "@/components/RatingStars";

interface RatingBadgeProps {
    average: number;
    count: number;
}

export default function RatingBadge({ average, count }: RatingBadgeProps) {
    if (count === 0) return null;

    return (
        <span
            className="inline-flex items-center gap-1 rounded-md border border-[rgba(245,158,11,0.2)] bg-[linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,179,8,0.05))] px-3 py-1"
            id="rating-badge"
            title={`${average} out of 5 — ${count} rating${count !== 1 ? "s" : ""}`}
        >
            <RatingStars rating={Math.round(average)} size="sm" />
            <span className="text-[calc(0.95rem*var(--font-scale))] font-bold text-[#F59E0B]">{average}</span>
            <span className="text-muted text-[calc(0.8rem*var(--font-scale))]">({count})</span>
        </span>
    );
}
