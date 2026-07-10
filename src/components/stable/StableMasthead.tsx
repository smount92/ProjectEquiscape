/**
 * Leather masthead band (Digital Stable v2) — the landmark. Embossed
 * "Digital Stable", herd count, brass Add buttons. Leather at the
 * landmarks; the filter bar below stays ledger paper.
 *
 * Day-mode trap: never dark ink on leather — everything on the band
 * uses the --leather-text ramp (.text-engraved-light and friends).
 */

import Link from "next/link";
import { FileText, Plus, Zap } from "lucide-react";

export default function StableMasthead({
    aliasName,
    totalHorses,
}: {
    aliasName: string | null;
    totalHorses: number | null;
}) {
    return (
        <div className="leather-band stitched relative mb-4 flex flex-wrap items-center gap-4 rounded-xl px-6 py-4">
            <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl"
                style={{
                    background:
                        "radial-gradient(circle at 32% 28%, var(--brass-hi), var(--brass) 45%, var(--brass-dark))",
                    boxShadow: "0 3px 7px rgba(0,0,0,.45), inset 0 -2px 4px rgba(0,0,0,.35)",
                }}
            >
                🐴
            </span>
            <div className="min-w-0">
                <h1 className="text-engraved-light m-0 font-serif text-xl font-bold tracking-[0.12em] uppercase">
                    Digital Stable
                </h1>
                <span
                    className="font-serif text-[0.7rem] tracking-[0.18em] uppercase"
                    style={{ color: "var(--leather-text-soft)" }}
                >
                    {aliasName ? `${aliasName}’s Herd` : "Your Herd"}
                    {totalHorses !== null && (
                        <> · {totalHorses} horse{totalHorses === 1 ? "" : "s"}</>
                    )}
                </span>
            </div>
            <div className="z-[1] ml-auto flex flex-wrap gap-2">
                <Link href="/stable/import" id="batch-import-button" className="btn-ghostleather !px-4 !py-2 !text-xs">
                    <FileText size={14} strokeWidth={1.5} /> Batch Import
                </Link>
                <Link href="/add-horse/quick" id="quick-add-button" className="btn-ghostleather !px-4 !py-2 !text-xs">
                    <Zap size={14} strokeWidth={1.5} /> Quick Add
                </Link>
                <Link href="/add-horse" id="add-horse-button" className="btn-brass inline-flex items-center gap-1.5 no-underline hover:no-underline">
                    <Plus size={14} strokeWidth={2} /> Add to Stable
                </Link>
            </div>
        </div>
    );
}
