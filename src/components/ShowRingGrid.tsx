"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import ShowRingFilters from "@/components/ShowRingFilters";
import type { FilterState } from "@/components/ShowRingFilters";
import WishlistButton from "@/components/WishlistButton";
import MessageSellerButton from "@/components/MessageSellerButton";
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
    refReleaseId: string | null;
    favoriteCount: number;
    isFavorited: boolean;
}

function getFinishBadgeClass(finish: string): string {
    switch (finish) {
        case "OF": return "badge-of";
        case "Custom": return "badge-custom";
        case "Artist Resin": return "badge-resin";
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
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState<FilterState>({
        finishType: null,
        tradeStatus: null,
        manufacturer: null,
        sortBy: "newest",
    });

    // Extract unique manufacturers from data
    const manufacturers = useMemo(() => {
        const set = new Set<string>();
        communityCards.forEach((h) => {
            const mfr = h.refName.split(" ")[0];
            if (mfr && mfr !== "Unlisted") set.add(mfr);
        });
        return [...set].sort();
    }, [communityCards]);

    const filteredCards = useMemo(() => {
        let cards = communityCards;

        // Text search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            cards = cards.filter((horse) =>
                horse.customName.toLowerCase().includes(q) ||
                (horse.moldName && horse.moldName.toLowerCase().includes(q)) ||
                (horse.releaseName && horse.releaseName.toLowerCase().includes(q)) ||
                (horse.sculptor && horse.sculptor.toLowerCase().includes(q)) ||
                horse.refName.toLowerCase().includes(q) ||
                horse.ownerAlias.toLowerCase().includes(q)
            );
        }

        // Structured filters
        if (filters.finishType) {
            cards = cards.filter((h) => h.finishType === filters.finishType);
        }
        if (filters.tradeStatus) {
            cards = cards.filter((h) => h.tradeStatus === filters.tradeStatus);
        }
        if (filters.manufacturer) {
            cards = cards.filter((h) => h.refName.startsWith(filters.manufacturer!));
        }

        // Sort
        if (filters.sortBy === "oldest") {
            cards = [...cards].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (filters.sortBy === "most-favorited") {
            cards = [...cards].sort((a, b) => b.favoriteCount - a.favoriteCount);
        }
        // "newest" is the default order from the server

        return cards;
    }, [searchQuery, communityCards, filters]);

    const isFiltering = searchQuery.trim() || filters.finishType || filters.tradeStatus || filters.manufacturer;

    return (
        <>
            {communityCards.length > 0 && (
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search the Show Ring by name, mold, release, sculptor, or collector\u2026"
                    id="showring-search-bar"
                />
            )}

            {communityCards.length > 0 && (
                <ShowRingFilters
                    filters={filters}
                    onFilterChange={setFilters}
                    manufacturers={manufacturers}
                />
            )}

            {isFiltering && (
                <div className="search-results-count">
                    {filteredCards.length === 0
                        ? "No models match your filters"
                        : `Showing ${filteredCards.length} of ${communityCards.length} models`}
                </div>
            )}

            {filteredCards.length === 0 && !isFiltering ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">🏟️</div>
                    <h2>The Show Ring is Empty</h2>
                    <p>No models have been shared yet. Be the first to showcase your collection!</p>
                    <Link href="/add-horse" className="btn btn-primary">🐴 Add to Stable</Link>
                </div>
            ) : filteredCards.length === 0 && searchQuery.trim() ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">🔍</div>
                    <h2>No Results</h2>
                    <p>No models match &ldquo;{searchQuery}&rdquo;. Try a different search term.</p>
                </div>
            ) : (
                <div className="community-grid animate-fade-in-up">
                    {filteredCards.map((horse) => {
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
                                        <div className="community-card-name">{horse.customName}</div>
                                        <div className="community-card-ref">{horse.refName}</div>
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
                                        {isListed && (
                                            <MessageSellerButton sellerId={horse.ownerId} horseId={horse.id} compact />
                                        )}
                                        <FavoriteButton
                                            horseId={horse.id}
                                            initialIsFavorited={horse.isFavorited}
                                            initialCount={horse.favoriteCount}
                                        />
                                        <WishlistButton moldId={horse.refMoldId} releaseId={horse.refReleaseId} />
                                        <span className="community-card-time">{timeAgo(horse.createdAt)}</span>
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
