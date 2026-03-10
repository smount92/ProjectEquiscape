"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTextPost } from "@/app/actions/activity";
import { toggleActivityLike } from "@/app/actions/likes";
import RichText from "@/components/RichText";
import LikeToggle from "@/components/LikeToggle";

export interface FeedItemData {
    id: string;
    actorAlias: string;
    actorId: string;
    eventType: string;
    horseId: string | null;
    horseName: string | null;
    thumbnailUrl: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    likesCount: number;
    isLiked: boolean;
    imageUrls: string[];
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
        case "text_post": return "📝";
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
        case "text_post": {
            const postText = (item.metadata as { text?: string })?.text || "";
            return `${who}: ${postText.length > 80 ? postText.slice(0, 80) + "…" : postText}`;
        }
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
    currentUserId?: string;
}

export default function ActivityFeed({ items, emptyMessage, currentUserId }: ActivityFeedProps) {
    const router = useRouter();
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
                    : item.eventType === "text_post"
                        ? `/feed/${item.id}`
                        : `/profile/${encodeURIComponent(item.actorAlias)}`;

                return (
                    <div key={item.id} className="activity-feed-item-wrapper">
                        <Link
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
                                {item.eventType === "text_post" ? (
                                    <>
                                        <span className="activity-feed-text" style={{ fontWeight: 600 }}>
                                            @{item.actorAlias}
                                        </span>
                                        <div className="feed-item-text-post">
                                            <RichText content={(item.metadata as { text?: string })?.text || ""} />
                                        </div>
                                        {/* Image collage for casual image posts */}
                                        {item.imageUrls && item.imageUrls.length > 0 && (
                                            <div className="feed-image-collage" data-count={Math.min(item.imageUrls.length, 4)}>
                                                {item.imageUrls.slice(0, 4).map((url, i) => (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img key={i} src={url} alt={`Post image ${i + 1}`} loading="lazy" />
                                                ))}
                                            </div>
                                        )}
                                        <span className="activity-feed-time">
                                            {timeAgo(item.createdAt)}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="activity-feed-text">
                                            {getEventText(item)}
                                        </span>
                                        <span className="activity-feed-time">
                                            {timeAgo(item.createdAt)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </Link>
                        {/* Action row: Like + Delete (outside the Link to avoid navigation) */}
                        <div className="feed-action-row">
                            {currentUserId && (
                                <LikeToggle
                                    initialLiked={item.isLiked}
                                    initialCount={item.likesCount}
                                    onToggle={() => toggleActivityLike(item.id)}
                                />
                            )}
                            {currentUserId && currentUserId === item.actorId && item.eventType === "text_post" && (
                                <button
                                    className="btn btn-ghost"
                                    style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                                    onClick={() => {
                                        if (confirm("Delete post?")) {
                                            deleteTextPost(item.id).then(() => router.refresh());
                                        }
                                    }}
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
