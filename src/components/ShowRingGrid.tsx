"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ShowRingFilters from "@/components/ShowRingFilters";
import type { FilterState } from "@/components/ShowRingFilters";
import WishlistButton from "@/components/WishlistButton";
import FavoriteButton from "@/components/FavoriteButton";

interface CommunityCardData {
    id: string;
    ownerId: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    releaseLine: string | null;
    ownerAlias: string;
    thumbnailUrl: string | null;
    sculptor: string | null;
    tradeStatus: string;
    listingPrice: number | null;
    marketplaceNotes: string | null;
    moldName: string | null;
    releaseName: string | null;
    refMoldId: string | null;
    catalogId: string | null;
    favoriteCount: number;
    isFavorited: boolean;
    scale: string | null;
    hoofprintCount?: number;
    assetCategory?: string;
}

function getFinishBadgeClass(finish: string): string {
    switch (finish) {
        case "OF": return "of";
        case "Custom": return "custom";
        case "Artist Resin": return "resin";
        default: return "";
    }
}

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

export default function ShowRingGrid({
    communityCards,
}: {
    communityCards: CommunityCardData[];
}) {
    const router = useRouter();
    const currentParams = useSearchParams();

    // Read current URL state for search bar local display
    const [searchInput, setSearchInput] = useState(currentParams.get("q") || "");

    // Build filter state from URL
    const filters: FilterState = {
        finishType: currentParams.get("finishType") || null,
        tradeStatus: currentParams.get("tradeStatus") || null,
        manufacturer: null,
        scale: null,
        sortBy: (currentParams.get("sortBy") || "newest") as "newest" | "oldest" | "most-favorited",
    };

    // Push filters to URL (triggers server re-render)
    const pushParams = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(currentParams.toString());
        for (const [key, val] of Object.entries(updates)) {
            if (val && val !== "all") {
                params.set(key, val);
            } else {
                params.delete(key);
            }
        }
        router.push(`/community?${params.toString()}`);
    }, [currentParams, router]);

    const handleSearch = useCallback((q: string) => {
        setSearchInput(q);
    }, []);

    const handleSearchSubmit = useCallback(() => {
        pushParams({ q: searchInput.trim() || null });
    }, [searchInput, pushParams]);

    const handleFilterChange = useCallback((newFilters: FilterState) => {
        pushParams({
            finishType: newFilters.finishType,
            tradeStatus: newFilters.tradeStatus,
            sortBy: newFilters.sortBy === "newest" ? null : newFilters.sortBy,
        });
    }, [pushParams]);

    // Extract unique manufacturers/scales from data (for filter dropdowns)
    const manufacturers = useMemo(() => {
        const set = new Set<string>();
        communityCards.forEach((h) => {
            const mfr = h.refName.split(" ")[0];
            if (mfr && mfr !== "Unlisted") set.add(mfr);
        });
        return [...set].sort();
    }, [communityCards]);

    const scales = useMemo(() => {
        const set = new Set<string>();
        communityCards.forEach((h) => {
            if (h.scale) set.add(h.scale);
        });
        return [...set].sort();
    }, [communityCards]);

    const isFiltering = currentParams.get("q") || currentParams.get("finishType") || currentParams.get("tradeStatus");

    return (
        <>
            {communityCards.length > 0 && (
                <div className="sticky top-[calc(var(--header-height) + var(--space-md))] z-[10] flex items-center gap-2 py-2 px-6 mb-8 bg-card border border-edge rounded-xl transition-all shadow-md-container" style={{ marginBottom: "var(--space-md)" }}>
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => handleSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); }}
                        onBlur={handleSearchSubmit}
                        placeholder="Search the Show Ring by name, sculptor, or collector…"
                        className="form-input"
                        id="showring-search-bar"
                    />
                </div>
            )}

            {communityCards.length > 0 && (
                <ShowRingFilters
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    manufacturers={manufacturers}
                    scales={scales}
                />
            )}

            {isFiltering && (
                <div className="text-sm text-muted mb-6 pl-1">
                    {communityCards.length === 0
                        ? "No models match your filters"
                        : `Showing ${communityCards.length} models`}
                </div>
            )}

            {communityCards.length === 0 && !isFiltering ? (
                <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8 animate-fade-in-up">
                    <div className="text-center py-[var(--space-3xl)] px-8-icon">🏟️</div>
                    <h2>The Show Ring is Empty</h2>
                    <p>No models have been shared yet. Be the first to showcase your collection!</p>
                    <Link href="/add-horse" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">🐴 Add to Stable</Link>
                </div>
            ) : communityCards.length === 0 && isFiltering ? (
                <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8 animate-fade-in-up">
                    <div className="text-center py-[var(--space-3xl)] px-8-icon">🔍</div>
                    <h2>No Results</h2>
                    <p>No models match your search. Try different filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill, minmax(300px, 1fr))] gap-6 animate-fade-in-up">
                    {communityCards.map((horse) => {
                        const priceLabel = formatPrice(horse.listingPrice);
                        const isListed = horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers";

                        return (
                            <div key={horse.id} className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all" id={`community-card-${horse.id}`}>
                                <Link href={`/community/${horse.id}`} className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-link">
                                    <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-image">
                                        {horse.thumbnailUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" />
                                        ) : (
                                            <div className="horse-bg-card border border-edge rounded-lg p-12 shadow-md transition-all-placeholder">
                                                <span className="horse-bg-card border border-edge rounded-lg p-12 shadow-md transition-all-placeholder-icon">🐴</span>
                                                <span>No photo</span>
                                            </div>
                                        )}
                                        <span className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}>
                                            {horse.finishType}
                                        </span>
                                        {(Date.now() - new Date(horse.createdAt).getTime()) < 48 * 60 * 60 * 1000 && (
                                            <span className="new-badge">NEW</span>
                                        )}
                                        {horse.assetCategory && horse.assetCategory !== "model" && (
                                            <span className="category-badge">
                                                {horse.assetCategory === "tack" ? "🏇" : horse.assetCategory === "prop" ? "🌲" : "🎭"}
                                            </span>
                                        )}
                                        {horse.tradeStatus === "For Sale" && (
                                            <span className="trade-badge bg-[rgba(34,197,94,0.85)] text-white border border-[rgba(34,197,94,0.5)]">
                                                💲 {priceLabel || "For Sale"}
                                            </span>
                                        )}
                                        {horse.tradeStatus === "Open to Offers" && (
                                            <span className="trade-badge bg-[rgba(59,130,246,0.85)] text-white border border-[rgba(59,130,246,0.5)]">
                                                🤝 {priceLabel ? `~${priceLabel}` : "Open to Offers"}
                                            </span>
                                        )}
                                    </div>
                                        <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-info">
                                            <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-name">
                                                {horse.customName}
                                                {(horse.hoofprintCount ?? 0) > 0 && (
                                                    <span className="text-[0.65rem] py-[2px] px-[8px] rounded-[999px] bg-[rgba(245, 158, 11, 0.15)] text-[#f59e0b] font-semibold" title="Has Hoofprint" style={{ marginLeft: "6px" }}>🐾</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-ref">{horse.refName}</div>
                                            <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-time">{timeAgo(horse.createdAt)}</div>
                                        {horse.releaseLine && (
                                            <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-ref" style={{ fontSize: "calc(0.7rem * var(--font-scale))", opacity: 0.7, marginTop: "2px" }}>
                                                🎨 {horse.releaseLine}
                                            </div>
                                        )}
                                        {horse.sculptor && (
                                            <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-ref" style={{ fontSize: "calc(0.7rem * var(--font-scale))", opacity: 0.7, marginTop: "2px" }}>
                                                ✂️ {horse.sculptor}
                                            </div>
                                        )}
                                        {isListed && horse.marketplaceNotes && (
                                            <div className="marketplace-notes-snippet" title={horse.marketplaceNotes}>
                                                📝 {horse.marketplaceNotes.length > 60 ? horse.marketplaceNotes.slice(0, 60) + "…" : horse.marketplaceNotes}
                                            </div>
                                        )}
                                        {isListed && (
                                            <span
                                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                                style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", padding: "var(--space-xs) var(--space-sm)", marginTop: "var(--space-xs)", display: "inline-block" }}
                                            >
                                                View &amp; Contact
                                            </span>
                                        )}
                                    </div>
                                </Link>
                                <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-footer">
                                    <Link href={`/profile/${encodeURIComponent(horse.ownerAlias)}`} className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-owner">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                        @{horse.ownerAlias}
                                    </Link>
                                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                                        <FavoriteButton
                                            horseId={horse.id}
                                            initialIsFavorited={horse.isFavorited}
                                            initialCount={horse.favoriteCount}
                                        />
                                        <WishlistButton catalogId={horse.catalogId} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
