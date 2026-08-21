"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getFeedStream, type FeedScope, type FeedStreamItem } from "@/app/actions/posts";
import FeedComposer from "@/components/feed/FeedComposer";
import FeedPostCard from "@/components/feed/FeedPostCard";
import { Button } from "@/components/ui/button";

interface FeedStreamProps {
    initialItems: FeedStreamItem[];
    initialCursor: string | null;
    initialAliases: string[];
    scope: FeedScope;
    currentUserId: string;
    currentUserAlias: string;
    currentUserAvatar: string | null;
    visibilityEnabled: boolean;
    showComposer?: boolean;
    label?: string;
    variant?: "default" | "leather";
    emptyMessage?: string;
}

/**
 * The one feed.
 *
 * Everything the site produces socially arrives here in one
 * chronological stream: posts written in the composer, comments on
 * public horses, posts in public groups, and shows announcing their
 * results — plus the legacy activity_events text posts interleaved
 * read-only so nothing written before the merge disappears.
 *
 * Load-more rather than infinite scroll: at this traffic level a
 * button is honest about where the end is, and it doesn't fight the
 * back button.
 */
export default function FeedStream({
    initialItems,
    initialCursor,
    initialAliases,
    scope,
    currentUserId,
    currentUserAlias,
    currentUserAvatar,
    visibilityEnabled,
    showComposer = true,
    label = "Community Posts",
    variant = "leather",
    emptyMessage,
}: FeedStreamProps) {
    const router = useRouter();
    const isLeather = variant === "leather";

    const [items, setItems] = useState(initialItems);
    const [cursor, setCursor] = useState(initialCursor);
    const [aliases, setAliases] = useState<string[]>(initialAliases);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !cursor) return;
        setIsLoadingMore(true);
        try {
            const page = await getFeedStream({ scope, cursor });
            const seen = new Set(items.map((i) => i.id));
            const fresh = page.items.filter((i) => !seen.has(i.id));
            setItems((prev) => [...prev, ...fresh]);
            setAliases((prev) => [...new Set([...prev, ...page.knownAliases])]);
            setCursor(page.nextCursor);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, cursor, scope, items]);

    const handleRemoved = (id: string) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    return (
        <div className={isLeather ? "relative" : "mt-6 rounded-lg border border-input bg-card p-6 shadow-md"}>
            {isLeather ? (
                <h3 className="feed-leather-label mb-4">
                    {label} ({items.length}
                    {cursor ? "+" : ""})
                </h3>
            ) : (
                <div className="brass-heading mb-4">
                    <span className="brass-heading-bar" aria-hidden="true" />
                    <h3 className="m-0">
                        {label} ({items.length}
                        {cursor ? "+" : ""})
                    </h3>
                </div>
            )}

            {showComposer && (
                <FeedComposer
                    visibilityEnabled={visibilityEnabled}
                    onPosted={({ postId, content, imagePreviews, visibility }) => {
                        setItems((prev) => [
                            {
                                id: postId || `pending-${Date.now()}`,
                                source: "post",
                                kind: "user",
                                authorId: currentUserId,
                                authorAlias: currentUserAlias,
                                authorAvatarUrl: currentUserAvatar,
                                content,
                                createdAt: new Date().toISOString(),
                                updatedAt: null,
                                likesCount: 0,
                                isLikedByMe: false,
                                repliesCount: 0,
                                replies: [],
                                media: imagePreviews.map((url, i) => ({
                                    id: `temp-${i}`,
                                    imageUrl: url,
                                    caption: null,
                                })),
                                visibility,
                                context: null,
                                canEdit: true,
                                canDelete: true,
                            },
                            ...prev,
                        ]);
                        router.refresh();
                    }}
                />
            )}

            {items.length === 0 ? (
                <p
                    className={`my-4 font-medium ${
                        isLeather ? "feed-leather-note text-center" : "text-muted-foreground"
                    }`}
                >
                    {emptyMessage ?? "Nothing here yet — be the first to post!"}
                </p>
            ) : (
                <div className="flex flex-col gap-5">
                    {items.map((item) => (
                        <FeedPostCard
                            key={`${item.source}-${item.id}`}
                            item={item}
                            currentUserId={currentUserId}
                            currentUserAlias={currentUserAlias}
                            currentUserAvatar={currentUserAvatar}
                            knownAliases={aliases}
                            variant={variant}
                            onRemoved={handleRemoved}
                        />
                    ))}
                </div>
            )}

            {cursor && (
                <div className="mt-6 flex justify-center">
                    <Button variant="outline" size="wide" onClick={loadMore} disabled={isLoadingMore}>
                        {isLoadingMore ? "Loading…" : "Load more"}
                    </Button>
                </div>
            )}
        </div>
    );
}
