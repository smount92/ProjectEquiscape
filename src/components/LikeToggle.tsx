"use client";

import { useState, useTransition } from"react";

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
 className={`text-muted inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-sm border-none bg-transparent px-1.5 py-0.5 text-sm transition-colors hover:bg-parchment sm:min-h-0 ${liked ? "text-rose-500" : ""}`}
 onClick={handleClick}
 disabled={isPending}
 aria-label={liked ?"Unlike" :"Like"}
 >
 <span className={liked ?"animate-[heart-pop_0.3s_ease-out]" :""}>{liked ?"❤️" :"🤍"}</span>
 {count > 0 && <span className="text-xs">{count}</span>}
 </button>
 );
}
