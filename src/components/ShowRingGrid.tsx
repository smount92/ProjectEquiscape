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
                <div className="search-bar-container" style={{ marginBottom: "var(--space-md)" }}>
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
                <div className="search-results-count">
                    {communityCards.length === 0
                        ? "No models match your filters"
                        : `Showing ${communityCards.length} models`}
                </div>
            )}

            {communityCards.length === 0 && !isFiltering ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">🏟️</div>
                    <h2>The Show Ring is Empty</h2>
                    <p>No models have been shared yet. Be the first to showcase your collection!</p>
                    <Link href="/add-horse" className="btn btn-primary">🐴 Add to Stable</Link>
                </div>
            ) : communityCards.length === 0 && isFiltering ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">🔍</div>
                    <h2>No Results</h2>
                    <p>No models match your search. Try different filters.</p>
                </div>
            ) : (
                <div className="community-grid animate-fade-in-up">
                    {communityCards.map((horse) => {
                        const priceLabel = formatPrice(horse.listingPrice);
                        const isListed = horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers";

                        return (
                            <div key={horse.id} className="community-card" id={`community-card-${horse.id}`}>
                                <Link href={`/community/${horse.id}`} className="community-card-link">
                                    <div className="community-card-image">
                                        {horse.thumbnailUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" />
                                        ) : (
                                            <div className="horse-card-placeholder">
                                                <span className="horse-card-placeholder-icon">🐴</span>
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
                                            <span className="trade-badge trade-for-sale">
                                                💲 {priceLabel || "For Sale"}
                                            </span>
                                        )}
                                        {horse.tradeStatus === "Open to Offers" && (
                                            <span className="trade-badge trade-open-offers">
                                                🤝 {priceLabel ? `~${priceLabel}` : "Open to Offers"}
                                            </span>
                                        )}
                                    </div>
                                        <div className="community-card-info">
                                            <div className="community-card-name">
                                                {horse.customName}
                                                {(horse.hoofprintCount ?? 0) > 0 && (
                                                    <span className="hoofprint-badge" title="Has Hoofprint" style={{ marginLeft: "6px" }}>🐾</span>
                                                )}
                                            </div>
                                            <div className="community-card-ref">{horse.refName}</div>
                                            <div className="community-card-time">{timeAgo(horse.createdAt)}</div>
                                        {horse.releaseLine && (
                                            <div className="community-card-ref" style={{ fontSize: "calc(0.7rem * var(--font-scale))", opacity: 0.7, marginTop: "2px" }}>
                                                🎨 {horse.releaseLine}
                                            </div>
                                        )}
                                        {horse.sculptor && (
                                            <div className="community-card-ref" style={{ fontSize: "calc(0.7rem * var(--font-scale))", opacity: 0.7, marginTop: "2px" }}>
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
                                                className="btn btn-primary"
                                                style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", padding: "var(--space-xs) var(--space-sm)", marginTop: "var(--space-xs)", display: "inline-block" }}
                                            >
                                                View &amp; Contact
                                            </span>
                                        )}
                                    </div>
                                </Link>
                                <div className="community-card-footer">
                                    <Link href={`/profile/${encodeURIComponent(horse.ownerAlias)}`} className="community-card-owner">
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
