"use client";

/**
 * Show Ring v2 browser — the client orchestrator for /community.
 * Wires the ledger filter bar to the URL (single source of truth:
 * router.push, so paging and the back button step filters instead of
 * wiping them), renders the community grid from server data, and
 * appends via Show More (loadMoreShowRing).
 *
 * This is a FILTER rebuild: the card markup is the existing Show Ring
 * card, unchanged except that the badge palette now comes from
 * src/lib/stable/badges.ts (night-safe tokens) instead of the old
 * light-only duplicate map. Selection-free page — no bulk ops here
 * (we're browsing OTHERS' horses).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import ShowRingFilterBar from "@/components/showring/ShowRingFilterBar";
import WishlistButton from "@/components/WishlistButton";
import FavoriteButton from "@/components/FavoriteButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getThumbUrl } from "@/lib/utils/imageUrl";
import { finishBadgeClass } from "@/lib/stable/badges";
import {
    buildShowRingSearchParams,
    countActiveShowRingFilters,
    type ShowRingFilters,
} from "@/lib/showring/filterParams";
import type { ShowRingCard, ShowRingFacetOptions } from "@/lib/showring/types";
import { loadMoreShowRing } from "@/app/actions/showring";

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
} as const;

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 300, damping: 30 },
    },
};

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(price: number | null): string | null {
    if (price === null || price === undefined) return null;
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Shared within the last 48 hours (same NEW-badge rule as legacy). */
function isNewSince(dateStr: string): boolean {
    return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
}

function ShowRingHorseCard({ horse }: { horse: ShowRingCard }) {
    const priceLabel = formatPrice(horse.listingPrice);
    const isListed = horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers";
    const isNew = isNewSince(horse.createdAt);

    return (
        <div
            className="group rounded-2xl border border-input bg-card p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            id={`community-card-${horse.id}`}
        >
            <Link href={`/community/${horse.id}`} className="flex flex-col text-foreground no-underline">
                {/* Image container — locked aspect ratio */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
                    {horse.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={getThumbUrl(horse.thumbnailUrl)}
                            onError={(e) => {
                                // Fallback to full-res if thumb doesn't exist (older uploads)
                                (e.target as HTMLImageElement).src = horse.thumbnailUrl!;
                            }}
                            alt={horse.customName}
                            loading="lazy"
                            className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                            <span className="text-4xl opacity-50">🐴</span>
                            <span className="text-xs font-medium">No photo</span>
                        </div>
                    )}

                    {/* Overlay badges — token washes (night-safe), not raw palettes */}
                    {isNew && (
                        <span className="absolute top-2 left-2 rounded-full bg-warning px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-white uppercase shadow-sm">
                            NEW
                        </span>
                    )}
                    {horse.assetCategory && horse.assetCategory !== "model" && (
                        <span className="absolute top-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                            {horse.assetCategory === "tack" ? "🏇" : horse.assetCategory === "prop" ? "🌲" : "🎭"}
                        </span>
                    )}
                    {horse.tradeStatus === "For Sale" && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-success px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                            💲 {priceLabel || "For Sale"}
                        </span>
                    )}
                    {horse.tradeStatus === "Open to Offers" && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-info px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                            🤝 {priceLabel ? `~${priceLabel}` : "Open to Offers"}
                        </span>
                    )}
                </div>

                {/* Content area */}
                <div className="mt-3 px-1">
                    <h3 className="truncate font-serif text-lg font-bold text-foreground">
                        {horse.customName}
                        {horse.hoofprintCount > 0 && (
                            <span
                                className="ml-1.5 inline-block rounded-full bg-warning/15 px-1.5 py-0.5 align-middle text-[0.6rem] font-semibold text-warning"
                                title="Has Hoofprint"
                            >
                                🐾
                            </span>
                        )}
                    </h3>
                    <p className="truncate text-sm text-secondary-foreground">{horse.refName}</p>

                    {/* Badge row — shared night-safe finish palette */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge className={finishBadgeClass(horse.finishType)}>{horse.finishType}</Badge>
                    </div>

                    {/* Metadata line */}
                    <div className="mt-2 flex items-center gap-2 text-xs text-secondary-foreground">
                        <span>{timeAgo(horse.createdAt)}</span>
                        {horse.sculptor && <span>· ✂️ {horse.sculptor}</span>}
                    </div>

                    {isListed && horse.marketplaceNotes && (
                        <div
                            className="mt-1.5 truncate rounded-md bg-muted px-2 py-1 text-xs text-secondary-foreground"
                            title={horse.marketplaceNotes}
                        >
                            📝{" "}
                            {horse.marketplaceNotes.length > 60
                                ? horse.marketplaceNotes.slice(0, 60) + "…"
                                : horse.marketplaceNotes}
                        </div>
                    )}
                </div>
            </Link>

            {/* Footer — owner + actions */}
            <div className="mt-3 flex items-center justify-between border-t border-input px-1 pt-2.5 text-xs">
                <Link
                    href={`/profile/${encodeURIComponent(horse.ownerAlias)}`}
                    className="flex items-center gap-1 truncate text-[var(--primary)] no-underline hover:underline"
                >
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    @{horse.ownerAlias}
                </Link>
                <div className="flex items-center gap-1">
                    <FavoriteButton
                        horseId={horse.id}
                        initialIsFavorited={horse.isFavorited}
                        initialCount={horse.favoriteCount}
                    />
                    {/* WishlistButton no-ops (renders nothing) on null catalogId */}
                    <WishlistButton catalogId={horse.catalogId} />
                </div>
            </div>
        </div>
    );
}

