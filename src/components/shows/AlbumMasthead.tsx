"use client";

/**
 * Wave 4b — the COMPACT leather masthead (Mock A). Photos first
 * means the masthead earns its height: title, host line, and ONE
 * status line on a lit-paper strip — status dot, plain-words
 * status, the date that matters right now, entry count, fee — with
 * a "Details" disclosure that expands the full fact grid (windows
 * with viewer-timezone rendering, venue for live shows,
 * sanctioning, full fee text).
 *
 * The countdown + T-0 self-refresh is ShowCountdown — the SAME
 * component the legacy state banner uses, not a copy. The legacy
 * banner's `show-state-banner` testid stays on the flag-off path
 * only; this line answers to `album-status-line`.
 */

import Link from "next/link";

import type { PublicShow } from "@/lib/shows/public";
import type { ShowStatus } from "@/lib/shows/types";
import { feeText, friendlyShowStatus } from "@/lib/shows/plainWords";
import { showYearLabel } from "@/lib/shows/showYear";
import LocalTime from "./LocalTime";
import ShowCountdown from "./ShowCountdown";

/** Status dot ink — absolute signal colors (not themed), sitting on
 *  the lit-paper strip in both day and Lamplight. */
const STATUS_DOT: Record<ShowStatus, string> = {
    draft: "#78716c", // never public, but the map stays total
    published: "#D97706", // amber — upcoming
    entries_open: "#16A34A", // green — the door is open
    entries_closed: "#2563EB", // blue — in motion
    running: "#2563EB",
    judging: "#2563EB",
    results_review: "#7C3AED", // purple — results near
    completed: "#B08D3E", // brass — final
    archived: "#B08D3E",
};

/** Fee text stays on the one line only while it reads like a fee,
 *  not a paragraph — long instructions live in the details grid. */
const FEE_INLINE_MAX = 24;

function DetailsFact({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === "") return null;
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold tracking-wide uppercase text-(--paper-lit-ink) opacity-75">
                {label}
            </dt>
            <dd className="m-0 text-sm text-(--paper-lit-ink)">{value}</dd>
        </div>
    );
}

/** The date phrase that matters for the CURRENT moment of the show —
 *  the rest live behind the Details disclosure. Plain function (not
 *  a component) so the caller can test for null before printing the
 *  "·" separator; the LocalTime elements inside stay components. */
function statusDateBit(show: PublicShow): React.ReactNode {
    if (show.mode === "live") {
        if (!show.showDate || ["completed", "archived"].includes(show.status)) return null;
        return (
            <>
                show day <LocalTime iso={show.showDate} />
            </>
        );
    }
    switch (show.status) {
        case "published":
            return show.entriesOpenAt ? (
                <>
                    opens <LocalTime iso={show.entriesOpenAt} withTime />
                </>
            ) : (
                <>entries open soon</>
            );
        case "entries_open":
            return show.entriesCloseAt ? (
                <>
                    closes <LocalTime iso={show.entriesCloseAt} withTime />
                </>
            ) : null;
        case "entries_closed":
        case "judging":
            return show.judgingEndsAt ? (
                <>
                    {show.judging === "community_vote" ? "voting" : "judging"} ends{" "}
                    <LocalTime iso={show.judgingEndsAt} withTime />
                </>
            ) : null;
        default:
            return null;
    }
}

export default function AlbumMasthead({
    show,
    entryCount,
}: {
    show: PublicShow;
    entryCount: number;
}) {
    const fee = feeText(show.feeInfo);
    const feeInline = fee.length <= FEE_INLINE_MAX ? fee : "fees apply — see details";
    const statusWord =
        show.status === "judging" && show.judging === "community_vote"
            ? "Voting open"
            : friendlyShowStatus(show.status);
    const dateBit = statusDateBit(show);

    return (
        <section
            className="leather-panel stitched flex flex-col gap-3 rounded-lg p-5 sm:p-6"
            aria-label="Show overview"
        >
            <div className="flex flex-col gap-1">
                <h1 className="m-0 font-serif text-xl font-bold tracking-tight text-(--leather-text) sm:text-2xl">
                    {show.title}
                </h1>
                <p className="m-0 text-sm text-(--leather-text-muted)">
                    Hosted by{" "}
                    <Link
                        href={`/profile/${encodeURIComponent(show.hostAlias)}`}
                        className="font-medium text-(--leather-text) hover:underline"
                    >
                        @{show.hostAlias}
                    </Link>{" "}
                    · {show.mode === "live" ? "Live show" : "Online photo show"}
                    {show.judging === "community_vote" && " · Community vote"}
                    {show.isMhhQualifying &&
                        ` · 🏅 MHH Sanctioned${show.showYear !== null ? ` · ${showYearLabel(show.showYear)} season` : ""}`}
                </p>
            </div>

            {/* THE one status line, expandable to the full fact grid. */}
            <details className="group rounded-md bg-(--paper-lit)">
                <summary
                    className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm font-medium text-(--paper-lit-ink) [&::-webkit-details-marker]:hidden"
                    data-testid="album-status-line"
                >
                    <span
                        aria-hidden="true"
                        className="mr-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
                        style={{ backgroundColor: STATUS_DOT[show.status] }}
                    />
                    <span className="font-semibold">{statusWord}</span>
                    {dateBit !== null && (
                        <span>
                            <span aria-hidden="true">· </span>
                            {dateBit}
                        </span>
                    )}
                    {show.status === "published" && show.entriesOpenAt && (
                        <ShowCountdown target={show.entriesOpenAt} />
                    )}
                    <span>
                        <span aria-hidden="true">· </span>
                        {entryCount > 0
                            ? `${entryCount} entr${entryCount === 1 ? "y" : "ies"}`
                            : "no entries yet"}
                    </span>
                    <span>
                        <span aria-hidden="true">· </span>
                        {feeInline}
                    </span>
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold tracking-wide uppercase">
                        Details
                        <span
                            aria-hidden="true"
                            className="inline-block transition-transform group-open:rotate-180"
                        >
                            ▾
                        </span>
                    </span>
                </summary>
                <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-black/10 px-4 py-3 sm:grid-cols-3">
                    {show.mode === "live" ? (
                        <>
                            <DetailsFact
                                label="Show date"
                                value={show.showDate ? <LocalTime iso={show.showDate} /> : null}
                            />
                            <DetailsFact label="Venue" value={show.venueName} />
                            <DetailsFact label="Address" value={show.venueAddress} />
                            <DetailsFact
                                label="Entries close"
                                value={
                                    show.entriesCloseAt ? (
                                        <LocalTime iso={show.entriesCloseAt} withTime />
                                    ) : null
                                }
                            />
                        </>
                    ) : (
                        <>
                            <DetailsFact
                                label="Entries open"
                                value={
                                    show.entriesOpenAt ? (
                                        <LocalTime iso={show.entriesOpenAt} withTime />
                                    ) : null
                                }
                            />
                            <DetailsFact
                                label="Entries close"
                                value={
                                    show.entriesCloseAt ? (
                                        <LocalTime iso={show.entriesCloseAt} withTime />
                                    ) : null
                                }
                            />
                            <DetailsFact
                                label="Judging ends"
                                value={
                                    show.judgingEndsAt ? (
                                        <LocalTime iso={show.judgingEndsAt} withTime />
                                    ) : null
                                }
                            />
                        </>
                    )}
                    <DetailsFact
                        label="Fees"
                        value={<span className="whitespace-pre-wrap">{fee}</span>}
                    />
                    <DetailsFact label="Sanctioning" value={show.sanctioningNote} />
                </dl>
            </details>
        </section>
    );
}
