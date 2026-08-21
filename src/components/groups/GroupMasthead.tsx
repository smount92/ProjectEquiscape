/**
 * Leather masthead band for a **Barn** — the landmark above the
 * notice board. Mirrors StableMasthead's idiom: leather-band +
 * stitching, brass medallion, embossed name.
 *
 * This is the ONE header on a barn page. `/community/groups/[slug]`
 * renders ExplorerLayout with `noHeader` so this band is not doubled
 * up by the layout's brass heading row.
 *
 * Day-mode trap: never dark ink on leather — everything on the band
 * uses the --leather-text ramp.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export default function GroupMasthead({
    name,
    typeLabel,
    region,
    memberCount,
    creatorAlias,
    description,
    isPrivate = false,
    actions,
}: {
    name: string;
    typeLabel: string;
    region: string | null;
    memberCount: number;
    creatorAlias: string;
    description: string | null;
    /** Private barn — the roster and notice board are members-only. */
    isPrivate?: boolean;
    /** Join / leave control, rendered on the band's right. */
    actions?: ReactNode;
}) {
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
                    🐎
                </span>
                <div className="min-w-0">
                    <h1 className="text-engraved-light m-0 flex flex-wrap items-center gap-2 font-serif text-xl font-bold tracking-[0.12em] uppercase">
                        {name}
                        {isPrivate && <PrivateBadge />}
                    </h1>
                    <span
                        className="font-serif text-[0.7rem] tracking-[0.18em] uppercase"
                        style={{ color: "var(--leather-text-soft)" }}
                    >
                        {typeLabel}
                        {region && <> · 📍 {region}</>}
                        {" · "}
                        {memberCount} member{memberCount === 1 ? "" : "s"}
                        {" · "}est. by @{creatorAlias.replace(/^@+/, "")}
                    </span>
                </div>
                <div className="z-[1] ml-auto flex flex-wrap items-center gap-2">
                    {actions}
                    <Link href="/community/groups" className="btn-ghostleather !px-4 !py-2 !text-xs">
                        ← All Barns
                    </Link>
                </div>
            </div>
            {description && (
                <p
                    className="relative z-[1] mt-3 mb-0 max-w-[62ch] text-sm leading-relaxed italic"
                    style={{ color: "var(--leather-text)" }}
                >
                    {description}
                </p>
            )}
        </div>
    );
}

/** Brass-ringed "Private" chip. Leather-safe: no dark ink on the band. */
export function PrivateBadge() {
    return (
        <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 font-serif text-[0.6rem] font-bold tracking-[0.18em] whitespace-nowrap uppercase"
            style={{
                border: "1px solid var(--brass, #B08D3E)",
                color: "var(--leather-text, #E8DCC8)",
                background: "rgba(0,0,0,.22)",
            }}
            title="Private barn — the roster and notice board are members-only"
        >
            🔒 Private
        </span>
    );
}
