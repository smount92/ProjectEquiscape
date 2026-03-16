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

export default function TrophyCase({ badges }: TrophyCaseProps) {
    const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

    if (badges.length === 0) {
        return (
            <div className="trophy-empty">
                <span className="trophy-empty-icon">🏆</span>
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
        <div className="trophy-case">
            {sortedCategories.map((category) => (
                <div key={category}>
                    <h4 className="trophy-category-header">
                        {CATEGORY_LABELS[category] || category}
                    </h4>
                    <div className="trophy-grid">
                        {grouped.get(category)!.map((badge) => (
                            <div
                                key={badge.id}
                                className={`trophy-card trophy-tier-${badge.tier}`}
                                onMouseEnter={() => setHoveredBadge(badge.id)}
                                onMouseLeave={() => setHoveredBadge(null)}
                            >
                                <span className="trophy-icon">{badge.icon}</span>
                                <span className="trophy-name">{badge.name}</span>
                                <span className="trophy-date">{formatDate(badge.earnedAt)}</span>
                                {hoveredBadge === badge.id && (
                                    <div className="trophy-tooltip">
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
