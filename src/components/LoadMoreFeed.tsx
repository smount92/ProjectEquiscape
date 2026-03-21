"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { getActivityFeed, getFollowingFeed } from "@/app/actions/activity";
import ActivityFeed, { type FeedItemData } from "./ActivityFeed";

interface LoadMoreFeedProps {
    initialItems: FeedItemData[];
    initialCursor: string | null;
    feedType: "global" | "following";
    emptyMessage?: string;
    currentUserId?: string;
}

export default function LoadMoreFeed({
    initialItems,
    initialCursor,
    feedType,
    emptyMessage,
    currentUserId,
}: LoadMoreFeedProps) {
    const [items, setItems] = useState(initialItems);
    const [cursor, setCursor] = useState(initialCursor);
    const [isPending, startTransition] = useTransition();
    const sentinelRef = useRef<HTMLDivElement>(null);

    const loadMore = useCallback(() => {
        if (!cursor || isPending) return;
        startTransition(async () => {
            const fetcher = feedType === "following" ? getFollowingFeed : getActivityFeed;
            const { items: newItems, nextCursor } = await fetcher(30, cursor);
            setItems((prev) => [...prev, ...newItems]);
            setCursor(nextCursor);
        });
    }, [cursor, isPending, feedType, startTransition]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        if (!cursor || !sentinelRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { threshold: 0.1 },
        );

        const sentinel = sentinelRef.current;
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [cursor, loadMore]);

    return (
        <>
            <ActivityFeed items={items} emptyMessage={emptyMessage} currentUserId={currentUserId} />
            {cursor && <div ref={sentinelRef} className="h-[1px]" />}
            {isPending && (
                <div className="p-[var(--space-lg) 0] text-muted" style={{ textAlign: "center" }}>
                    <span
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
                        aria-hidden="true"
                    />
                    <span className="ml-2">Loading more…</span>
                </div>
            )}
        </>
    );
}
