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
    emptyMessage?: string;
    /** Admin viewer: shows the pin/unpin control on posts. */
    viewerIsAdmin?: boolean;
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
 *
 * Surface (2026-08): the stream used to sit inside a deep-leather
 * panel, which turned every post into a bright white block floating
 * on brown. It now sits on the page's parchment and each post is a
 * ledger leaf — the same paper as the barn notice board and the
 * event page, so the Paddock reads as one room rather than a
 * separate app pasted into the site.
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
    emptyMessage,
    viewerIsAdmin = false,
}: FeedStreamProps) {
    const router = useRouter();

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
        <div className="relative">
            {showComposer && (
                <FeedComposer
                    visibilityEnabled={visibilityEnabled}
                    onPosted={({ postId, content, imagePreviews, visibility }) => {
                        setItems((prev) => [
                            {
                                id: postId || `pending-${Date.now()}`,
                                source: "post",
                                kind: "user",
                                isPinned: false,
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

            {/* Section rule in the site's heading vocabulary — the brass
                bar reads on parchment the way ExplorerLayout's own
                headings do. */}
            <div className="brass-heading mt-8 mb-4">
                <span className="brass-heading-bar" aria-hidden="true" />
                <h3 className="text-secondary-foreground m-0 text-sm">
                    {label} ({items.length}
                    {cursor ? "+" : ""})
                </h3>
            </div>

            {items.length === 0 ? (
                <p className="ledger-card text-muted-foreground m-0 text-sm italic">
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
                            onRemoved={handleRemoved}
                            viewerIsAdmin={viewerIsAdmin}
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
