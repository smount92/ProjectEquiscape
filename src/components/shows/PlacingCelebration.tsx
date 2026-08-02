/**
 * SHARE-YOUR-PLACING — the celebration page body. Server-renderable
 * and props-only (the route does the fetching + 404ing) so the
 * component test can exercise every state without a database.
 *
 * Anatomy: leather masthead with the ribbon-colored rosette
 * medallion and the headline sentence, the entry photo large, the
 * "permanent record" trust line linking the horse's public
 * passport, then the CTA row — full results for everyone, and the
 * what-is-MHH pitch + free-account CTA for logged-out visitors
 * (the person who just clicked a Facebook link).
 *
 * Ribbon hexes are the hobby's convention (placings.ts) and are
 * never themed — inline styles by design, exactly like the wall's
 * ribbon stamps. Everything else uses tokens, so Day, Lamplight,
 * and Simple Mode restyle the page like any other.
 */

import Link from "next/link";

import type { PublicPlacingData } from "@/lib/shows/placingShareRead";
import { placeLabel, ribbonHex } from "@/lib/shows/placings";
import { placingFieldLine } from "@/lib/shows/placingShare";
import type { Place } from "@/lib/shows/types";
import ShareButton from "@/components/ShareButton";
import { Button } from "@/components/ui/button";

/** Yellow (3rd) and white (4th) ribbons need ink text; the rest
 *  carry white. Convention colors, not theme decisions. */
function rosetteInk(place: Place): string {
    return place === 3 || place === 4 ? "#2B2418" : "#FFFFFF";
}

/** The rosette medallion: concentric circles in the placing's
 *  ribbon color (the standings-medallion pattern) with two ribbon
 *  tails. Pure CSS — no images to load before the confetti moment. */
export function PlacingRosette({ place, size = 96 }: { place: Place; size?: number }) {
    const hex = ribbonHex(place) ?? "#B8860B";
    const ink = rosetteInk(place);
    const tailWidth = Math.round(size * 0.2);
    const tailHeight = Math.round(size * 0.68);
    return (
        <span
            aria-hidden="true"
            className="relative inline-block shrink-0"
            style={{ width: size, height: size + tailHeight * 0.45 }}
            data-testid="placing-rosette"
        >
            {/* Ribbon tails, tucked behind the medallion */}
            {[-16, 16].map((angle) => (
                <span
                    key={angle}
                    className="absolute"
                    style={{
                        left: "50%",
                        top: size * 0.45,
                        width: tailWidth,
                        height: tailHeight,
                        marginLeft: angle < 0 ? -tailWidth + 2 : -2,
                        transform: `rotate(${angle}deg)`,
                        transformOrigin: "top center",
                        backgroundColor: hex,
                        border: "1px solid rgba(0, 0, 0, 0.25)",
                        clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)",
                    }}
                />
            ))}
            {/* Outer scallop ring → parchment ring → center */}
            <span
                className="absolute inset-0 grid place-items-center rounded-full"
                style={{
                    backgroundColor: hex,
                    border: "2px solid rgba(0, 0, 0, 0.3)",
                    boxShadow: "0 3px 8px rgba(0, 0, 0, 0.35)",
                }}
            >
                <span
                    className="grid place-items-center rounded-full"
                    style={{
                        width: "78%",
                        height: "78%",
                        backgroundColor: hex,
                        border: "3px solid rgba(255, 255, 255, 0.85)",
                    }}
                >
                    <span
                        className="font-serif font-bold"
                        style={{ color: ink, fontSize: size * 0.28 }}
                    >
                        {placeLabel(place)}
                    </span>
                </span>
            </span>
        </span>
    );
}

