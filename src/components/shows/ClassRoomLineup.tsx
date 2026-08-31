"use client";

/**
 * v4 CLASS ROOM — the interactive lineup. Client side of
 * ClassRoomPage (which stays a server component):
 *
 *   - "Lean in": every photo opens the shared PhotoLightbox as a
 *     reel over THIS CLASS's entries — flip through the lineup with
 *     arrows/swipe exactly like working down a show table.
 *   - Community-vote shows: the same VoteButton as the wall — the
 *     room must carry the hearts or funneling viewers here would
 *     quietly break voting.
 *
 * Vote handling is castVote/removeVote + refresh.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { castVote, removeVote } from "@/app/actions/shows-v2";
import type { ClassRoomEntry, GalleryEntry } from "@/lib/shows/gallery";
import type { Rubric } from "@/lib/shows/rubrics";
import ScorecardPanel from "@/components/shows/ScorecardPanel";
import { placeLabel } from "@/lib/shows/placings";
import type { Place } from "@/lib/shows/types";
import PhotoLightbox from "@/components/PhotoLightbox";
import VoteButton from "@/components/shows/VoteButton";
import { useShowToast } from "@/components/shows/useShowToast";

const DOC_KIND_LABELS: Record<string, string> = {
    breed: "Breed documentation",
    performance: "Performance documentation",
    collectibility: "Collectibility documentation",
    other: "Documentation",
};

/** VoteButton speaks GalleryEntry; the room entry is a superset. */
function asGalleryEntry(entry: ClassRoomEntry): GalleryEntry {
    return {
        id: entry.id,
        horseId: entry.horseId,
        horseName: entry.horseName,
        entryNumber: entry.entryNumber,
        photoUrl: entry.photoUrl,
        ownerAlias: entry.ownerAlias,
        ownerId: entry.ownerId,
        voteCount: entry.voteCount,
        viewerHasVoted: entry.viewerHasVoted,
        isOwn: entry.isOwn,
        place: entry.place,
    };
}

interface ClassRoomLineupProps {
    entries: ClassRoomEntry[];
    revealed: boolean;
    votingEnabled: boolean;
    votingOpen: boolean;
    authed: boolean;
    /** THIS class's results are public — placed entries lead 2-up. */
    resultsPublished: boolean;
    /** Scored judging (205): rubric + class averages, once published. */
    rubric?: Rubric | null;
    scoreAverages?: Record<string, number> | null;
}

