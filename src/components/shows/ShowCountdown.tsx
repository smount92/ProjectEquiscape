"use client";

/**
 * THE ENTRIES-OPEN COUNTDOWN — extracted from ShowStateBanner (Wave
 * 4b) so the album masthead's status line and the legacy state
 * banner share ONE ticker + T-0 self-refresh, not two copies.
 *
 * Live tick to entries-open, shown only inside the final 24 hours.
 * Crossing T-0 refreshes the page data ONCE — if the cron has
 * flipped the show, the Enter buttons appear without the user doing
 * anything ("refresh to enter" is the fallback, not the
 * instruction).
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Once-a-second clock via useSyncExternalStore: null on the server
 *  (the static open date is already on the banner), whole seconds on
 *  the client so the snapshot is stable within each tick. */
function subscribeToClock(onTick: () => void): () => void {
    const id = setInterval(onTick, 1000);
    return () => clearInterval(id);
}
function clockSecondsSnapshot(): number {
    return Math.floor(Date.now() / 1000);
}
function clockServerSnapshot(): null {
    return null;
}

export default function ShowCountdown({
    target,
    className = "font-mono text-sm font-bold tabular-nums text-(--paper-lit-ink)",
}: {
    target: string;
    /** Ink varies by surface: lit-paper ink on the banner (default),
     *  leather ink on the album masthead. */
    className?: string;
}) {
    const router = useRouter();
    const refreshedAtZero = useRef(false);
    const nowSeconds = useSyncExternalStore(
        subscribeToClock,
        clockSecondsSnapshot,
        clockServerSnapshot,
    );

    const targetMs = new Date(target).getTime();
    const remaining =
        nowSeconds === null || Number.isNaN(targetMs) ? null : targetMs - nowSeconds * 1000;

    useEffect(() => {
        if (remaining === null || remaining > 0 || refreshedAtZero.current) return;
        refreshedAtZero.current = true;
        router.refresh();
    }, [remaining, router]);

    if (remaining === null) return null;
    if (remaining > DAY_MS) return null;
    // A little grace past zero for hosts/cron flipping the status; a
    // long-stale open date just shows its (past) date with no ticker.
    if (remaining <= -60 * 60 * 1000) return null;
    return (
        <span className={className}>
            {remaining <= 0
                ? "Opening any moment…"
                : `Opens in ${Math.floor(remaining / 3_600_000)}h ${String(
                      Math.floor((remaining % 3_600_000) / 60_000),
                  ).padStart(2, "0")}m ${String(Math.floor((remaining % 60_000) / 1000)).padStart(
                      2,
                      "0",
                  )}s`}
        </span>
    );
}
