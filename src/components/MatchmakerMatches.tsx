"use client";

import { useState } from "react";
import Link from "next/link";
import MessageSellerButton from "@/components/MessageSellerButton";

interface MarketplaceMatch {
    id: string;
    custom_name: string;
    trade_status: string;
    listing_price: number | null;
    marketplace_notes: string | null;
    thumbnailUrl: string | null;
    ownerAlias: string;
    ownerId: string;
}

export default function MatchmakerMatches({
    matchCount,
    matches,
}: {
    matchCount: number;
    matches: MarketplaceMatch[];
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="matchmaker-section">
            <button
                className="matchmaker-badge"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
            >
                <span className="matchmaker-badge-fire">🔥</span>
                <span className="matchmaker-badge-text">
                    {matchCount} Available in Marketplace
                </span>
                <svg
                    className={`matchmaker-chevron ${expanded ? "expanded" : ""}`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {expanded && (
                <div className="matchmaker-results animate-fade-in-up">
                    {matches.map((match) => (
                        <div key={match.id} className="matchmaker-card">
                            <div className="matchmaker-card-thumb">
                                {match.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={match.thumbnailUrl}
                                        alt={match.custom_name}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="matchmaker-card-placeholder">🐴</div>
                                )}
                            </div>
                            <div className="matchmaker-card-info">
                                <Link
                                    href={`/community/${match.id}`}
                                    className="matchmaker-card-name"
                                >
                                    {match.custom_name}
                                </Link>
                                <div className="matchmaker-card-meta">
                                    <span className={`matchmaker-status ${match.trade_status === "For Sale" ? "status-sale" : "status-offers"}`}>
                                        {match.trade_status === "For Sale" ? "💲" : "🤝"}{" "}
                                        {match.listing_price
                                            ? `$${match.listing_price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                                            : match.trade_status}
                                    </span>
                                    <Link
                                        href={`/profile/${encodeURIComponent(match.ownerAlias)}`}
                                        className="matchmaker-card-seller"
                                    >
                                        @{match.ownerAlias}
                                    </Link>
                                </div>
                                {match.marketplace_notes && (
                                    <div className="matchmaker-card-notes">
                                        {match.marketplace_notes}
                                    </div>
                                )}
                                <div style={{ marginTop: "6px" }}>
                                    <MessageSellerButton
                                        sellerId={match.ownerId}
                                        horseId={match.id}
                                        horseName={match.custom_name}
                                        tradeStatus={match.trade_status}
                                        askingPrice={match.listing_price}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
