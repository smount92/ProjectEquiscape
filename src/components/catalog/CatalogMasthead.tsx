/**
 * Leather masthead for the Reference Catalog — this IS the page header
 * (the layout's default brass header is suppressed via noHeader). Mirrors
 * ShowRingMasthead / StableMasthead: leather at the landmark, ledger paper
 * for the work below.
 *
 * Day-mode trap: never dark ink on leather — everything on the band uses
 * the --leather-text ramp (.text-engraved-light and friends).
 */

import Link from "next/link";
import { BookOpen, FileText, Lightbulb } from "lucide-react";

export default function CatalogMasthead({ totalCount }: { totalCount: number }) {
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
                    📚
                </span>
                <div className="min-w-0">
                    <h1 className="text-engraved-light m-0 font-serif text-2xl font-bold tracking-[0.1em] uppercase">
                        Reference Catalog
                    </h1>
                    <span
                        className="font-serif text-[0.7rem] tracking-[0.18em] uppercase"
                        style={{ color: "var(--leather-text-soft)" }}
                    >
                        {totalCount.toLocaleString()} model{totalCount === 1 ? "" : "s"} on record
                    </span>
                </div>
                <div className="z-[1] ml-auto flex flex-wrap gap-2">
                    <Link
                        href="/catalog/changelog"
                        className="btn-ghostleather !px-4 !py-2 !text-xs"
                    >
                        <FileText size={14} strokeWidth={1.5} /> Changelog
                    </Link>
                    <Link
                        href="/catalog/suggestions"
                        className="btn-ghostleather !px-4 !py-2 !text-xs"
                    >
                        <Lightbulb size={14} strokeWidth={1.5} /> Suggestions
                    </Link>
                    <Link
                        href="/catalog/suggestions/new"
                        className="btn-brass inline-flex items-center gap-1.5 no-underline hover:no-underline"
                    >
                        <BookOpen size={14} strokeWidth={2} /> Suggest Entry
                    </Link>
                </div>
            </div>
            <p
                className="relative z-[1] mt-3 mb-0 max-w-[62ch] text-sm leading-relaxed italic"
                style={{ color: "var(--leather-text)" }}
            >
                The community-maintained record of every model — Breyer, Stone, and artist resins.
                Search a mold, a maker, or a color to find its page.
            </p>
        </div>
    );
}
