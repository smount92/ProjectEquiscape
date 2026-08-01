"use client";

/**
 * THE STATE BANNER — one honest sentence about where the show sits in
 * its lifecycle, on a lit-paper strip in the masthead, in the ledger's
 * rubber-stamp language. Times render in the viewer's timezone
 * (LocalTime); when entries open within 24 hours a live countdown
 * ticks beside the date.
 */

import { useSyncExternalStore } from "react";

import type { ShowStatus } from "@/lib/shows/types";
import LocalTime from "./LocalTime";

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

/** Live tick to entries-open, shown only inside the final 24 hours. */
function Countdown({ target }: { target: string }) {
    const nowSeconds = useSyncExternalStore(
        subscribeToClock,
        clockSecondsSnapshot,
        clockServerSnapshot,
    );
    if (nowSeconds === null) return null;
    const targetMs = new Date(target).getTime();
    if (Number.isNaN(targetMs)) return null;
    const remaining = targetMs - nowSeconds * 1000;
    if (remaining > DAY_MS) return null;
    // A little grace past zero for hosts/cron flipping the status; a
    // long-stale open date just shows its (past) date with no ticker.
    if (remaining <= -60 * 60 * 1000) return null;
    return (
        <span className="font-mono text-sm font-bold tabular-nums text-(--paper-lit-ink)">
            {remaining <= 0
                ? "Opening any moment — refresh to enter"
                : `Opens in ${Math.floor(remaining / 3_600_000)}h ${String(
                      Math.floor((remaining % 3_600_000) / 60_000),
                  ).padStart(2, "0")}m ${String(Math.floor((remaining % 60_000) / 1000)).padStart(
                      2,
                      "0",
                  )}s`}
        </span>
    );
}

export default function ShowStateBanner({
    status,
    entriesOpenAt,
    entriesCloseAt,
}: {
    status: ShowStatus;
    entriesOpenAt: string | null;
    entriesCloseAt: string | null;
}) {
    let stampWord: string;
    let message: React.ReactNode;
    let countdown: React.ReactNode = null;

    switch (status) {
        case "published":
            stampWord = "Upcoming";
            if (entriesOpenAt) {
                message = (
                    <>
                        Entries open <LocalTime iso={entriesOpenAt} withTime />
                    </>
                );
                countdown = <Countdown target={entriesOpenAt} />;
            } else {
                message = "Entries open soon — watch this page.";
            }
            break;
        case "entries_open":
            stampWord = "Entries open";
            message = entriesCloseAt ? (
                <>
                    Entries are open — close <LocalTime iso={entriesCloseAt} withTime />
                </>
            ) : (
                "Entries are open."
            );
            break;
        case "entries_closed":
        case "running":
        case "judging":
            stampWord = "Judging";
            message = "Judging in progress.";
            break;
        case "results_review":
            stampWord = "Results soon";
            message = "Results are being finalized.";
            break;
        case "completed":
        case "archived":
            stampWord = "Final";
            message = "Results are final.";
            break;
        default:
            return null;
    }

    return (
        <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-(--paper-lit) px-4 py-3"
            data-testid="show-state-banner"
        >
            <span className="stamp">{stampWord}</span>
            <span className="text-sm font-medium text-(--paper-lit-ink)">{message}</span>
            {countdown}
        </div>
    );
}
