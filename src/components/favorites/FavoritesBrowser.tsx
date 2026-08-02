"use client";

/**
 * /favorites client browser — renders the favorited-horses grid,
 * appends via Show More (loadMoreFavorites), and handles optimistic
 * unfavoriting with an Undo toast.
 *
 * Card markup follows the Show Ring card (photo-forward, rounded-2xl
 * ledger card) in compact form. "Unavailable" entries (horse went
 * private/unlisted or was soft-deleted since favoriting — the server
 * shipped ids ONLY, no horse fields) render as a dimmed row with a
 * remove affordance.
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, HeartOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/context/ToastContext";
import { toggleFavorite } from "@/app/actions/social";
import { loadMoreFavorites } from "@/app/actions/favorites";
import { getThumbUrl } from "@/lib/utils/imageUrl";
import type { AvailableFavorite, FavoriteEntry } from "@/lib/favorites/shape";

function formatPrice(price: number | null): string | null {
    if (price === null || price === undefined) return null;
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function favoritedOn(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function AvailableCard({
    entry,
    onUnfavorite,
}: {
    entry: AvailableFavorite;
    onUnfavorite: (entry: FavoriteEntry) => void;
}) {
    const priceLabel = formatPrice(entry.listingPrice);

    return (
        <div
            className="group rounded-2xl border border-input bg-card p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            id={`favorite-card-${entry.horseId}`}
        >
            <Link href={`/community/${entry.horseId}`} className="flex flex-col text-foreground no-underline">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
                    {entry.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={getThumbUrl(entry.thumbnailUrl)}
                            onError={(e) => {
                                // Fallback to full-res if thumb doesn't exist (older uploads)
                                (e.target as HTMLImageElement).src = entry.thumbnailUrl!;
                            }}
                            alt={entry.name}
                            loading="lazy"
                            className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                            <span className="text-4xl opacity-50">🐴</span>
                            <span className="text-xs font-medium">No photo</span>
                        </div>
                    )}
                    {entry.tradeStatus === "For Sale" && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-success px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                            💲 {priceLabel || "For Sale"}
                        </span>
                    )}
                    {entry.tradeStatus === "Open to Offers" && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-info px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                            🤝 {priceLabel ? `~${priceLabel}` : "Open to Offers"}
                        </span>
                    )}
                </div>
                <div className="mt-3 px-1">
                    <h3 className="truncate font-serif text-lg font-bold text-foreground">{entry.name}</h3>
                </div>
            </Link>

            {/* Footer — owner + unfavorite */}
            <div className="mt-2 flex items-center justify-between border-t border-input px-1 pt-2 text-xs">
                <div className="min-w-0">
                    <Link
                        href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}
                        className="block truncate text-[var(--primary)] no-underline hover:underline"
                    >
                        @{entry.ownerAlias}
                    </Link>
                    <span className="text-muted-foreground">♥ {favoritedOn(entry.favoritedAt)}</span>
                </div>
                <button
                    className="-my-1 inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-[#e74c6f] transition-colors hover:text-muted-foreground"
                    onClick={() => onUnfavorite(entry)}
                    title="Unfavorite"
                    aria-label={`Unfavorite ${entry.name}`}
                >
                    <Heart size={18} strokeWidth={2} fill="currentColor" />
                </button>
            </div>
        </div>
    );
}

