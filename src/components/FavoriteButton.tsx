"use client";

import { useState } from "react";
import { toggleFavorite } from "@/app/actions/social";

interface FavoriteButtonProps {
    horseId: string;
    initialIsFavorited: boolean;
    initialCount: number;
}

export default function FavoriteButton({
    horseId,
    initialIsFavorited,
    initialCount,
}: FavoriteButtonProps) {
    const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
    const [count, setCount] = useState(initialCount);
    const [status, setStatus] = useState<"idle" | "saving">("idle");

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (status === "saving") return;

        // Optimistic update
        const wasFavorited = isFavorited;
        const prevCount = count;
        setIsFavorited(!wasFavorited);
        setCount(wasFavorited ? prevCount - 1 : prevCount + 1);
        setStatus("saving");

        const result = await toggleFavorite(horseId);

        if (result.success) {
            setIsFavorited(result.isFavorited ?? !wasFavorited);
            setCount(result.count ?? (wasFavorited ? prevCount - 1 : prevCount + 1));
        } else {
            // Revert on error
            setIsFavorited(wasFavorited);
            setCount(prevCount);
        }

        setStatus("idle");
    };

    return (
        <button
            className={`favorite-btn ${isFavorited ? "favorited" : ""}`}
            onClick={handleClick}
            disabled={status === "saving"}
            title={isFavorited ? "Unfavorite" : "Favorite"}
            aria-label={isFavorited ? "Unfavorite" : "Favorite"}
            id={`favorite-btn-${horseId}`}
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={isFavorited ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {count > 0 && <span className="favorite-count">{count}</span>}
        </button>
    );
}
