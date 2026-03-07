"use client";

import Link from "next/link";

interface FeedItemData {
    id: string;
    actorAlias: string;
    actorId: string;
    eventType: string;
    horseId: string | null;
    horseName: string | null;
    thumbnailUrl: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

function getEventIcon(type: string): string {
    switch (type) {
        case "new_horse": return "🐴";
        case "favorite": return "❤️";
        case "comment": return "💬";
        case "rating": return "⭐";
        case "follow": return "👤";
        case "show_record": return "🏆";
        case "transaction_complete": return "✅";
        default: return "📌";
    }
}

function getEventText(item: FeedItemData): string {
    const who = `@${item.actorAlias}`;
    switch (item.eventType) {
        case "new_horse":
            return `${who} added ${item.horseName || "a new horse"} to their stable`;
        case "favorite":
            return `${who} ❤️ ${item.horseName || "a horse"}`;
        case "comment":
            return `${who} commented on ${item.horseName || "a horse"}`;
        case "rating":
            return `${who} left a rating`;
        case "follow":
            return `${who} followed a collector`;
        case "show_record":
            return `${who} added a show record for ${item.horseName || "a horse"}`;
        case "transaction_complete":
            return `${who} completed a transaction`;
        default:
            return `${who} did something`;
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
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

interface ActivityFeedProps {
    items: FeedItemData[];
    emptyMessage?: string;
}

export default function ActivityFeed({ items, emptyMessage }: ActivityFeedProps) {
    if (items.length === 0) {
        return (
            <div className="card shelf-empty animate-fade-in-up">
                <div className="shelf-empty-icon">📰</div>
                <h2>No Activity Yet</h2>
                <p>{emptyMessage || "Follow some collectors to see their activity here!"}</p>
            </div>
        );
    }

    return (
        <div className="activity-feed animate-fade-in-up">
            {items.map((item) => {
                const link = item.horseId
                    ? `/community/${item.horseId}`
                    : `/profile/${encodeURIComponent(item.actorAlias)}`;

                return (
                    <Link
                        key={item.id}
                        href={link}
                        className="activity-feed-item"
                    >
                        {item.thumbnailUrl ? (
                            <div className="feed-item-thumb">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.thumbnailUrl} alt="" loading="lazy" />
                            </div>
                        ) : (
                            <span className="activity-feed-icon">
                                {getEventIcon(item.eventType)}
                            </span>
                        )}
                        <div className="activity-feed-content">
                            <span className="activity-feed-text">
                                {getEventText(item)}
                            </span>
                            <span className="activity-feed-time">
                                {timeAgo(item.createdAt)}
                            </span>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
