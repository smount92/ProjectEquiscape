"use client";

/**
 * THE STATE BANNER — one honest sentence about where the show sits in
 * its lifecycle, on a lit-paper strip in the masthead, in the ledger's
 * rubber-stamp language. Times render in the viewer's timezone
 * (LocalTime); when entries open within 24 hours a live countdown
 * ticks beside the date — and at T-0 the page refreshes itself once,
 * so "refresh to enter" is the fallback, not the instruction.
 *
 * Wave 4a: entries_closed / running / judging each get their own
 * sentence (they are different moments), and community-vote judging
 * says "Voting is open!" because for those shows it literally is.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import type { ShowJudging, ShowStatus } from "@/lib/shows/types";
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

/** Live tick to entries-open, shown only inside the final 24 hours.
 *  Crossing T-0 refreshes the page data ONCE — if the cron has
 *  flipped the show, the Enter buttons appear without the user
 *  doing anything. */
function Countdown({ target }: { target: string }) {
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
        <span className="font-mono text-sm font-bold tabular-nums text-(--paper-lit-ink)">
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

export default function ShowStateBanner({
    status,
    judging,
    entriesOpenAt,
    entriesCloseAt,
}: {
    status: ShowStatus;
    /** Distinguishes "Voting is open!" from "Judging in progress." —
     *  optional so older callers keep the judged wording. */
    judging?: ShowJudging;
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
            stampWord = "Entries closed";
            message = "Entries are closed — judging starts soon.";
            break;
        case "running":
            stampWord = "Show day";
            message = "Show day is running — placings land as the classes are judged.";
            break;
        case "judging":
            if (judging === "community_vote") {
                stampWord = "Voting open";
                message = "Voting is open! Pick your favorites in the gallery below.";
            } else {
                stampWord = "Judging";
                message = "Judging in progress.";
            }
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
