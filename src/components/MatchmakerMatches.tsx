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
                        <div key={match.id} className="flex gap-sm p-sm bg-surface-glass border border-border rounded-md transition-all duration-200 hover:border-[rgba(251,146,60,0.4)] hover:shadow-[0_2px_12px_rgba(251,146,60,0.1)]">
                            <div className="w-[52px] h-[52px] rounded-sm overflow-hidden shrink-0 bg-black/[0.03]">
                                {match.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={match.thumbnailUrl}
                                        alt={match.custom_name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">🐴</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <Link
                                    href={`/community/${match.id}`}
                                    className="font-semibold text-sm text-accent-primary no-underline block hover:underline"
                                >
                                    {match.custom_name}
                                </Link>
                                <div className="flex items-center gap-sm mt-[2px]">
                                    <span className={`text-xs font-bold py-[2px] px-2 rounded-full ${match.trade_status === "For Sale" ? "bg-[rgba(34,197,94,0.15)] text-[#22c55e]" : "bg-[rgba(59,130,246,0.15)] text-[#3b82f6]"}`}>
                                        {match.trade_status === "For Sale" ? "💲" : "🤝"}{" "}
                                        {match.listing_price
                                            ? `$${match.listing_price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                                            : match.trade_status}
                                    </span>
                                    <Link
                                        href={`/profile/${encodeURIComponent(match.ownerAlias)}`}
                                        className="text-xs text-text-muted no-underline hover:text-accent-primary hover:underline"
                                    >
                                        @{match.ownerAlias}
                                    </Link>
                                </div>
                                {match.marketplace_notes && (
                                    <div className="text-xs text-text-muted mt-1 italic leading-snug">
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
