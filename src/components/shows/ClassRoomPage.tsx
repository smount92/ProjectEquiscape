/**
 * THE CLASS ROOM (v4) — one class rendered as a scene:
 *
 *   1. Ledger masthead — class number/name, section · division,
 *      one honest status line, back-link to the show program.
 *   2. THE LINEUP — every live entry side by side: photo, leg tag,
 *      horse name, owner (post-reveal), documentation disclosure.
 *   3. Once THIS class publishes (rolling reveal or show
 *      completion): placed entries lead with place chips and the
 *      judge's critique — model feedback and photo feedback kept
 *      visibly separate, so photography skill never reads as a
 *      model fault.
 *
 * Server component shell (masthead, program rail, chip strip); the
 * interactive lineup — lightbox reel + community-vote hearts — lives
 * in the ClassRoomLineup client child.
 * Styling: tokens + ledger/brass classes only (Lamplight-safe).
 */

import Link from "next/link";

import type { ClassRoomData } from "@/lib/shows/gallery";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import ClassRoomLineup from "@/components/shows/ClassRoomLineup";

function statusLine(room: ClassRoomData): string {
    if (room.room.resultsPublished) return "Results posted";
    switch (room.room.classStatus) {
        case "judging":
            return "Now judging";
        case "called":
            return "Class called";
        case "placed":
            return "Judged — results coming soon";
        case "cancelled":
            return "Class cancelled";
        case "combined":
            return "Combined into another class";
        default:
            return room.show.status === "entries_open"
                ? "Entries open — the lineup is filling"
                : "Waiting for the ring";
    }
}

