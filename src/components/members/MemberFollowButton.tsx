"use client";

/**
 * The Follow control on a collector card.
 *
 * Reuses the existing `toggleFollow` server action verbatim (same action
 * the profile page's FollowButton calls) — this component only owns the
 * card-sized presentation and the optimistic state. Unlike the old
 * Discover grid it ROLLS BACK when the action reports failure, so a
 * rejected follow does not leave a card lying about its state.
 */

import { useState, useTransition } from "react";

import { toggleFollow } from "@/app/actions/follows";

export default function MemberFollowButton({
    targetUserId,
    aliasName,
    initialIsFollowing,
}: {
    targetUserId: string;
    aliasName: string;
    initialIsFollowing: boolean;
}) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [failed, setFailed] = useState(false);
    const [isPending, startTransition] = useTransition();

    function onClick() {
        if (isPending) return;
        const next = !isFollowing;
        setIsFollowing(next);
        setFailed(false);
        startTransition(async () => {
            const result = await toggleFollow(targetUserId);
            if (result.success) {
                setIsFollowing(result.isFollowing ?? next);
            } else {
                setIsFollowing(!next);
                setFailed(true);
            }
        });
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isPending}
            aria-pressed={isFollowing}
            aria-label={
                isFollowing ? `Unfollow ${aliasName}` : `Follow ${aliasName}`
            }
            title={failed ? "That didn't go through — try again" : undefined}
            className={`studio-chip shrink-0 ${isFollowing ? "active" : ""} ${
                isPending ? "opacity-60" : ""
            }`}
        >
            {isFollowing ? "✓ Following" : "+ Follow"}
        </button>
    );
}
