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

function getFinishBadgeClass(finish: string): string {
 switch (finish) {
 case"OF":
 return"of";
 case"Custom":
 return"custom";
 case"Artist Resin":
 return"resin";
 default:
 return"";
 }
}

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
            {/* Render loaded horses in same grid format as initial SSR cards */}
            {horses.length > 0 && (
                <div className="grid-cols-[repeat(auto-fill,minmax(300px,1fr))] grid gap-6 mt-6">
                    {horses.map((horse) => (
                        <Link
                            key={horse.id}
                            href={`/community/${horse.id}`}
                            className="border-stone-200 text-stone-900 flex flex-col overflow-hidden rounded-lg border bg-stone-50 no-underline transition-all"
                            id={`profile-card-${horse.id}`}
                        >
                            <div className="relative">
                                {horse.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" className="w-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center bg-stone-100 px-4 py-8">
                                        <span className="text-4xl">🐴</span>
                                        <span className="mt-1 text-sm text-stone-500">No photo</span>
                                    </div>
                                )}
                                <span className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}>
                                    {horse.finishType}
                                </span>
                                {horse.tradeStatus === "For Sale" && (
                                    <span className="trade-badge border border-green-500/50 bg-green-500/85 text-white">
                                        💲{horse.listingPrice ? `$${horse.listingPrice.toLocaleString("en-US")}` : "For Sale"}
                                    </span>
                                )}
                                {horse.tradeStatus === "Open to Offers" && (
                                    <span className="trade-badge border border-blue-500/50 bg-blue-500/85 text-white">
                                        🤝{horse.listingPrice ? `~$${horse.listingPrice.toLocaleString("en-US")}` : "Open to Offers"}
                                    </span>
                                )}
                            </div>
                            <div className="p-4">
                                <div className="text-sm font-semibold text-stone-900">{horse.customName}</div>
                                <div className="mt-0.5 text-xs text-stone-600">{horse.refName}</div>
                                <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                                    <span>{horse.conditionGrade}</span>
                                    <span>{formatDate(horse.createdAt)}</span>
                                </div>
                                {horse.collectionName && (
                                    <div className="mt-2 text-xs text-stone-600">
                                        📁 {horse.collectionName}
                                    </div>
                                )}
                                {(horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers") &&
                                    horse.marketplaceNotes && (
                                    <div className="mt-1 truncate text-xs text-stone-500" title={horse.marketplaceNotes}>
                                        📝{horse.marketplaceNotes.length > 50
                                            ? horse.marketplaceNotes.slice(0, 50) + "…"
                                            : horse.marketplaceNotes}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Load More button */}
            {hasMore && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={loadMore}
                        disabled={isPending}
                        className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all hover:bg-stone-100 disabled:opacity-50"
                        id="profile-load-more"
                    >
                        {isPending ? "Loading..." : `Load More (${remaining} remaining)`}
                    </button>
                </div>
            )}
        </>
    );
}
