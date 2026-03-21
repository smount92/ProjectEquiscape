"use client";

import RatingStars from "@/components/RatingStars";

interface RatingBadgeProps {
    average: number;
    count: number;
}

export default function RatingBadge({ average, count }: RatingBadgeProps) {
    if (count === 0) return null;

    return (
        <span className="inline-flex items-center gap-1 py-1 px-3 rounded-md bg-[linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,179,8,0.05))] border border-[rgba(245,158,11,0.2)]" id="rating-badge" title={`${average} out of 5 — ${count} rating${count !== 1 ? "s" : ""}`}>
            <RatingStars rating={Math.round(average)} size="sm" />
            <span className="font-bold text-[calc(0.95rem*var(--font-scale))] text-[#F59E0B]">{average}</span>
            <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">({count})</span>
        </span>
    );
}
