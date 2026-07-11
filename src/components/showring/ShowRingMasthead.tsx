/**
 * Leather masthead band for the Show Ring — the landmark above the
 * ledger filter bar. Mirrors StableMasthead/GroupMasthead's idiom.
 *
 * Day-mode trap: never dark ink on leather — everything on the band
 * uses the --leather-text ramp.
 */

import Link from "next/link";

export default function ShowRingMasthead({ totalCount }: { totalCount: number }) {
    return (
        <div className="leather-band stitched relative mt-4 mb-2 flex flex-wrap items-center gap-4 rounded-xl px-6 py-4">
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
                <h2 className="text-engraved-light m-0 font-serif text-xl font-bold tracking-[0.12em] uppercase">
                    On Parade
                </h2>
                <span
                    className="font-serif text-[0.7rem] tracking-[0.18em] uppercase"
                    style={{ color: "var(--leather-text-soft)" }}
                >
                    {totalCount} public model{totalCount === 1 ? "" : "s"} · the community&rsquo;s
                    herd
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
    );
}