function ProgramRail({ room }: { room: ClassRoomData }) {
    // Group consecutive classes under their section for scannability.
    const groups: { key: string; label: string; items: typeof room.program }[] = [];
    for (const item of room.program) {
        const key = `${item.divisionName} · ${item.sectionName}`;
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.items.push(item);
        else groups.push({ key, label: key, items: [item] });
    }
    return (
        <nav aria-label="All classes" className="flex flex-col gap-3">
            {groups.map((group) => (
                <div key={group.key}>
                    <p className="m-0 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {group.label}
                    </p>
                    <ul className="m-0 flex list-none flex-col p-0">
                        {group.items.map((item) => (
                            <li key={item.classId}>
                                <Link
                                    href={`/shows/${room.show.id}/class/${item.classId}`}
                                    aria-current={item.isCurrent ? "page" : undefined}
                                    className={`flex items-baseline justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-muted ${
                                        item.isCurrent ? "bg-muted font-semibold" : ""
                                    }`}
                                >
                                    <span className="truncate">
                                        {item.classNumber ? `${item.classNumber} · ` : ""}
                                        {item.className}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                        {item.entryCount}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

function ClassChipStrip({ room }: { room: ClassRoomData }) {
    return (
        <nav
            aria-label="All classes"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
        >
            {room.program.map((item) => (
                <Link
                    key={item.classId}
                    href={`/shows/${room.show.id}/class/${item.classId}`}
                    aria-current={item.isCurrent ? "page" : undefined}
                    className={`shrink-0 rounded-full border border-input px-3 py-1 text-xs whitespace-nowrap ${
                        item.isCurrent
                            ? "bg-muted font-semibold"
                            : "bg-card text-muted-foreground"
                    }`}
                >
                    {item.classNumber ?? item.className} · {item.entryCount}
                </Link>
            ))}
        </nav>
    );
}

export default function ClassRoomPage({ room }: { room: ClassRoomData }) {
    return (
        <ExplorerLayout frameless noHeader>
            <div className="flex flex-col gap-5">
                {/* ── Masthead (leather = light text via the leather vars,
                     matching AlbumMasthead) ── */}
                <header className="leather-panel stitched flex flex-col gap-2 rounded-lg p-5 sm:p-6">
                    <Link
                        href={`/shows/${room.show.id}`}
                        className="text-sm text-(--leather-text-muted) hover:underline"
                    >
                        ← {room.show.title}
                    </Link>
                    <h1 className="m-0 font-serif text-xl font-bold tracking-tight text-(--leather-text) sm:text-2xl">
                        {room.room.classNumber ? `Class ${room.room.classNumber} — ` : ""}
                        {room.room.className}
                    </h1>
                    <p className="m-0 text-sm text-(--leather-text-muted)">
                        {room.room.sectionName} · {room.room.divisionName} · {statusLine(room)}
                        {!room.revealed && room.show.blindBrowsing && " · blind browsing — exhibitors revealed with results"}
                    </p>
                    {/* Season-felt: the field this class is — what a win here means. */}
                    {room.room.isQualifying && room.room.liveEntryCount > 0 && (
                        <p className="m-0 text-xs text-(--leather-text-muted)">
                            🏅 Qualifying class · {room.room.liveEntryCount}{" "}
                            {room.room.liveEntryCount === 1 ? "entry" : "entries"} from{" "}
                            {room.room.distinctExhibitors}{" "}
                            {room.room.distinctExhibitors === 1 ? "exhibitor" : "exhibitors"} ·{" "}
                            <Link href="/shows/rules" className="underline decoration-dotted hover:text-(--leather-text)">
                                how points &amp; cards work
                            </Link>
                        </p>
                    )}
                    {/* Ring walk: prev/next in run order. */}
                    {(room.prev || room.next) && (
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                            {room.prev ? (
                                <Link
                                    href={`/shows/${room.show.id}/class/${room.prev.classId}`}
                                    className="truncate text-(--leather-text-muted) hover:underline"
                                >
                                    ← {room.prev.label}
                                </Link>
                            ) : (
                                <span />
                            )}
                            {room.next && (
                                <Link
                                    href={`/shows/${room.show.id}/class/${room.next.classId}`}
                                    className="truncate text-right font-medium text-(--leather-text) hover:underline"
                                >
                                    {room.next.label} →
                                </Link>
                            )}
                        </div>
                    )}
                </header>

                {/* Mobile: the whole program as a chip strip. */}
                <ClassChipStrip room={room} />

                <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
                    {/* Desktop: the program rail, sticky beside the room. */}
                    <aside className="hidden lg:block">
                        <div className="ledger-card sticky top-24 max-h-[75vh] overflow-y-auto">
                            <span className="ledger-tab">Program</span>
                            <ProgramRail room={room} />
                        </div>
                    </aside>

                    <div className="flex min-w-0 flex-col gap-5">
                {/* Staff preview: the judge's "what will they see" pass. */}
                {room.staffPreview && (
                    <div className="border-(--brass) bg-(--brass)/10 rounded-lg border border-dashed px-4 py-2.5 text-sm">
                        👁 <b>Judge&rsquo;s preview</b> — you&rsquo;re seeing this room as entrants
                        will when you publish. Placings, critiques and scorecards are live-editable
                        until then; points and qualification cards mint at publish.
                    </div>
                )}
                {/* Scored class, results out: the class recap — computed,
                    never typed. Tells the whole field where the points
                    lived and died, which is the teaching half of scored
                    judging (the scorecards are the personal half). */}
                {(room.room.resultsPublished || room.staffPreview) && room.rubric && room.scoreAverages && (() => {
                    const totals = room.entries
                        .map((e) => e.scoreTotal)
                        .filter((t): t is number => t != null);
                    if (totals.length === 0) return null;
                    const avgTotal =
                        Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10;
                    const ranked = room.rubric.criteria
                        .map((c) => ({ label: c.label, avg: room.scoreAverages?.[c.key] }))
                        .filter((c): c is { label: string; avg: number } => c.avg != null)
                        .sort((a, b) => b.avg - a.avg);
                    const high = ranked[0];
                    const low = ranked[ranked.length - 1];
                    return (
                        <div className="border-input bg-card rounded-lg border p-4">
                            <h3 className="text-foreground m-0 font-serif text-base font-bold">
                                📊 The class, in numbers
                            </h3>
                            <p className="text-secondary-foreground mt-1 mb-0 text-sm">
                                {totals.length} scored {totals.length === 1 ? "entry" : "entries"} ·
                                class average <b className="tabular-nums">{avgTotal}</b>/100
                                {high && low && high.label !== low.label && (
                                    <>
                                        {" "}· strongest on <b>{high.label.toLowerCase()}</b> ({high.avg}),
                                        points died on <b>{low.label.toLowerCase()}</b> ({low.avg})
                                    </>
                                )}
                                .
                            </p>
                        </div>
                    );
                })()}
                <ClassRoomLineup
                    entries={room.entries}
                    revealed={room.revealed}
                    votingEnabled={room.votingEnabled}
                    votingOpen={room.votingOpen}
                    authed={room.authed}
                    resultsPublished={room.room.resultsPublished || room.staffPreview}
                    rubric={room.rubric}
                    scoreAverages={room.scoreAverages}
                />
                    </div>
                </div>
            </div>
        </ExplorerLayout>
    );
}
