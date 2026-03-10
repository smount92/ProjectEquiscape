"use client";

import { useState, useTransition } from "react";
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

    const loadMore = () => {
        if (!cursor) return;
        startTransition(async () => {
            const fetcher = feedType === "following" ? getFollowingFeed : getActivityFeed;
            const { items: newItems, nextCursor } = await fetcher(30, cursor);
            setItems((prev) => [...prev, ...newItems]);
            setCursor(nextCursor);
        });
    };

    return (
        <>
            <ActivityFeed items={items} emptyMessage={emptyMessage} currentUserId={currentUserId} />
            {cursor && (
                <div style={{ textAlign: "center", padding: "var(--space-xl) 0" }}>
                    <button
                        className="btn btn-secondary"
                        onClick={loadMore}
                        disabled={isPending}
                    >
                        {isPending ? "Loading…" : "Load More"}
                    </button>
                </div>
            )}
        </>
    );
}
