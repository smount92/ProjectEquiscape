/**
 * THE SHOW RING DOOR — first thing on The Paddock (owner, 2026-08-21).
 *
 * A full leather band, not a rail line, because it's the room people
 * actually walk to first — now with a PREVIEW STRIP: the latest
 * public horses so the door shows what's inside before you step
 * through. Each thumb opens that horse's passport; the brass CTA
 * opens the ring itself.
 *
 * The strip stays ONE row at every width: 3 thumbs on phones,
 * 4 from sm, 6 from lg (indexes 3+ / 4+ unhide at those points).
 * No horses with photos yet → the band renders without the strip,
 * never an empty tray.
 */

import Link from "next/link";

export interface ShowRingPreviewHorse {
    id: string;
    name: string;
    thumbnailUrl: string;
}

export default function ShowRingDoor({ horses }: { horses: ShowRingPreviewHorse[] }) {
    return (
        <div className="leather-band stitched mb-8 rounded-xl px-6 py-5" id="paddock-show-ring-door">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span aria-hidden="true" className="text-[2.2rem] leading-none">🏆</span>
                <span className="min-w-0 flex-1">
                    <Link
                        href="/community"
                        className="text-engraved-light block font-serif text-xl font-bold tracking-[0.02em] no-underline hover:underline"
                    >
                        The Show Ring
                    </Link>
                    <span className="block text-sm" style={{ color: "var(--leather-text-soft)" }}>
                        The community&rsquo;s horses on show — browse, favorite, and find your
                        next obsession.
                    </span>
                </span>
                <Link href="/community" className="btn-brass inline-flex shrink-0 items-center gap-1.5 no-underline">
                    Step into the ring →
                </Link>
            </div>

            {horses.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {horses.map((horse, i) => (
                        <Link
                            key={horse.id}
                            href={`/community/${horse.id}`}
                            title={horse.name}
                            className={`group relative aspect-square overflow-hidden rounded-lg border border-black/40 shadow-md no-underline ${
                                i >= 4 ? "hidden lg:block" : i >= 3 ? "hidden sm:block" : ""
                            }`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={horse.thumbnailUrl}
                                alt={horse.name}
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pt-4 pb-1 text-[0.65rem] font-semibold text-white">
                                {horse.name}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