export default function FavoritesBrowser({
    initialEntries,
    totalCount,
    initialHasMore,
}: {
    initialEntries: FavoriteEntry[];
    totalCount: number;
    initialHasMore: boolean;
}) {
    const [entries, setEntries] = useState<FavoriteEntry[]>(initialEntries);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loadingMore, setLoadingMore] = useState(false);
    // Rows FETCHED from the server so far (drives the next offset).
    // Unfavoriting deletes the DB row, shifting everything up one —
    // so removal decrements this too.
    const [fetchedCount, setFetchedCount] = useState(initialEntries.length);
    const { toast } = useToast();

    const removeEntry = (entry: FavoriteEntry) => {
        setEntries((prev) => prev.filter((e) => e.favoriteId !== entry.favoriteId));
        setFetchedCount((n) => Math.max(0, n - 1));
    };

    const restoreEntry = (entry: FavoriteEntry, index: number) => {
        setEntries((prev) => {
            if (prev.some((e) => e.favoriteId === entry.favoriteId)) return prev;
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, entry);
            return next;
        });
        setFetchedCount((n) => n + 1);
    };

    const handleUnfavorite = async (entry: FavoriteEntry) => {
        const index = entries.findIndex((e) => e.favoriteId === entry.favoriteId);
        removeEntry(entry); // optimistic

        const result = await toggleFavorite(entry.horseId);

        if (!result.success) {
            restoreEntry(entry, index);
            toast(result.error || "Couldn't update your Favorites. Please try again.", "error");
            return;
        }
        if (result.isFavorited) {
            // Toggle raced the other way (state drift) — keep it shown.
            restoreEntry(entry, index);
            return;
        }

        toast("Removed from your Favorites.", "info", 6000, {
            label: "Undo",
            onClick: async () => {
                restoreEntry(entry, index); // optimistic re-add
                const undone = await toggleFavorite(entry.horseId);
                if (!undone.success || !undone.isFavorited) {
                    removeEntry(entry);
                    toast("Couldn't restore that favorite. Please try again.", "error");
                }
            },
        });
    };

    const handleLoadMore = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        const result = await loadMoreFavorites({ offset: fetchedCount });
        if (result.success) {
            setEntries((prev) => {
                const seen = new Set(prev.map((e) => e.favoriteId));
                return [...prev, ...result.entries.filter((e) => !seen.has(e.favoriteId))];
            });
            setFetchedCount((n) => n + result.entries.length);
            setHasMore(result.hasMore);
        } else {
            toast(result.error || "Couldn't load more favorites. Please try again.", "error");
        }
        setLoadingMore(false);
    };

    /* ── Empty state ─────────────────────────────────────────── */
    if (entries.length === 0) {
        return (
            <div className="bg-card border-input animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
                <div className="mb-4 text-5xl">💗</div>
                <h2>No Favorites Yet</h2>
                <p>Horses you ♥ around the Show Ring land here.</p>
                <Button asChild>
                    <Link href="/community" id="favorites-empty-browse">
                        🏆 Browse the Show Ring →
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div>
            <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
                {totalCount} favorite{totalCount !== 1 ? "s" : ""}
            </p>

            <motion.div
                className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 max-[480px]:grid-cols-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {entries.map((entry) =>
                    entry.kind === "available" ? (
                        <AvailableCard key={entry.favoriteId} entry={entry} onUnfavorite={handleUnfavorite} />
                    ) : (
                        <div
                            key={entry.favoriteId}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-input bg-muted/40 p-4 opacity-70"
                            id={`favorite-unavailable-${entry.favoriteId}`}
                        >
                            <div className="min-w-0 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2 font-medium">
                                    <HeartOff size={16} strokeWidth={1.5} aria-hidden="true" />
                                    No longer available
                                </div>
                                <p className="mt-1 text-xs">
                                    This horse went private or left the Show Ring. Favorited{" "}
                                    {favoritedOn(entry.favoritedAt)}.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                className="min-h-[44px] shrink-0"
                                onClick={() => handleUnfavorite(entry)}
                                aria-label="Remove unavailable horse from Favorites"
                            >
                                Remove
                            </Button>
                        </div>
                    ),
                )}
            </motion.div>

            {hasMore && (
                <div className="mt-8 flex justify-center">
                    <Button
                        variant="outline"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        id="favorites-show-more"
                        className="min-h-[44px]"
                    >
                        {loadingMore ? "Loading…" : "Show More"}
                    </Button>
                </div>
            )}
        </div>
    );
}
