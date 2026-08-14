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
 * Server component, zero client JS — documentation uses <details>.
 * Styling: tokens + ledger/brass classes only (Lamplight-safe).
 */

import Link from "next/link";

import type { ClassRoomData, ClassRoomEntry } from "@/lib/shows/gallery";
import { placeLabel } from "@/lib/shows/placings";
import type { Place } from "@/lib/shows/types";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";

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

const DOC_KIND_LABELS: Record<string, string> = {
    breed: "Breed documentation",
    performance: "Performance documentation",
    collectibility: "Collectibility documentation",
    other: "Documentation",
};

function EntryCard({ entry, revealed }: { entry: ClassRoomEntry; revealed: boolean }) {
    const placed = entry.place !== null;
    return (
        <article
            className={`ledger-card flex flex-col gap-3 ${entry.isOwn ? "ring-1 ring-ring" : ""}`}
            aria-label={`Entry ${entry.entryNumber ?? ""} — ${entry.horseName}`}
        >
            <div className="flex items-baseline justify-between gap-2">
                <span className="ledger-tab">
                    {placed ? placeLabel(entry.place as Place) : `Entry ${entry.entryNumber ?? "—"}`}
                </span>
                {placed && (
                    <span className="text-xs text-muted-foreground">
                        Leg tag {entry.entryNumber ?? "—"}
                    </span>
                )}
                {entry.isOwn && !placed && (
                    <span className="text-xs text-muted-foreground">Your entry</span>
                )}
            </div>

            {entry.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={entry.photoUrl}
                    alt={`${entry.horseName} — entry photo`}
                    className="aspect-[4/3] w-full rounded-md border border-input object-cover"
                    loading="lazy"
                />
            ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-input">
                    <span className="text-sm text-muted-foreground">No photo attached</span>
                </div>
            )}

            <div className="flex flex-col gap-0.5">
                {entry.horseId ? (
                    <Link href={`/community/${entry.horseId}`} className="font-medium hover:underline">
                        {entry.horseName}
                    </Link>
                ) : (
                    <span className="font-medium">{entry.horseName}</span>
                )}
                {revealed && entry.ownerAlias && (
                    <span className="text-sm text-muted-foreground">shown by @{entry.ownerAlias}</span>
                )}
            </div>

            {entry.document && (
                <details className="rounded-md border border-input px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">
                        {DOC_KIND_LABELS[entry.document.kind] ?? "Documentation"}: {entry.document.title}
                    </summary>
                    <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                        {entry.document.bodyMd}
                    </p>
                </details>
            )}

            {(entry.critique || entry.photoCritique) && (
                <div className="flex flex-col gap-2 border-t border-input pt-3">
                    {entry.critique && (
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                Judge&apos;s critique — the model
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{entry.critique}</p>
                        </div>
                    )}
                    {entry.photoCritique && (
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                Judge&apos;s critique — the photo
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{entry.photoCritique}</p>
                        </div>
                    )}
                </div>
            )}
        </article>
    );
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
    const placed = room.entries.filter((e) => e.place !== null);
    const rest = room.entries.filter((e) => e.place === null);
    const showRibbonRail = room.room.resultsPublished && placed.length > 0;

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
                {/* ── The ribbon rail (published classes) ── */}
                {showRibbonRail && (
                    <section aria-labelledby="ribbon-rail-heading" className="flex flex-col gap-3">
                        <h2 id="ribbon-rail-heading" className="sr-only">
                            Placings
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {placed.map((entry) => (
                                <EntryCard key={entry.id} entry={entry} revealed={room.revealed} />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── The lineup ── */}
                <section aria-labelledby="lineup-heading" className="flex flex-col gap-3">
                    <div className="ledger-card">
                        <span className="ledger-tab" id="lineup-heading">
                            {showRibbonRail ? "The rest of the lineup" : "The lineup"}
                        </span>
                        <p className="text-sm text-muted-foreground">
                            {room.entries.length === 0
                                ? "No entries yet — the lineup fills as entries come in."
                                : `${room.entries.length} ${room.entries.length === 1 ? "entry" : "entries"} in this class.`}
                        </p>
                    </div>
                    {rest.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {rest.map((entry) => (
                                <EntryCard key={entry.id} entry={entry} revealed={room.revealed} />
                            ))}
                        </div>
                    )}
                </section>
                    </div>
                </div>
            </div>
        </ExplorerLayout>
    );
}
