"use client";

/**
 * Wave 4b — THE WALL: every entry across all classes as one photo
 * wall (Mock A, photos first). Filter chips scroll horizontally —
 * "All horses", one chip per division with live counts, and
 * Program/Rules jump chips. Tapping a tile opens the WHOLE filtered
 * wall as one lightbox reel (swipe + arrows landed in 4a).
 *
 * The flatten/filter/count rules live in lib/shows/albumWall (pure,
 * unit-tested); this component is the thin renderer.
 *
 * BLINDNESS IS NOT THIS COMPONENT'S JOB: while the blind rule
 * holds, the server payload simply contains no owner identities.
 * Tiles never print owners in any state — horse name + class label
 * is the caption; identity stays the payload's decision.
 *
 * During community voting, VoteButton (4a) rides the tile. After
 * results publish, the ribbon-color dot + place label stamp the
 * winning tiles.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { castVote, removeVote } from "@/app/actions/shows-v2";
import {
    divisionChips,
    flattenGalleryToWall,
    reelIndexForTile,
    WALL_FILTER_ALL,
    type WallFilter,
    type WallTile,
    wallEntryCount,
    wallLightboxImages,
} from "@/lib/shows/albumWall";
import type { GalleryEntry, ShowGalleryData } from "@/lib/shows/gallery";
import { placeLabel, ribbonHex } from "@/lib/shows/placings";
import PhotoLightbox from "@/components/PhotoLightbox";
import VoteButton from "@/components/shows/VoteButton";
import { useShowToast } from "@/components/shows/useShowToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AlbumWallProps {
    /** For the anon sign-in CTA's redirect back to this show. */
    showId: string;
    gallery: ShowGalleryData;
    authed: boolean;
    /** Render the Rules jump chip only when the card exists. */
    hasRules: boolean;
}

const CHIP_BASE =
    "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors";

function FilterChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`${CHIP_BASE} ${
                active
                    ? "border-forest bg-forest text-white"
                    : "border-input bg-card text-foreground hover:border-forest/50"
            }`}
            data-testid="album-filter-chip"
        >
            {children}
        </button>
    );
}

function JumpChip({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a
            href={href}
            className={`${CHIP_BASE} border-dashed border-input bg-transparent text-muted-foreground no-underline hover:text-foreground`}
        >
            {children} <span aria-hidden="true">↓</span>
        </a>
    );
}

