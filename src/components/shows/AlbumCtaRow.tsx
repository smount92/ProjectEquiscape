"use client";

/**
 * Wave 4b — the STICKY CTA ROW, pinned under the site header while
 * the visitor wanders the wall. Primary brass "Enter this show" goes
 * to the entry page (/shows/[id]/enter — the single owner of
 * entering). Anon visitors get the 4a sign-in-with-redirect pattern
 * instead, landing back on the entry page. Secondary: follow, share.
 * If the viewer has entries, a compact pill jumps to #entries.
 *
 * The row only ever links — every entry rule stays with the server
 * (validateEntry + RLS).
 */

import Link from "next/link";

import type { ShowMode, ShowStatus } from "@/lib/shows/types";
import ShareButton from "@/components/ShareButton";
import ShowFollowButton from "@/components/shows/ShowFollowButton";

interface AlbumCtaRowProps {
    showId: string;
    showTitle: string;
    mode: ShowMode;
    status: ShowStatus;
    authed: boolean;
    /** The viewer's LIVE entries (scratched excluded) — the pill. */
    myEntryCount: number;
    /** False = migration 184 unapplied; the Follow control is hidden. */
    followSupported?: boolean;
    /** The viewer's current follow state (false for anon). */
    isFollowing?: boolean;
}

export default function AlbumCtaRow({
    showId,
    showTitle,
    mode,
    status,
    authed,
    myEntryCount,
    followSupported = false,
    isFollowing = false,
}: AlbumCtaRowProps) {
    const entriesOpen = status === "entries_open";
    const enterHref = `/shows/${showId}/enter`;

    return (
        <div
            className="sticky top-(--header-height) z-40 -mx-1 flex flex-wrap items-center gap-2 border-b border-input bg-background/95 px-1 py-2 backdrop-blur-md sm:gap-3"
            data-testid="album-cta-row"
        >
            {entriesOpen &&
                (authed ? (
                    <Link href={enterHref} className="btn-brass" data-testid="album-enter-cta">
                        Enter this show
                    </Link>
                ) : (
                    <Link
                        href={`/login?redirectTo=${encodeURIComponent(enterHref)}`}
                        className="btn-brass"
                        data-testid="album-enter-cta"
                    >
                        Sign in to enter
                    </Link>
                ))}
            {/* Follow sits beside Enter, not inside it: the visitor
                who is still deciding is exactly who this is for. */}
            <ShowFollowButton
                showId={showId}
                showTitle={showTitle}
                authed={authed}
                supported={followSupported}
                initialIsFollowing={isFollowing}
            />
            <span className="text-foreground">
                <ShareButton
                    title={showTitle}
                    text={`${showTitle} — a ${mode === "live" ? "live" : "online"} model horse show on Model Horse Hub`}
                />
            </span>
            {authed && myEntryCount > 0 && (
                <a
                    href="#entries"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-forest/40 bg-card px-3 py-1 text-xs font-semibold text-forest no-underline hover:bg-forest/10"
                    data-testid="album-my-entries-pill"
                >
                    Your entries: {myEntryCount}
                    <span aria-hidden="true">↓</span>
                </a>
            )}
        </div>
    );
}
