"use client";

/**
 * "Follow this show" / "Following" — the lightweight subscription.
 *
 * The only relationship a member could previously have with a show was
 * entering a horse, so everyone still deciding heard nothing: no
 * reminder that entries close soon, no word when judging began, no
 * results announcement. This button is that missing relationship, and
 * it is deliberately one tap with no host approval.
 *
 * Optimistic with ROLLBACK on failure (the MemberFollowButton rule): a
 * control that lies about its state is worse than a slow one. Anon
 * visitors get the sign-in-with-redirect pattern the Enter CTA uses,
 * so the tap is never a dead end.
 *
 * Renders nothing at all when `supported` is false — that is migration
 * 184 not yet pasted, and the page must look exactly as it does today.
 */

import { useState, useTransition } from "react";
import Link from "next/link";

import { setShowFollow } from "@/app/actions/show-follow";

export default function ShowFollowButton({
    showId,
    showTitle,
    authed,
    supported,
    initialIsFollowing,
}: {
    showId: string;
    showTitle: string;
    authed: boolean;
    supported: boolean;
    initialIsFollowing: boolean;
}) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [failed, setFailed] = useState(false);
    const [isPending, startTransition] = useTransition();

    if (!supported) return null;

    if (!authed) {
        return (
            <Link
                href={`/login?redirectTo=${encodeURIComponent(`/shows/${showId}`)}`}
                className="studio-chip shrink-0 no-underline"
                data-testid="show-follow-cta"
            >
                ☆ Follow this show
            </Link>
        );
    }

    function onClick() {
        if (isPending) return;
        const next = !isFollowing;
        setIsFollowing(next);
        setFailed(false);
        startTransition(async () => {
            const result = await setShowFollow(showId, next);
            if (result.success) {
                setIsFollowing(result.isFollowing ?? next);
            } else {
                // Roll back — never leave the control claiming a
                // subscription the server did not accept.
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
                isFollowing
                    ? `Stop following ${showTitle}`
                    : `Follow ${showTitle} for updates`
            }
            title={
                failed
                    ? "That didn't go through — try again"
                    : isFollowing
                      ? "You'll hear when entries close, judging starts and results are up"
                      : "Get told when entries close, judging starts and results are up"
            }
            className={`studio-chip shrink-0 ${isFollowing ? "active" : ""} ${
                isPending ? "opacity-60" : ""
            }`}
            data-testid="show-follow-cta"
        >
            {isFollowing ? "★ Following" : "☆ Follow this show"}
        </button>
    );
}