export default function AlbumWall({ showId, gallery, authed, hasRules }: AlbumWallProps) {
    const router = useRouter();
    const { showToast, toastNode } = useShowToast();
    const { classes, votingEnabled, votingOpen, revealed, resultsPublished } = gallery;

    const [filter, setFilter] = useState<WallFilter>(WALL_FILTER_ALL);
    const [pendingVote, setPendingVote] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // The reel index into the FILTERED wall's photo tiles.
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const chips = useMemo(() => divisionChips(classes), [classes]);
    const totalCount = useMemo(() => wallEntryCount(classes), [classes]);
    const tiles = useMemo(() => flattenGalleryToWall(classes, filter), [classes, filter]);
    const reel = useMemo(() => wallLightboxImages(tiles), [tiles]);

    const handleVoteToggle = async (entry: GalleryEntry) => {
        if (pendingVote) return;
        setPendingVote(entry.id);
        setError(null);
        const result = entry.viewerHasVoted
            ? await removeVote({ entryId: entry.id })
            : await castVote({ entryId: entry.id });
        if (!result.success) {
            setError(result.error);
        } else {
            showToast(
                entry.viewerHasVoted
                    ? "Vote removed."
                    : `Vote counted — thanks for judging ${entry.horseName}!`,
            );
            router.refresh();
        }
        setPendingVote(null);
    };

    const openLightbox = (tile: WallTile) => {
        const index = reelIndexForTile(tiles, tile);
        if (index >= 0) setLightboxIndex(index);
    };

    const pickFilter = (next: WallFilter) => {
        setFilter(next);
        setLightboxIndex(null);
    };

    return (
        <section aria-label={resultsPublished ? "Results wall" : "Entry wall"}>
            {/* Convention badges — only when they're saying something. */}
            {(votingEnabled || !revealed) && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    {votingEnabled && votingOpen && <Badge>Community voting open</Badge>}
                    {votingEnabled && !votingOpen && !resultsPublished && (
                        <Badge variant="secondary">Community vote</Badge>
                    )}
                    {!revealed && <Badge variant="outline">Blind browsing</Badge>}
                    {!revealed && (
                        <span className="text-xs text-muted-foreground">
                            Owner names are hidden until results publish — every entry stands
                            on its photo alone.
                        </span>
                    )}
                </div>
            )}

            {votingOpen && !authed && (
                <div
                    className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
                    role="note"
                >
                    <span>Community voting is open — sign in to vote for your favorites.</span>
                    <Button asChild size="sm">
                        <Link href={`/login?redirectTo=${encodeURIComponent(`/shows/${showId}`)}`}>
                            Sign in to vote
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/signup">Create free account</Link>
                    </Button>
                </div>
            )}

            {error && (
                <p role="alert" className="mb-3 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {/* ── Filter chips (horizontally scrollable) ── */}
            <div
                className="-mx-2 mb-3 flex gap-2 overflow-x-auto px-2 pb-1 sm:mx-0 sm:px-0"
                data-testid="album-filter-chips"
            >
                {totalCount > 0 && (
                    <>
                        <FilterChip
                            active={filter.kind === "all"}
                            onClick={() => pickFilter(WALL_FILTER_ALL)}
                        >
                            All horses · {totalCount}
                        </FilterChip>
                        {chips.map((chip) => (
                            <FilterChip
                                key={chip.divisionName}
                                active={
                                    filter.kind === "division" &&
                                    filter.divisionName === chip.divisionName
                                }
                                onClick={() =>
                                    pickFilter({
                                        kind: "division",
                                        divisionName: chip.divisionName,
                                    })
                                }
                            >
                                {chip.divisionName} · {chip.entryCount}
                            </FilterChip>
                        ))}
                    </>
                )}
                <JumpChip href="#program">Program</JumpChip>
                {hasRules && <JumpChip href="#rules">Rules</JumpChip>}
            </div>

            {/* ── The wall ── */}
            {totalCount === 0 ? (
                <div className="ledger-card">
                    <span className="ledger-tab">Entry Album</span>
                    <p className="text-sm text-muted-foreground">
                        No entries on the table yet — check back as the classes fill up.
                    </p>
                </div>
            ) : (
                <ul
                    className="grid list-none grid-cols-2 gap-1.5 p-0 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4"
                    data-testid="album-wall"
                >
                    {tiles.map((tile) => {
                        const { entry } = tile;
                        return (
                            <li
                                key={entry.id}
                                className="relative overflow-hidden rounded-md border border-input bg-card"
                                data-testid="wall-tile"
                            >
                                {entry.photoUrl ? (
                                    <button
                                        type="button"
                                        className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
                                        onClick={() => openLightbox(tile)}
                                        aria-label={`View ${entry.horseName} full size`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={entry.photoUrl}
                                            alt={entry.horseName}
                                            className="aspect-square w-full object-cover"
                                            loading="lazy"
                                        />
                                    </button>
                                ) : (
                                    <div
                                        className="flex aspect-square w-full items-center justify-center bg-muted text-4xl"
                                        aria-hidden="true"
                                    >
                                        🐴
                                    </div>
                                )}

                                {/* Ribbon stamp — results only. */}
                                {entry.place !== null && (
                                    <span
                                        className="absolute top-1.5 left-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-0.5 text-xs font-bold text-white"
                                        data-testid="wall-ribbon"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="inline-block h-2 w-2 rounded-full border border-white/40"
                                            style={{
                                                backgroundColor: ribbonHex(entry.place) ?? undefined,
                                            }}
                                        />
                                        {placeLabel(entry.place)}
                                    </span>
                                )}

                                {/* Bottom scrim caption — the gradient IS the
                                    contrast layer, over photo or placeholder. */}
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 pt-8 pb-1.5">
                                    <p className="m-0 line-clamp-2 text-[13px] leading-snug font-semibold text-white">
                                        {entry.horseName}
                                    </p>
                                    <p className="m-0 truncate text-xs text-white/75">
                                        {entry.entryNumber !== null && (
                                            <span className="font-mono text-white/60">
                                                #{entry.entryNumber} ·{" "}
                                            </span>
                                        )}
                                        {tile.classLabel}
                                    </p>
                                </div>

                                {votingEnabled && (
                                    <span className="absolute top-1.5 right-1.5">
                                        <VoteButton
                                            entry={entry}
                                            votingOpen={votingOpen}
                                            authed={authed}
                                            pending={pendingVote === entry.id}
                                            onToggle={handleVoteToggle}
                                        />
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {lightboxIndex !== null && (
                <PhotoLightbox
                    images={reel}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}

            {toastNode}
        </section>
    );
}
