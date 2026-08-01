"use client";

/**
 * Phase E1 — THE ENTRY GALLERY: the social heart of online photo
 * showing. Per-class photo grids ("walk the table"), lightbox
 * flip-through within each class, community-vote hearts with live
 * counts, and — once results publish — ribbons and revealed owners.
 *
 * BLINDNESS IS NOT THIS COMPONENT'S JOB: while the blind rule
 * holds, the server payload simply contains no owner identities
 * (ownerAlias/ownerId are null). This component renders what it is
 * given; it never hides anything with CSS.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { castVote, removeVote } from "@/app/actions/shows-v2";
import type { GalleryClass, GalleryEntry, ShowGalleryData } from "@/lib/shows/gallery";
import { placeLabel, ribbonHex } from "@/lib/shows/placings";
import PhotoLightbox from "@/components/PhotoLightbox";
import VoteButton from "@/components/shows/VoteButton";
import { useShowToast } from "@/components/shows/useShowToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ShowEntryGalleryProps {
    /** For the anon sign-in CTA's redirect back to this show. */
    showId: string;
    gallery: ShowGalleryData;
    authed: boolean;
}

function classLabel(cls: { classNumber: string | null; className: string }): string {
    return cls.classNumber ? `${cls.classNumber} · ${cls.className}` : cls.className;
}

/** Ribbon chip — place label + the hobby's ribbon color (from the
 *  ONE placings vocabulary; ribbon colors are absolute, not themed). */
function RibbonChip({ place }: { place: NonNullable<GalleryEntry["place"]> }) {
    return (
        <span className="stamp inline-flex items-center gap-1.5" data-testid="ribbon-chip">
            <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                style={{ backgroundColor: ribbonHex(place) ?? undefined }}
            />
            {placeLabel(place)}
        </span>
    );
}

export default function ShowEntryGallery({ showId, gallery, authed }: ShowEntryGalleryProps) {
    const router = useRouter();
    const { showToast, toastNode } = useShowToast();
    const { classes, votingEnabled, votingOpen, revealed, resultsPublished } = gallery;

    const [pendingVote, setPendingVote] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Lightbox flips through ONE class at a time (the table walk).
    const [lightbox, setLightbox] = useState<{ classId: string; index: number } | null>(null);

    /** Per class: only entries with photos join the lightbox reel. */
    const lightboxImagesByClass = useMemo(() => {
        const map = new Map<string, { url: string; label: string }[]>();
        for (const cls of classes) {
            map.set(
                cls.classId,
                cls.entries
                    .filter((e) => e.photoUrl)
                    .map((e) => ({
                        url: e.photoUrl as string,
                        label: [
                            e.entryNumber !== null ? `#${e.entryNumber}` : null,
                            e.horseName,
                            e.place !== null ? placeLabel(e.place) : null,
                        ]
                            .filter(Boolean)
                            .join(" · "),
                    })),
            );
        }
        return map;
    }, [classes]);

    if (classes.length === 0) {
        return (
            <section className="ledger-card" aria-labelledby="entry-gallery-heading">
                <span className="ledger-tab" id="entry-gallery-heading">
                    {resultsPublished ? "Results" : "Entry Gallery"}
                </span>
                <p className="text-sm text-muted-foreground">
                    No entries on the table yet — check back as the classes fill up.
                </p>
            </section>
        );
    }

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

    const openLightbox = (cls: GalleryClass, entry: GalleryEntry) => {
        const reel = lightboxImagesByClass.get(cls.classId) ?? [];
        const index = reel.findIndex((img) => img.url === entry.photoUrl);
        if (index >= 0) setLightbox({ classId: cls.classId, index });
    };

    return (
        <section aria-labelledby="entry-gallery-heading" data-testid="entry-gallery">
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2
                    id="entry-gallery-heading"
                    className="m-0 font-serif text-lg font-bold text-foreground"
                >
                    {resultsPublished ? "Results" : "Entry Gallery"}
                </h2>
                {votingEnabled && votingOpen && <Badge>Community voting open</Badge>}
                {votingEnabled && !votingOpen && !resultsPublished && (
                    <Badge variant="secondary">Community vote</Badge>
                )}
                {!revealed && <Badge variant="outline">Blind browsing</Badge>}
            </div>

            {!revealed && (
                <p className="mb-3 text-xs text-muted-foreground">
                    Blind browsing: owner names are hidden until results publish — every entry
                    stands on its photo alone.
                </p>
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

            <ul className="flex list-none flex-col gap-6 p-0">
                {classes.map((cls) => (
                    <li key={cls.classId} className="ledger-card" data-testid="gallery-class">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="ledger-tab !mb-0">{classLabel(cls)}</span>
                            <span className="text-xs text-muted-foreground">
                                {cls.divisionName} · {cls.sectionName} · {cls.entries.length}{" "}
                                entr{cls.entries.length === 1 ? "y" : "ies"}
                            </span>
                        </div>

                        <ul className="mt-3 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
                            {cls.entries.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex flex-col gap-1.5 rounded-lg border border-input bg-card p-2"
                                    data-testid="gallery-entry"
                                >
                                    {entry.photoUrl ? (
                                        <button
                                            type="button"
                                            className="cursor-zoom-in overflow-hidden rounded-md border-0 bg-transparent p-0"
                                            onClick={() => openLightbox(cls, entry)}
                                            aria-label={`View ${entry.horseName} full size`}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={entry.photoUrl}
                                                alt={entry.horseName}
                                                className="aspect-square w-full object-cover transition-transform hover:scale-[1.03]"
                                                loading="lazy"
                                            />
                                        </button>
                                    ) : (
                                        <div
                                            className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-3xl"
                                            aria-hidden="true"
                                        >
                                            🐴
                                        </div>
                                    )}

                                    <div className="flex items-start justify-between gap-1">
                                        <div className="min-w-0">
                                            <p className="m-0 truncate text-sm font-medium text-foreground">
                                                {entry.entryNumber !== null && (
                                                    <span className="mr-1 font-mono text-xs text-muted-foreground">
                                                        #{entry.entryNumber}
                                                    </span>
                                                )}
                                                {entry.horseId !== null ? (
                                                    <Link
                                                        href={`/community/${entry.horseId}`}
                                                        className="hover:underline"
                                                    >
                                                        {entry.horseName}
                                                    </Link>
                                                ) : (
                                                    entry.horseName
                                                )}
                                            </p>
                                            {entry.ownerAlias !== null && (
                                                <Link
                                                    href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}
                                                    className="truncate text-xs text-muted-foreground hover:text-foreground"
                                                    data-testid="gallery-owner"
                                                >
                                                    @{entry.ownerAlias}
                                                </Link>
                                            )}
                                        </div>
                                        {entry.place !== null && <RibbonChip place={entry.place} />}
                                    </div>

                                    {votingEnabled && (
                                        <VoteButton
                                            entry={entry}
                                            votingOpen={votingOpen}
                                            authed={authed}
                                            pending={pendingVote === entry.id}
                                            onToggle={handleVoteToggle}
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>

            {lightbox && (
                <PhotoLightbox
                    images={lightboxImagesByClass.get(lightbox.classId) ?? []}
                    initialIndex={lightbox.index}
                    onClose={() => setLightbox(null)}
                />
            )}

            {toastNode}
        </section>
    );
}
