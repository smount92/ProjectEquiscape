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
 *
 * Wave 4b: the countdown + T-0 self-refresh moved to ShowCountdown
 * so the album masthead's status line shares it — same behavior,
 * same rendered markup, one implementation.
 */

import type { ShowJudging, ShowStatus } from "@/lib/shows/types";
import LocalTime from "./LocalTime";
import ShowCountdown from "./ShowCountdown";

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
                countdown = <ShowCountdown target={entriesOpenAt} />;
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
