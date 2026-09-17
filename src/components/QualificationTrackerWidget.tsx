/**
 * Dashboard — qualification cards per horse, one section per
 * program (NAN, OMEQ). Replaces the NAN-only widget (2026-09-17):
 * a member asked for "OMEQ qualified" next to NAN, and the tracker is
 * now program-agnostic (lib/records/qualifiers).
 *
 * We track; the programs issue. Every section says who issues the
 * cards and links out — the disclosure the NAN widget always carried.
 */

import Link from "next/link";

import { getQualificationTracker } from "@/app/actions/competition";
import { QUALIFIER_PROGRAMS, cardInfo } from "@/lib/records/qualifiers";

export default async function QualificationTrackerWidget() {
    const tracker = await getQualificationTracker();
    if (!tracker) return null;

    const year = new Date().getFullYear();
    const activeTotal = QUALIFIER_PROGRAMS.reduce(
        (n, p) => n + tracker.programs[p.value].activeCards,
        0,
    );

    return (
        <details
            className="rounded-xl border border-input bg-card p-6 shadow-sm"
            id="qualification-tracker"
            open
        >
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold tracking-widest text-foreground uppercase select-none [&::-webkit-details-marker]:hidden">
                🎫 Qualification cards {year}
                <span className="ml-auto text-xs font-normal normal-case tracking-normal text-muted-foreground">
                    {activeTotal} active card{activeTotal === 1 ? "" : "s"}
                </span>
            </summary>

            <p className="mt-3 mb-1 text-xs text-muted-foreground italic">
                Your own record of the cards your horses have earned. Official NAN cards are
                issued by NAMHSA; OMEQ cards by USOMHS through the show host. Add one from any
                horse&rsquo;s show records.
            </p>

            {QUALIFIER_PROGRAMS.map((p) => {
                const section = tracker.programs[p.value];
                return (
                    <section
                        key={p.value}
                        className="mt-4"
                        aria-label={`${p.short} cards`}
                        data-testid={`tracker-${p.value}`}
                    >
                        <h3 className="m-0 flex flex-wrap items-baseline gap-2 text-sm font-bold text-foreground">
                            {p.short}
                            <a
                                href={p.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-normal text-muted-foreground underline"
                            >
                                {p.issuer} ↗
                            </a>
                            <span className="ml-auto text-xs font-normal text-muted-foreground">
                                {section.activeCards} active · {section.totalCards} total
                            </span>
                        </h3>

                        {section.horses.length === 0 ? (
                            <p className="m-0 mt-1 text-xs text-muted-foreground">
                                No {p.short} cards recorded yet.
                            </p>
                        ) : (
                            <div className="mt-1 flex flex-col gap-1">
                                {section.horses.slice(0, 8).map((h) => (
                                    <div
                                        key={h.horseId}
                                        className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
                                    >
                                        <Link
                                            href={`/community/${h.horseId}`}
                                            className="truncate text-sm font-semibold text-foreground no-underline hover:text-forest"
                                        >
                                            {h.horseName}
                                        </Link>
                                        <span className="ml-auto flex shrink-0 flex-wrap gap-1 text-xs">
                                            {h.cards.map((c) => {
                                                const info = cardInfo(p.value, c.card);
                                                return (
                                                    <span
                                                        key={`${c.year}-${c.card}`}
                                                        className={`rounded-full px-1.5 py-0.5 ${
                                                            c.expired
                                                                ? "bg-muted text-muted-foreground line-through"
                                                                : "bg-muted text-secondary-foreground"
                                                        }`}
                                                        title={`${info?.label ?? c.card} · ${c.year}${c.expired ? " · expired" : ""}`}
                                                    >
                                                        {info?.glyph ?? "🎫"}
                                                        {c.count > 1 ? ` ×${c.count}` : ""} {c.year}
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    </div>
                                ))}
                                {section.horses.length > 8 && (
                                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                                        + {section.horses.length - 8} more horses
                                    </p>
                                )}
                            </div>
                        )}
                        <p className="m-0 mt-1 text-[11px] text-muted-foreground">{p.validity}</p>
                    </section>
                );
            })}

            <div className="mt-4 flex flex-wrap gap-2">
                <Link
                    href="/shows/planner"
                    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-card px-6 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all hover:bg-muted"
                >
                    🧳 Live Show Packer
                </Link>
                {tracker.programs.nan.totalCards > 0 && (
                    <a
                        href="/api/export/nan-cards"
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-card px-6 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all hover:bg-muted"
                    >
                        📥 Export NAN Cards
                    </a>
                )}
            </div>
        </details>
    );
}
