"use client";

import Link from "next/link";
import UserAvatar from "./UserAvatar";

interface PostHeaderProps {
    /** Author avatar URL */
    avatarUrl: string | null;
    /** Author alias (without @) */
    alias: string;
    /** ISO timestamp string */
    createdAt: string;
    /** Was the post edited? */
    isEdited?: boolean;
    /** Optional verification badge */
    badge?: "verified" | "admin" | "moderator" | "artist" | null;
    /** Link to the post detail page */
    permalink?: string;
    /** Optional right-side action slot (edit, delete buttons) */
    actions?: React.ReactNode;
    /** Avatar size */
    avatarSize?: "xs" | "sm" | "md";
}

const BADGE_MAP: Record<string, { emoji: string; label: string; className: string }> = {
    verified: { emoji: "🛡️", label: "Verified", className: "bg-emerald-50 text-forest" },
    admin: { emoji: "⭐", label: "Admin", className: "bg-amber-50 text-amber-700" },
    moderator: { emoji: "🔧", label: "Mod", className: "bg-blue-50 text-blue-700" },
    artist: { emoji: "🎨", label: "Artist", className: "bg-purple-50 text-purple-700" },
};

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

export default function PostHeader({
    avatarUrl,
    alias,
    createdAt,
    isEdited = false,
    badge,
    permalink,
    actions,
    avatarSize = "sm",
}: PostHeaderProps) {
    const badgeInfo = badge ? BADGE_MAP[badge] : null;

    return (
        <div className="flex items-start gap-2.5">
            <UserAvatar
                src={avatarUrl}
                alias={alias}
                size={avatarSize}
                href={`/profile/${encodeURIComponent(alias)}`}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Link
                        href={`/profile/${encodeURIComponent(alias)}`}
                        className="truncate text-sm font-semibold text-foreground no-underline hover:underline"
                    >
                        @{alias}
                    </Link>
                    {badgeInfo && (
                        <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ${badgeInfo.className}`}
                        >
                            {badgeInfo.emoji} {badgeInfo.label}
                        </span>
                    )}
                    <span className="text-muted-foreground text-xs">·</span>
                    {permalink ? (
                        <Link href={permalink} className="text-muted-foreground text-xs no-underline hover:underline">
                            {timeAgo(createdAt)}
                            {isEdited && (
                                <span className="ml-0.5 opacity-60" title="This post was edited">
                                    (edited)
                                </span>
                            )}
                        </Link>
                    ) : (
                        <span className="text-muted-foreground text-xs">
                            {timeAgo(createdAt)}
                            {isEdited && (
                                <span className="ml-0.5 opacity-60" title="This post was edited">
                                    (edited)
                                </span>
                            )}
                        </span>
                    )}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            </div>
        </div>
    );
}
