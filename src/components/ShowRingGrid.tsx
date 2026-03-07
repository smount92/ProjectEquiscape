"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

interface CommunityCardData {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    releaseLine: string | null;
    ownerAlias: string;
    thumbnailUrl: string | null;
    sculptor: string | null;
    // Hidden search fields
    moldName: string | null;
    releaseName: string | null;
}

function getFinishBadgeClass(finish: string): string {
    switch (finish) {
        case "OF":
            return "badge-of";
        case "Custom":
            return "badge-custom";
        case "Artist Resin":
            return "badge-resin";
        default:
            return "";
    }
}

function timeAgo(dateStr: string): string {
    const seconds = Math.floor(
        (Date.now() - new Date(dateStr).getTime()) / 1000
    );
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

export default function ShowRingGrid({
    communityCards,
}: {
    communityCards: CommunityCardData[];
}) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredCards = useMemo(() => {
        if (!searchQuery.trim()) return communityCards;

        const q = searchQuery.toLowerCase().trim();
        return communityCards.filter((horse) => {
            return (
                horse.customName.toLowerCase().includes(q) ||
                (horse.moldName && horse.moldName.toLowerCase().includes(q)) ||
                (horse.releaseName && horse.releaseName.toLowerCase().includes(q)) ||
                (horse.sculptor && horse.sculptor.toLowerCase().includes(q)) ||
                horse.refName.toLowerCase().includes(q) ||
                horse.ownerAlias.toLowerCase().includes(q)
            );
        });
    }, [searchQuery, communityCards]);

    return (
        <>
            {/* Search Bar */}
            {communityCards.length > 0 && (
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search the Show Ring by name, mold, release, sculptor, or collector\u2026"
                    id="showring-search-bar"
                />
            )}

            {/* Filtered results count */}
            {searchQuery.trim() && (
                <div className="search-results-count">
                    {filteredCards.length === 0
                        ? "No models match your search"
                        : `Showing ${filteredCards.length} of ${communityCards.length} models`}
                </div>
            )}

            {/* Grid */}
            {filteredCards.length === 0 && !searchQuery.trim() ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">🏟️</div>
                    <h2>The Show Ring is Empty</h2>
                    <p>
                        No models have been shared yet. Be the first to showcase your
                        collection!
                    </p>
                    <Link href="/add-horse" className="btn btn-primary">
                        🐴 Add to Stable
                    </Link>
                </div>
            ) : filteredCards.length === 0 && searchQuery.trim() ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">🔍</div>
                    <h2>No Results</h2>
                    <p>
                        No models match &ldquo;{searchQuery}&rdquo;. Try a different search term.
                    </p>
                </div>
            ) : (
                <div className="community-grid animate-fade-in-up">
                    {filteredCards.map((horse) => (
                        <div
                            key={horse.id}
                            className="community-card"
                            id={`community-card-${horse.id}`}
                        >
                            <Link href={`/community/${horse.id}`} className="community-card-link">
                                <div className="community-card-image">
                                    {horse.thumbnailUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={horse.thumbnailUrl}
                                            alt={horse.customName}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="horse-card-placeholder">
                                            <span className="horse-card-placeholder-icon">🐴</span>
                                            <span>No photo</span>
                                        </div>
                                    )}
                                    <span
                                        className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}
                                    >
                                        {horse.finishType}
                                    </span>
                                </div>
                                <div className="community-card-info">
                                    <div className="community-card-name">{horse.customName}</div>
                                    <div className="community-card-ref">{horse.refName}</div>
                                    {horse.releaseLine && (
                                        <div
                                            className="community-card-ref"
                                            style={{
                                                fontSize: "calc(0.7rem * var(--font-scale))",
                                                opacity: 0.7,
                                                marginTop: "2px",
                                            }}
                                        >
                                            🎨 {horse.releaseLine}
                                        </div>
                                    )}
                                    {horse.sculptor && (
                                        <div
                                            className="community-card-ref"
                                            style={{
                                                fontSize: "calc(0.7rem * var(--font-scale))",
                                                opacity: 0.7,
                                                marginTop: "2px",
                                            }}
                                        >
                                            ✂️ {horse.sculptor}
                                        </div>
                                    )}
                                </div>
                            </Link>
                            <div className="community-card-footer">
                                <Link
                                    href={`/profile/${encodeURIComponent(horse.ownerAlias)}`}
                                    className="community-card-owner"
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
                                <span className="community-card-time">
                                    {timeAgo(horse.createdAt)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
