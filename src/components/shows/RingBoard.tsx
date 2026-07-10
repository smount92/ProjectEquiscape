"use client";

/**
 * Phase E2 — THE ANNOUNCER BOARD (/shows/host/[id]/ring/board):
 * a read-only, big-type view of NOW JUDGING / ON DECK / latest
 * results, meant to be PROJECTED at the venue or shared to
 * entrants' phones. Public by design — it shows only class names
 * and placed results, the same data as the results page.
 *
 * Refresh: POLLING (~10s) against the public getRingBoard action.
 * The repo's Realtime pattern (NotificationProvider) subscribes to
 * per-user channels on tables in the realtime publication; the
 * shows tables are not published for Realtime (no migration adds
 * them, and adding one is out of scope for a projector view), so
 * a slow poll is the honest fit here — the board changes at the
 * pace of a class being judged, not per keystroke.
 */

import { useEffect, useState } from "react";

import { getRingBoard } from "@/app/actions/shows-v2-ring";
import { placeLabel, ribbonHex } from "@/lib/shows/placings";
import type { BoardClassRef, RingBoardData } from "@/lib/shows/ring";

const POLL_MS = 10_000;

function classLine(ref: BoardClassRef): string {
    return ref.classNumber ? `${ref.classNumber} · ${ref.className}` : ref.className;
}

export default function RingBoard({ initial }: { initial: RingBoardData }) {
    const [board, setBoard] = useState<RingBoardData>(initial);

    useEffect(() => {
        let stopped = false;
        const tick = async () => {
            // Skip work while the tab is hidden (projector stays visible).
            if (document.hidden) return;
            try {
                const result = await getRingBoard({ showId: initial.show.id });
                if (!stopped && result.success) setBoard(result.board);
            } catch {
                // Offline blip — keep showing the last good board.
            }
        };
        const interval = window.setInterval(() => void tick(), POLL_MS);
        return () => {
            stopped = true;
            window.clearInterval(interval);
        };
    }, [initial.show.id]);

    const running = board.show.status === "running";

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
            <header className="text-center">
                <h1 className="m-0 font-serif text-2xl font-bold text-foreground sm:text-4xl">
                    {board.show.title}
                </h1>
                <p className="m-0 mt-2 text-sm text-muted-foreground sm:text-lg">
                    {board.placedCount} of {board.totalCount} classes placed
                </p>
            </header>

            {!running ? (
                <section className="leather-panel stitched rounded-lg p-8 text-center">
                    <p className="m-0 text-xl font-bold text-(--leather-text) sm:text-3xl">
                        The ring is quiet
                    </p>
                    <p className="m-0 mt-2 text-sm text-(--leather-text-soft) sm:text-lg">
                        Results light up here while the show runs.
                    </p>
                </section>
            ) : (
                <section
                    className="leather-panel stitched rounded-lg p-6 text-center sm:p-10"
                    aria-label="Now judging"
                >
                    <p className="m-0 text-sm font-semibold tracking-widest uppercase text-(--leather-text-muted) sm:text-lg">
                        Now judging
                    </p>
                    {board.nowJudging ? (
                        <>
                            <p
                                className="m-0 mt-2 font-serif text-3xl font-bold text-(--leather-text) sm:text-6xl"
                                data-testid="board-now"
                            >
                                {classLine(board.nowJudging)}
                            </p>
                            <p className="m-0 mt-2 text-sm text-(--leather-text-soft) sm:text-xl">
                                {board.nowJudging.divisionName} · {board.nowJudging.sectionName}
                            </p>
                        </>
                    ) : (
                        <p className="m-0 mt-2 text-2xl font-bold text-(--leather-text) sm:text-4xl">
                            Between classes
                        </p>
                    )}
                    {board.onDeck && (
                        <p className="m-0 mt-6 text-sm text-(--leather-text-soft) sm:text-2xl">
                            <span className="font-semibold tracking-widest uppercase text-(--leather-text-muted)">
                                On deck:
                            </span>{" "}
                            <span className="text-(--leather-text)" data-testid="board-on-deck">
                                {classLine(board.onDeck)}
                            </span>
                        </p>
                    )}
                </section>
            )}

            {board.latestResults.length > 0 && (
                <section aria-label="Latest results" className="flex flex-col gap-4">
                    <h2 className="m-0 text-center font-serif text-xl font-bold text-foreground sm:text-3xl">
                        Latest results
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {board.latestResults.map((result) => (
                            <div
                                key={`${result.divisionName}-${result.className}`}
                                className="ledger-card"
                                data-testid="board-result"
                            >
                                <span className="ledger-tab">{classLine(result)}</span>
                                <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                                    {result.placings.map((p) => (
                                        <li
                                            key={`${p.place}-${p.entryNumber}`}
                                            className="flex items-baseline gap-3"
                                        >
                                            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground sm:text-xl">
                                                <span
                                                    aria-hidden="true"
                                                    className="inline-block h-3 w-3 rounded-full border border-border"
                                                    style={{
                                                        backgroundColor:
                                                            ribbonHex(p.place) ?? undefined,
                                                    }}
                                                />
                                                {placeLabel(p.place)}
                                            </span>
                                            <span className="font-mono text-lg font-bold sm:text-2xl">
                                                {p.entryNumber !== null
                                                    ? `#${p.entryNumber}`
                                                    : "—"}
                                            </span>
                                            <span className="truncate text-sm text-muted-foreground sm:text-lg">
                                                {p.horseName}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