export default function ShowRingBrowser({
    initialCards,
    totalCount,
    initialHasMore,
    facetOptions,
    filters,
}: {
    initialCards: ShowRingCard[];
    /** Public horses matching the current filters (exact, blocked excluded in SQL). */
    totalCount: number;
    initialHasMore: boolean;
    facetOptions: ShowRingFacetOptions;
    filters: ShowRingFilters;
}) {
    const router = useRouter();
    const [cards, setCards] = useState<ShowRingCard[]>(initialCards);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loadingMore, setLoadingMore] = useState(false);

    // Server re-rendered with new data (filter/sort change or refresh):
    // replace the loaded set.
    useEffect(() => {
        setCards(initialCards);
        setHasMore(initialHasMore);
    }, [initialCards, initialHasMore]);

    // ── URL is the single source of truth ──
    const pushFilters = useCallback(
        (next: ShowRingFilters) => {
            const qs = buildShowRingSearchParams(next).toString();
            router.push(qs ? `/community?${qs}` : "/community");
        },
        [router],
    );

    // ── Show More: appends below; filters and scroll stay put ──
    const handleLoadMore = useCallback(async () => {
        setLoadingMore(true);
        try {
            const result = await loadMoreShowRing({ ...filters, offset: cards.length });
            if (result.success) {
                setCards((prev) => [...prev, ...result.cards]);
                setHasMore(result.hasMore);
            }
        } finally {
            setLoadingMore(false);
        }
    }, [cards.length, filters]);

    const activeCount = countActiveShowRingFilters(filters);

    return (
        <>
            <ShowRingFilterBar
                filters={filters}
                facetOptions={facetOptions}
                onFiltersChange={pushFilters}
            />

            {/* Result line */}
            <div className="mt-3 mb-4 pl-1 text-sm text-muted-foreground italic" id="showring-result-line">
                {activeCount > 0 ? (
                    <>
                        <b className="text-foreground not-italic">{totalCount}</b> model
                        {totalCount === 1 ? "" : "s"} match
                    </>
                ) : (
                    <>
                        <b className="text-foreground not-italic">{totalCount}</b> public model
                        {totalCount === 1 ? "" : "s"}
                    </>
                )}
            </div>

            {cards.length === 0 && activeCount === 0 ? (
                /* True-empty ring: nothing public yet */
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-input bg-muted/50 p-16">
                    <span className="mb-4 text-6xl">🏟️</span>
                    <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">
                        The Show Ring is Empty
                    </h2>
                    <p className="mb-6 max-w-sm text-center text-muted-foreground">
                        No models have been shared yet. Be the first to showcase your collection!
                    </p>
                    <Button asChild>
                        <Link href="/add-horse">🐴 Add to Stable</Link>
                    </Button>
                </div>
            ) : cards.length === 0 ? (
                /* Filtered-empty: keep the bar so the filters can be loosened */
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-input bg-muted/50 p-16">
                    <span className="mb-4 text-6xl">🔍</span>
                    <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">No Results</h2>
                    <p className="max-w-sm text-center text-muted-foreground">
                        No models match these filters. Loosen one, or clear all.
                    </p>
                </div>
            ) : (
                <motion.div
                    className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {cards.map((horse) => (
                        <motion.div key={horse.id} variants={cardVariants}>
                            <ShowRingHorseCard horse={horse} />
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Show More — appends; nothing above is lost */}
            {cards.length > 0 && hasMore && (
                <div className="mt-10 flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                        Showing {cards.length} of {totalCount} models
                    </p>
                    <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="btn-brass disabled:cursor-not-allowed disabled:opacity-60"
                        id="showring-show-more"
                    >
                        {loadingMore ? "Loading…" : "🐴 Show More Models"}
                    </button>
                </div>
            )}
            {cards.length > 0 && !hasMore && totalCount > 24 && (
                <p className="mt-8 text-center text-sm text-muted-foreground">
                    You&apos;ve seen all {totalCount} models in the Show Ring 🏆
                </p>
            )}
        </>
    );
}
