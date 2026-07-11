/**
 * Leather masthead band for a group (Notice Board edition) — the
 * landmark above the ledger board. Mirrors StableMasthead's idiom:
 * leather-band + stitching, brass medallion, embossed name.
 *
 * Day-mode trap: never dark ink on leather — everything on the band
 * uses the --leather-text ramp.
 */

import Link from "next/link";

export default function GroupMasthead({
    name,
    typeLabel,
    region,
    memberCount,
    creatorAlias,
    description,
}: {
    name: string;
    typeLabel: string;
    region: string | null;
    memberCount: number;
    creatorAlias: string;
    description: string | null;
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
                    <h1 className="text-engraved-light m-0 font-serif text-xl font-bold tracking-[0.12em] uppercase">
                        {name}
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
                <div className="z-[1] ml-auto">
                    <Link href="/community/groups" className="btn-ghostleather !px-4 !py-2 !text-xs">
                        ← All Groups
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
