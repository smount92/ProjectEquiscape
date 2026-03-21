"use client";

import { useState } from "react";
import { toggleFollow } from "@/app/actions/follows";

interface FollowButtonProps {
    targetUserId: string;
    initialIsFollowing: boolean;
    initialFollowerCount: number;
    isOwnProfile: boolean;
}

export default function FollowButton({
    targetUserId,
    initialIsFollowing,
    initialFollowerCount,
    isOwnProfile,
}: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [followerCount, setFollowerCount] = useState(initialFollowerCount);
    const [loading, setLoading] = useState(false);

    if (isOwnProfile) return null;

    const handleToggle = async () => {
        setLoading(true);
        const result = await toggleFollow(targetUserId);
        if (result.success) {
            setIsFollowing(result.isFollowing ?? false);
            setFollowerCount(result.followerCount ?? followerCount);
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center gap-2 mt-2">
            <button
                className={`btn btn-sm ${isFollowing ? "btn-ghost !border-[rgba(34,197,94,0.3)] !text-[#22C55E] hover:!border-[rgba(239,68,68,0.4)] hover:!text-[#ef4444]" : "btn-primary"}`}
                onClick={handleToggle}
                disabled={loading}
                id="follow-button"
            >
                {loading
                    ? "…"
                    : isFollowing
                        ? "✓ Following"
                        : "+ Follow"}
            </button>
            <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">
                {followerCount} follower{followerCount !== 1 ? "s" : ""}
            </span>
        </div>
    );
}
