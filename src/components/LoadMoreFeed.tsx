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
            { threshold: 0.1 }
        );

        const sentinel = sentinelRef.current;
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [cursor, loadMore]);

    return (
        <>
            <ActivityFeed items={items} emptyMessage={emptyMessage} currentUserId={currentUserId} />
            {cursor && (
                <div ref={sentinelRef} style={{ height: "1px" }} />
            )}
            {isPending && (
                <div style={{ textAlign: "center", padding: "var(--space-lg) 0", color: "var(--color-text-muted)" }}>
                    <span className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-spinner" style={{ width: 20, height: 20, display: "inline-block" }} aria-hidden="true" />
                    <span style={{ marginLeft: "var(--space-sm)" }}>Loading more…</span>
                </div>
            )}
        </>
    );
}
