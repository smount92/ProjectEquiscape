"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { loadMoreProfileHorses, type ProfileHorseCard } from "@/app/actions/profile";

interface Props {
    userId: string;
    initialOffset: number;
    totalCount: number;
}

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 });
}

/**
 * ProfileLoadMore — sits inside the profile's wood `.shelfwrap`.
 * Loaded horses render as an additional scrollable `.shelf-strip`
 * of polaroids matching the SSR strip above it.
 */
export default function ProfileLoadMore({ userId, initialOffset, totalCount }: Props) {
    const [horses, setHorses] = useState<ProfileHorseCard[]>([]);
    const [offset, setOffset] = useState(initialOffset);
    const [hasMore, setHasMore] = useState(true);
    const [isPending, startTransition] = useTransition();

    const remaining = Math.max(0, totalCount - offset - horses.length);

    const loadMore = () => {
        startTransition(async () => {
            const result = await loadMoreProfileHorses(userId, offset);
            setHorses(prev => [...prev, ...result.horses]);
            setOffset(prev => prev + result.horses.length);
            setHasMore(result.hasMore);
        });
    };

    return (
        <>
            {/* Loaded horses: a second shelf row of polaroids */}
            {horses.length > 0 && (
                <div className="shelf-strip" tabIndex={0} role="region" aria-label="More public horses shelf">
                    {horses.map((horse) => (
                        <Link
                            key={horse.id}
                            href={`/community/${horse.id}`}
                            className="polaroid w-[220px]"
                            id={`profile-card-${horse.id}`}
                        >
                            <div className="polaroid-photo">
                                {horse.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" />
                                ) : (
                                    <span>No Photo</span>
                                )}
                            </div>
                            <div className="polaroid-name">{horse.customName}</div>
                            <div className="polaroid-breed">
                                {horse.refName}
                                {horse.finishType ? ` · ${horse.finishType}` : ""}
                            </div>
                            <div className="mt-1 flex items-center justify-between px-1 text-[0.68rem] text-muted-foreground">
                                <span>{horse.conditionGrade}</span>
                                <span>{formatDate(horse.createdAt)}</span>
                            </div>
                            {horse.collectionName && (
                                <div className="px-1 text-center text-[0.68rem] text-secondary-foreground">
                                    📁 {horse.collectionName}
                                </div>
                            )}
                            {horse.tradeStatus === "For Sale" && (
                                <div className="mt-1 text-center">
                                    <span className="stamp stamp-red">
                                        For Sale{horse.listingPrice ? ` $${horse.listingPrice.toLocaleString("en-US")}` : ""}
                                    </span>
                                </div>
                            )}
                            {horse.tradeStatus === "Open to Offers" && (
                                <div className="mt-1 text-center">
                                    <span className="stamp">
                                        Open to Offers{horse.listingPrice ? ` ~$${horse.listingPrice.toLocaleString("en-US")}` : ""}
                                    </span>
                                </div>
                            )}
                            {(horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers") &&
                                horse.marketplaceNotes && (
                                <div className="mt-1 truncate px-1 text-center text-[0.65rem] text-muted-foreground" title={horse.marketplaceNotes}>
                                    📝{horse.marketplaceNotes.length > 50
                                        ? horse.marketplaceNotes.slice(0, 50) + "…"
                                        : horse.marketplaceNotes}
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            )}

            {/* Load More button — brass so it reads on the wood */}
            {hasMore && (
                <div className="flex justify-center pt-2 pb-6">
                    <button
                        onClick={loadMore}
                        disabled={isPending}
                        className="btn-brass disabled:opacity-50"
                        id="profile-load-more"
                    >
                        {isPending ? "Loading..." : `Load More (${remaining} remaining)`}
                    </button>
                </div>
            )}
        </>
    );
}
