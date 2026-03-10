"use client";

import { useState, useTransition } from "react";

interface LikeToggleProps {
    initialLiked: boolean;
    initialCount: number;
    onToggle: () => Promise<{ success: boolean; action?: string; error?: string }>;
}

export default function LikeToggle({ initialLiked, initialCount, onToggle }: LikeToggleProps) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        // Optimistic update
        const wasLiked = liked;
        const prevCount = count;
        setLiked(!liked);
        setCount(liked ? Math.max(0, count - 1) : count + 1);

        startTransition(async () => {
            const result = await onToggle();
            if (!result.success) {
                // Revert on failure
                setLiked(wasLiked);
                setCount(prevCount);
            }
        });
    };

    return (
        <button
            className={`like-toggle ${liked ? "like-toggle-active" : ""}`}
            onClick={handleClick}
            disabled={isPending}
            aria-label={liked ? "Unlike" : "Like"}
        >
            <span className={`like-heart ${liked ? "like-heart-pop" : ""}`}>
                {liked ? "❤️" : "🤍"}
            </span>
            {count > 0 && <span className="like-count">{count}</span>}
        </button>
    );
}
