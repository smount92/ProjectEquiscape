"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

interface HorseCardData {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    releaseLine: string | null;
    thumbnailUrl: string | null;
    collectionName: string | null;
    sculptor: string | null;
    // Hidden search fields from reference data
    moldName: string | null;
    releaseName: string | null;
}

function getFinishBadgeClass(finishType: string): string {
    switch (finishType) {
        case "OF":
            return "of";
        case "Custom":
            return "custom";
        case "Artist Resin":
            return "resin";
        default:
            return "";
    }
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export default function StableGrid({
    horseCards,
}: {
    horseCards: HorseCardData[];
}) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredCards = useMemo(() => {
        if (!searchQuery.trim()) return horseCards;

        const q = searchQuery.toLowerCase().trim();
        return horseCards.filter((horse) => {
            return (
                horse.customName.toLowerCase().includes(q) ||
                (horse.moldName && horse.moldName.toLowerCase().includes(q)) ||
                (horse.releaseName && horse.releaseName.toLowerCase().includes(q)) ||
                (horse.sculptor && horse.sculptor.toLowerCase().includes(q)) ||
                horse.refName.toLowerCase().includes(q)
            );
        });
    }, [searchQuery, horseCards]);

    return (
        <>
            {/* Search Bar — sticky above grid */}
            {horseCards.length > 0 && (
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search your stable by name, mold, release, or sculptor\u2026"
                    id="stable-search-bar"
                />
            )}

            {/* Filtered results count */}
            {searchQuery.trim() && (
                <div className="search-results-count">
                    {filteredCards.length === 0
                        ? "No models match your search"
                        : `Showing ${filteredCards.length} of ${horseCards.length} models`}
                </div>
            )}

            {/* Grid */}
            {filteredCards.length === 0 && !searchQuery.trim() ? (
                <div className="card shelf-empty">
                    <div className="shelf-empty-icon">🏠</div>
                    <h2>Your Stable is Empty</h2>
                    <p>
                        You haven&apos;t added any models yet. Click the button above to
                        catalog your first horse!
                    </p>
                    <Link
                        href="/add-horse"
                        className="btn btn-primary"
                        id="add-first-horse"
                    >
                        🐴 Add Your First Horse
                    </Link>
                </div>
            ) : filteredCards.length === 0 && searchQuery.trim() ? (
                <div className="card shelf-empty">
                    <div className="shelf-empty-icon">🔍</div>
                    <h2>No Results</h2>
                    <p>
                        No models match &ldquo;{searchQuery}&rdquo;. Try a different search term.
                    </p>
                </div>
            ) : (
                <div className="shelf-grid">
                    {filteredCards.map((horse) => (
                        <Link
                            key={horse.id}
                            href={`/stable/${horse.id}`}
                            className="horse-card"
                            id={`horse-card-${horse.id}`}
                        >
                            <div className="horse-card-image">
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
                            <div className="horse-card-info">
                                <div className="horse-card-name">{horse.customName}</div>
                                <div className="horse-card-ref">{horse.refName}</div>
                                {horse.releaseLine && (
                                    <div className="horse-card-ref" style={{ fontSize: "calc(0.7rem * var(--font-scale))", opacity: 0.7, marginTop: "2px" }}>
                                        🎨 {horse.releaseLine}
                                    </div>
                                )}
                                {horse.sculptor && (
                                    <div className="horse-card-ref" style={{ fontSize: "calc(0.7rem * var(--font-scale))", opacity: 0.7, marginTop: "2px" }}>
                                        ✂️ {horse.sculptor}
                                    </div>
                                )}
                                <div className="horse-card-meta">
                                    <span>{horse.conditionGrade}</span>
                                    <span>{formatDate(horse.createdAt)}</span>
                                </div>
                                {horse.collectionName && (
                                    <div className="horse-card-collection">
                                        📁 {horse.collectionName}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </>
    );
}
