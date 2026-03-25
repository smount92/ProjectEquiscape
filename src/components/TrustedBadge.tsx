"use client";

/**
 * TrustedBadge — displays a gold 🛡️ "Community Trusted" badge
 * for sellers who meet the algorithmic trust criteria.
 * Render this next to seller alias names on profiles, offer cards, etc.
 */
export default function TrustedBadge({ className = "" }: { className?: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300 ${className}`}
            title="This seller has completed 5+ verified transactions with a 4.8+ average rating"
        >
            🛡️ Community Trusted
        </span>
    );
}