export default function PlacingCelebration({
    data,
    authed,
    shareUrl,
}: {
    data: PublicPlacingData;
    authed: boolean;
    shareUrl: string;
}) {
    const { show, entry, place, horseName, ownerAlias, photoUrl } = data;
    const pagePath = `/shows/${show.id}/placing/${entry.id}`;
    const resultYear = data.show.resultDate ? data.show.resultDate.slice(0, 4) : null;
    const dateLabel = data.show.resultDate
        ? new Date(`${data.show.resultDate.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
          })
        : null;

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {/* ── Leather masthead: rosette + the headline sentence ── */}
            <section
                className="leather-panel stitched rounded-lg p-5 sm:p-6"
                aria-label="Placing result"
            >
                <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap sm:gap-6">
                    <PlacingRosette place={place} />
                    {/* min-w wraps the text block to its own full-width
                        line on narrow phones instead of crushing it
                        against the rosette. */}
                    <div className="min-w-[14rem] flex-1">
                        <p className="m-0 text-xs font-semibold tracking-[0.18em] uppercase text-(--leather-text-muted)">
                            Model Horse Hub · {show.mode === "live" ? "Live show" : "Photo show"}{" "}
                            result
                        </p>
                        <h1 className="m-0 mt-1 font-serif text-2xl leading-tight font-bold tracking-tight text-(--leather-text) sm:text-3xl">
                            {horseName} — {placeLabel(place)} · {data.className} at {show.title}
                        </h1>
                        <p className="m-0 mt-2 text-sm text-(--leather-text-muted)">
                            {placingFieldLine(place, data.totalEntries)}
                            {data.divisionName && <> · {data.divisionName}</>}
                            {entry.entryNumber !== null && (
                                <>
                                    {" "}
                                    · <span className="font-mono">#{entry.entryNumber}</span>
                                </>
                            )}
                        </p>
                        <p className="m-0 mt-1 text-sm text-(--leather-text-muted)">
                            Owned by{" "}
                            <Link
                                href={`/profile/${encodeURIComponent(ownerAlias)}`}
                                className="font-medium text-(--leather-text) hover:underline"
                            >
                                @{ownerAlias}
                            </Link>
                            {dateLabel ? <> · {dateLabel}</> : resultYear ? <> · {resultYear}</> : null}
                        </p>
                    </div>
                    <div className="shrink-0">
                        <ShareButton
                            title={`${horseName} placed ${placeLabel(place)} — ${show.title}`}
                            text={`${horseName} placed ${placeLabel(place)} in ${data.className} at ${show.title} on Model Horse Hub!`}
                            url={shareUrl}
                            variant="leather"
                            label="Share"
                        />
                    </div>
                </div>
            </section>

            {/* ── The horse, large ── */}
            <div className="overflow-hidden rounded-lg border border-input bg-card shadow-sm">
                {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={photoUrl}
                        alt={`${horseName} — the placing entry photo`}
                        className="max-h-[70vh] w-full object-contain"
                    />
                ) : (
                    <div
                        className="grid aspect-[4/3] w-full place-items-center bg-muted text-7xl"
                        aria-label="No entry photo"
                    >
                        <span aria-hidden="true">🐴</span>
                    </div>
                )}
                {/* Trust line: this result is on the permanent record. */}
                <p className="m-0 border-t border-input px-4 py-3 text-sm text-secondary-foreground">
                    <span aria-hidden="true">🛡️</span> Verified result on{" "}
                    <Link
                        href={`/community/${entry.horseId}`}
                        className="font-semibold text-forest underline decoration-2 underline-offset-2"
                    >
                        {horseName}&rsquo;s permanent record
                    </Link>
                    .
                </p>
            </div>

            {/* ── CTAs ── */}
            <div className="flex flex-wrap items-center gap-3">
                <Button asChild>
                    <Link href={`/shows/${show.id}#results`}>See full results →</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href={`/community/${entry.horseId}`}>View {horseName}&rsquo;s passport</Link>
                </Button>
            </div>

            {!authed && (
                <section
                    className="ledger-card"
                    aria-label="About Model Horse Hub"
                    data-testid="placing-anon-cta"
                >
                    <span className="ledger-tab">What is Model Horse Hub?</span>
                    <p className="mt-0 mb-3 text-sm text-secondary-foreground">
                        The digital home for the model horse hobby — free photo shows like this
                        one, a permanent show record for every horse, and a community of
                        collectors. Enter your own models in the next show.
                    </p>
                    <Button asChild>
                        <Link href={`/signup?redirectTo=${encodeURIComponent(pagePath)}`}>
                            Create free account
                        </Link>
                    </Button>
                </section>
            )}
        </div>
    );
}
