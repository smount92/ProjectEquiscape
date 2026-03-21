"use client";

import { useState } from "react";

interface TrophyCaseProps {
    badges: {
        id: string;
        name: string;
        description: string;
        icon: string;
        category: string;
        tier: number;
        earnedAt: string;
    }[];
}

const CATEGORY_ORDER = ["exclusive", "collection", "social", "commerce", "shows"];

const CATEGORY_LABELS: Record<string, string> = {
    exclusive: "🏅 Exclusive",
    collection: "🐴 Collection",
    social: "🦋 Social",
    commerce: "💰 Commerce",
    shows: "📷 Shows",
};

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getTierClasses(tier: number): string {
    switch (tier) {
        case 1: return "border-[#cd7f32] hover:shadow-[0_0_12px_rgba(205,127,50,0.3)]";
        case 2: return "border-[#c0c0c0] hover:shadow-[0_0_12px_rgba(192,192,192,0.4)]";
        case 3: return "border-[#ffd700] hover:shadow-[0_0_16px_rgba(255,215,0,0.4)]";
        case 4: return "border-[#b9f2ff] hover:shadow-[0_0_20px_rgba(185,242,255,0.5)]";
        case 5: return "border-accent-primary bg-[rgba(212,165,116,0.08)] hover:shadow-[0_0_24px_rgba(212,165,116,0.5)]";
        default: return "border-border";
    }
}

export default function TrophyCase({ badges }: TrophyCaseProps) {
    const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

    if (badges.length === 0) {
        return (
            <div className="text-center py-xl text-text-muted">
                <span className="text-[2.5rem] block mb-sm">🏆</span>
                <p>No badges earned yet — keep collecting!</p>
            </div>
        );
    }

    // Group badges by category
    const grouped = new Map<string, typeof badges>();
    for (const badge of badges) {
        if (!grouped.has(badge.category)) grouped.set(badge.category, []);
        grouped.get(badge.category)!.push(badge);
    }

    // Sort categories by predefined order
    const sortedCategories = [...grouped.keys()].sort(
        (a, b) => (CATEGORY_ORDER.indexOf(a) ?? 99) - (CATEGORY_ORDER.indexOf(b) ?? 99)
    );

    return (
        <div className="mt-sm">
            {sortedCategories.map((category) => (
                <div key={category}>
                    <h4 className="text-[calc(0.85rem*var(--font-scale))] font-semibold uppercase tracking-[0.05em] text-text-muted my-lg mb-sm first:mt-0">
                        {CATEGORY_LABELS[category] || category}
                    </h4>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-md max-[480px]:grid-cols-[repeat(auto-fill,minmax(90px,1fr))] max-[480px]:gap-sm">
                        {grouped.get(category)!.map((badge) => (
                            <div
                                key={badge.id}
                                className={`relative text-center p-md rounded-lg bg-surface-glass border transition-transform hover:-translate-y-0.5 cursor-default max-[480px]:p-sm ${getTierClasses(badge.tier)}`}
                                onMouseEnter={() => setHoveredBadge(badge.id)}
                                onMouseLeave={() => setHoveredBadge(null)}
                            >
                                <span className="text-[2rem] block mb-xs max-[480px]:text-2xl">{badge.icon}</span>
                                <span className="text-[calc(0.75rem*var(--font-scale))] font-semibold block">{badge.name}</span>
                                <span className="text-[calc(0.6rem*var(--font-scale))] text-text-muted mt-0.5 block">{formatDate(badge.earnedAt)}</span>
                                {hoveredBadge === badge.id && (
                                    <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-[var(--color-bg-elevated)] border border-border rounded-md py-sm px-md min-w-[200px] max-w-[260px] shadow-lg z-50 text-left pointer-events-none animate-[fadeInUp_0.15s_ease] max-[480px]:hidden [&_strong]:block [&_strong]:text-[calc(0.8rem*var(--font-scale))] [&_strong]:mb-1 [&_p]:text-[calc(0.7rem*var(--font-scale))] [&_p]:text-text-secondary [&_p]:leading-snug [&_p]:m-0 [&_p]:mb-1 [&>span]:text-[calc(0.65rem*var(--font-scale))] [&>span]:text-text-muted">
                                        <strong>{badge.name}</strong>
                                        <p>{badge.description}</p>
                                        <span>Earned {formatDate(badge.earnedAt)}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
