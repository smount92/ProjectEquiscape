"use client";

import { useState, useTransition } from "react";

interface ReactionBarProps {
    /** Current like state */
    isLiked: boolean;
    /** Current like count */
    likeCount: number;
    /** Toggle callback */
    onToggle: () => Promise<{ success: boolean }>;
    /** Reply count (shows button if provided) */
    replyCount?: number;
    /** Reply toggle callback */
    onReplyToggle?: () => void;
    /** Is reply section currently open? */
    isReplyOpen?: boolean;
    /** Layout variant */
    variant?: "full" | "compact";
}

export default function ReactionBar({
    isLiked,
    likeCount,
    onToggle,
    replyCount,
    onReplyToggle,
    isReplyOpen = false,
    variant = "full",
}: ReactionBarProps) {
    const [liked, setLiked] = useState(isLiked);
    const [count, setCount] = useState(likeCount);
    const [isPending, startTransition] = useTransition();

    const handleLike = () => {
        const wasLiked = liked;
        const prevCount = count;
        setLiked(!liked);
        setCount(liked ? Math.max(0, count - 1) : count + 1);

        startTransition(async () => {
            const result = await onToggle();
            if (!result.success) {
                setLiked(wasLiked);
                setCount(prevCount);
            }
        });
    };

    const compact = variant === "compact";

    return (
        <div className={`flex items-center ${compact ? "gap-2" : "gap-3"} mt-1`}>
            <button
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-sm border-none bg-transparent px-1.5 py-0.5 text-sm transition-colors hover:bg-parchment sm:min-h-0 ${liked ? "text-rose-500" : "text-muted"}`}
                onClick={handleLike}
                disabled={isPending}
                aria-label={liked ? "Unlike" : "Like"}
            >
                <span className={liked ? "animate-[heart-pop_0.3s_ease-out]" : ""}>{liked ? "❤️" : "🤍"}</span>
                {count > 0 && <span className="text-xs">{count}</span>}
            </button>
            {onReplyToggle && (
                <button
                    className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-md border border-edge bg-transparent ${compact ? "px-3 py-1" : "px-4 py-1.5"} text-sm font-medium text-muted no-underline transition-all hover:bg-parchment hover:text-ink sm:min-h-0`}
                    onClick={onReplyToggle}
                >
                    💬 {replyCount !== undefined && replyCount > 0 ? replyCount : ""} {isReplyOpen ? "▲" : "▼"}
                </button>
            )}
        </div>
    );
}