export default function ClassRoomLineup({
    entries,
    revealed,
    votingEnabled,
    votingOpen,
    authed,
    resultsPublished,
    rubric = null,
    scoreAverages = null,
}: ClassRoomLineupProps) {
    const router = useRouter();
    const { showToast, toastNode } = useShowToast();
    const [pendingVote, setPendingVote] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // The reel: this lineup's photos in card order.
    const reel = useMemo(
        () =>
            entries
                .filter((e) => e.photoUrl)
                .map((e) => ({
                    url: e.photoUrl!,
                    label: `${e.entryNumber !== null ? `#${e.entryNumber} · ` : ""}${e.horseName}`,
                })),
        [entries],
    );
    const reelIndexByEntry = useMemo(() => {
        const map = new Map<string, number>();
        let i = 0;
        for (const e of entries) if (e.photoUrl) map.set(e.id, i++);
        return map;
    }, [entries]);

    const handleVoteToggle = async (galleryEntry: GalleryEntry) => {
        if (pendingVote) return;
        setPendingVote(galleryEntry.id);
        setError(null);
        const result = galleryEntry.viewerHasVoted
            ? await removeVote({ entryId: galleryEntry.id })
            : await castVote({ entryId: galleryEntry.id });
        if (!result.success) {
            setError(result.error);
        } else {
            showToast(
                galleryEntry.viewerHasVoted
                    ? "Vote removed."
                    : `Vote counted — thanks for judging ${galleryEntry.horseName}!`,
            );
            router.refresh();
        }
        setPendingVote(null);
    };

    const placed = resultsPublished ? entries.filter((e) => e.place !== null) : [];
    const rest = resultsPublished ? entries.filter((e) => e.place === null) : entries;
    const showRail = placed.length > 0;

    const renderCard = (entry: ClassRoomEntry) => {
                    const isPlaced = entry.place !== null;
                    const reelIndex = reelIndexByEntry.get(entry.id);
                    return (
                        <article
                            key={entry.id}
                            className={`ledger-card flex flex-col gap-3 ${entry.isOwn ? "ring-1 ring-ring" : ""}`}
                            aria-label={`Entry ${entry.entryNumber ?? ""} — ${entry.horseName}`}
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="ledger-tab">
                                    {isPlaced
                                        ? placeLabel(entry.place as Place)
                                        : `Entry ${entry.entryNumber ?? "—"}`}
                                </span>
                                {/* Season-felt: a placing SAYS what it paid
                                    and whether it minted a card. */}
                                <span className="flex items-center gap-1.5">
                                    {isPlaced && entry.pointsEarned !== null && entry.pointsEarned > 0 && (
                                        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-forest tabular-nums">
                                            +{entry.pointsEarned} pt{entry.pointsEarned === 1 ? "" : "s"}
                                        </span>
                                    )}
                                    {entry.cardCode && (
                                        <Link
                                            href={`/cards/${entry.cardCode}`}
                                            className={`rounded-full px-2 py-0.5 text-xs font-bold no-underline ${
                                                entry.cardIsStakes
                                                    ? "bg-[color:var(--color-warning)]/20 text-[color:var(--color-warning)]"
                                                    : "bg-forest/10 text-forest"
                                            }`}
                                            title="View this qualification card"
                                        >
                                            {entry.cardIsStakes ? "🎖️ STAKES card" : "🎖️ Card"}
                                        </Link>
                                    )}
                                    {isPlaced && (
                                        <span className="text-xs text-muted-foreground">
                                            Leg tag {entry.entryNumber ?? "—"}
                                        </span>
                                    )}
                                    {entry.isOwn && !isPlaced && (
                                        <span className="text-xs text-muted-foreground">Your entry</span>
                                    )}
                                </span>
                            </div>

                            {entry.photoUrl ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        reelIndex !== undefined && setLightboxIndex(reelIndex)
                                    }
                                    className="group block cursor-zoom-in overflow-hidden rounded-md border border-input p-0"
                                    aria-label={`View ${entry.horseName} full size`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={entry.photoUrl}
                                        alt={`${entry.horseName} — entry photo`}
                                        className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </button>
                            ) : (
                                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-input">
                                    <span className="text-sm text-muted-foreground">
                                        No photo attached
                                    </span>
                                </div>
                            )}

                            <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    {entry.horseId && entry.horseName !== "Unnamed horse" ? (
                                        <Link
                                            href={`/community/${entry.horseId}`}
                                            className="truncate font-medium hover:underline"
                                        >
                                            {entry.horseName}
                                        </Link>
                                    ) : (
                                        <span className="truncate font-medium">{entry.horseName}</span>
                                    )}
                                    {revealed && entry.ownerAlias && (
                                        <span className="truncate text-sm text-muted-foreground">
                                            shown by @{entry.ownerAlias}
                                        </span>
                                    )}
                                </div>
                                {votingEnabled && (
                                    <VoteButton
                                        entry={asGalleryEntry(entry)}
                                        votingOpen={votingOpen}
                                        authed={authed}
                                        pending={pendingVote === entry.id}
                                        onToggle={handleVoteToggle}
                                    />
                                )}
                            </div>

                            {entry.document && (
                                <details className="rounded-md border border-input px-3 py-2">
                                    <summary className="cursor-pointer text-sm font-medium">
                                        {DOC_KIND_LABELS[entry.document.kind] ?? "Documentation"}:{" "}
                                        {entry.document.title}
                                    </summary>
                                    <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                                        {entry.document.bodyMd}
                                    </p>
                                </details>
                            )}

                            {rubric && entry.scoreData && (
                                <details className="border-input rounded-md border px-3 py-2" open={entry.isOwn}>
                                    <summary className="cursor-pointer text-sm font-medium">
                                        🎯 Scorecard
                                        {entry.scoreTotal != null && (
                                            <span className="text-muted-foreground"> — {entry.scoreTotal}/100</span>
                                        )}
                                    </summary>
                                    <div className="mt-2">
                                        <ScorecardPanel
                                            rubric={rubric}
                                            scores={entry.scoreData}
                                            total={entry.scoreTotal}
                                            averages={scoreAverages}
                                            horseName={entry.horseName}
                                        />
                                    </div>
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
                                            <p className="text-sm whitespace-pre-wrap">
                                                {entry.photoCritique}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </article>
                    );
    };

    return (
        <>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {/* ── The ribbon rail: placed entries lead, 2-up ── */}
            {showRail && (
                <section aria-label="Placings" className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {placed.map(renderCard)}
                    </div>
                </section>
            )}

            {/* ── The lineup ── */}
            <section aria-label="The lineup" className="flex flex-col gap-3">
                <div className="ledger-card">
                    <span className="ledger-tab">
                        {showRail ? "The rest of the lineup" : "The lineup"}
                    </span>
                    <p className="text-sm text-muted-foreground">
                        {entries.length === 0
                            ? "No entries yet — the lineup fills as entries come in."
                            : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} in this class — tap a photo to look closer.`}
                    </p>
                </div>
                {rest.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {rest.map(renderCard)}
                    </div>
                )}
            </section>

            {lightboxIndex !== null && reel.length > 0 && (
                <PhotoLightbox
                    images={reel}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}
            {toastNode}
        </>
    );
}
