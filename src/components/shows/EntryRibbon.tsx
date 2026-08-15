/**
 * v4 ENTRY RIBBON — the show page's at-a-glance surface. One or two
 * auto-scrolling rows of entry thumbnails (marquee), each linking
 * into its CLASS ROOM — see horses at a glance, then dig into the
 * class. Replaces the full-size photo wall, which stopped scaling
 * past ~30 entries (and would be unusable at 100).
 *
 * Server component, zero JS: the marquee is a CSS animation
 * (globals.css `entry-ribbon-*`) — pauses on hover/focus, and
 * prefers-reduced-motion turns it into a static scrollable row.
 * Blind-safe by construction: it renders only what the gallery
 * payload contains (horse names, never owners pre-reveal).
 */

import Link from "next/link";

import type { ShowGalleryData } from "@/lib/shows/gallery";

interface RibbonEntry {
    id: string;
    classId: string;
    className: string;
    horseName: string;
    entryNumber: number | null;
    photoUrl: string;
}

function Track({
    entries,
    showId,
    duplicate,
    thumbClass,
}: {
    entries: RibbonEntry[];
    showId: string;
    duplicate?: boolean;
    /** Sizing classes for the thumb image (row-count dependent). */
    thumbClass: string;
}) {
    return (
        <ul
            className={`m-0 flex list-none gap-2 p-0 pr-2 ${duplicate ? "entry-ribbon-dup" : ""}`}
            aria-hidden={duplicate || undefined}
        >
            {entries.map((entry) => (
                <li key={`${duplicate ? "dup-" : ""}${entry.id}`} className="shrink-0">
                    <Link
                        href={`/shows/${showId}/class/${entry.classId}`}
                        title={`${entry.horseName} — ${entry.className}`}
                        tabIndex={duplicate ? -1 : undefined}
                        className="group relative block overflow-hidden rounded-md border border-input"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={entry.photoUrl}
                            alt={`${entry.horseName} — entry in ${entry.className}`}
                            className={`${thumbClass} object-cover transition-transform group-hover:scale-105`}
                            loading="lazy"
                        />
                        <span className="absolute right-0 bottom-0 left-0 truncate bg-black/55 px-1.5 py-0.5 text-xs text-white">
                            {entry.entryNumber !== null ? `#${entry.entryNumber} · ` : ""}
                            {entry.horseName}
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

/** Two rows only at real volume — under this, one tall row. */
const TWO_ROW_THRESHOLD = 50;

export default function EntryRibbon({
    showId,
    gallery,
}: {
    showId: string;
    gallery: ShowGalleryData;
}) {
    const entries: RibbonEntry[] = gallery.classes.flatMap((cls) =>
        cls.entries
            .filter((e) => e.photoUrl)
            .map((e) => ({
                id: e.id,
                classId: cls.classId,
                className: cls.className,
                horseName: e.horseName,
                entryNumber: e.entryNumber,
                photoUrl: e.photoUrl!,
            })),
    );
    if (entries.length === 0) {
        return (
            <div className="ledger-card">
                <span className="ledger-tab">Entries</span>
                <p className="text-sm text-muted-foreground">
                    The ribbon fills up once entries open — every entry photo lands here.
                </p>
            </div>
        );
    }

    // One TALL row by default; a second row only at real volume,
    // alternating so ring neighbors differ.
    const twoRows = entries.length >= TWO_ROW_THRESHOLD;
    const rows: RibbonEntry[][] = twoRows
        ? [entries.filter((_, i) => i % 2 === 0), entries.filter((_, i) => i % 2 === 1)]
        : [entries];
    const thumbClass = twoRows ? "h-28 w-40" : "h-48 w-64";

    return (
        <section aria-label="All entries at a glance" className="flex flex-col gap-2">
            {rows.map((row, rowIndex) => (
                <div
                    key={rowIndex}
                    className="entry-ribbon rounded-lg"
                    style={
                        {
                            // ~4s per thumbnail; second row drifts slower so
                            // the two never sync into a wall.
                            "--ribbon-duration": `${row.length * 4 + rowIndex * 11}s`,
                        } as React.CSSProperties
                    }
                >
                    <div className="entry-ribbon-track">
                        <Track entries={row} showId={showId} thumbClass={thumbClass} />
                        <Track entries={row} showId={showId} thumbClass={thumbClass} duplicate />
                    </div>
                </div>
            ))}
            <p className="m-0 text-xs text-muted-foreground">
                {entries.length} entries · tap a horse to visit its class room
            </p>
        </section>
    );
}
