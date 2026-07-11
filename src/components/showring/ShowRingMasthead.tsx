/**
 * Leather masthead for the Show Ring — this IS the page header (the
 * layout's default brass header is suppressed via noHeader). Carries
 * the page title + description on leather, per the owner's direction.
 *
 * Day-mode trap: never dark ink on leather — everything on the band
 * uses the --leather-text ramp.
 */

import Link from "next/link";

export default function ShowRingMasthead({ totalCount }: { totalCount: number }) {
    return (
        <div className="leather-band stitched relative mb-6 rounded-xl px-6 py-5">
            <div className="flex flex-wrap items-center gap-4">
                <span
                    aria-hidden="true"
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl"
                    style={{
                        background:
                            "radial-gradient(circle at 32% 28%, var(--brass-hi), var(--brass) 45%, var(--brass-dark))",
                        boxShadow: "0 3px 7px rgba(0,0,0,.45), inset 0 -2px 4px rgba(0,0,0,.35)",
                    }}
                >
                    🏆
                </span>
                <div className="min-w-0">
                    <h1 className="text-engraved-light m-0 font-serif text-2xl font-bold tracking-[0.1em] uppercase">
                        The Show Ring
                    </h1>
                    <span
                        className="font-serif text-[0.7rem] tracking-[0.18em] uppercase"
                        style={{ color: "var(--leather-text-soft)" }}
                    >
                        {totalCount} public model{totalCount === 1 ? "" : "s"} on parade
                    </span>
                </div>
                <div className="z-[1] ml-auto">
                    <Link
                        href="/community/help-id"
                        id="help-id-link"
                        className="btn-ghostleather !px-4 !py-2 !text-xs"
                    >
                        🔍 Help Me ID
                    </Link>
                </div>
            </div>
            <p
                className="relative z-[1] mt-3 mb-0 max-w-[62ch] text-sm leading-relaxed italic"
                style={{ color: "var(--leather-text)" }}
            >
                Browse the latest models shared by collectors from around the world. Every horse
                has a story.
            </p>
        </div>
    );
}
