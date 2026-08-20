/**
 * Horse passport — "Titles" section (Championship program §3).
 *
 * Permanent MHH titles render as brass plaques, same material
 * recipe as QualificationCardsSection (night-mode and Simple Mode
 * safe). Renders nothing until the horse holds a title.
 */

import { showYearLabel } from "@/lib/shows/showYear";
import type { HorseTitleRow } from "@/lib/shows/horseTitles";
import type { TitleProgress } from "@/lib/shows/titles";

const TITLE_ICONS: Record<string, string> = {
    CH: "🏆",
    ROM: "🎖️",
    SUP: "🏅",
};

/** The unearned half of the ladder — owner's passport only. */
function LadderRow({ p }: { p: TitleProgress }) {
    return (
        <li>
            <div className="rounded-md border border-dashed border-border-tan/40 px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-secondary-foreground">
                        <span className="mr-1.5 opacity-60" aria-hidden="true">
                            {TITLE_ICONS[p.code] ?? "🏆"}
                        </span>
                        {p.code} — {p.label}
                    </span>
                    {p.remaining && (
                        <span className="text-right text-xs text-muted-foreground">
                            {p.remaining}
                        </span>
                    )}
                </div>
                <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={Math.round(p.fraction * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progress toward ${p.label}`}
                >
                    <div
                        className="h-full rounded-full bg-forest"
                        style={{ width: `${Math.max(2, Math.round(p.fraction * 100))}%` }}
                    />
                </div>
            </div>
        </li>
    );
}

export default function TitlesSection({
    titles,
    ladder,
}: {
    titles: HorseTitleRow[];
    /** Owner's passport passes progress; public passports omit it. */
    ladder?: { progress: TitleProgress[]; careerPoints: number };
}) {
    const unearned = ladder?.progress.filter((p) => !p.earned) ?? [];
    if (titles.length === 0 && unearned.length === 0) return null;

    return (
        <div className="rounded-lg border border-border-tan/30 bg-card/20 p-5">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                <span aria-hidden="true">🏆</span> MHH Titles
            </h3>
            <p className="mb-4 text-xs text-secondary-foreground/80">
                Permanent titles earned in MHH-sanctioned showing. Titles stay with the
                horse for life, whoever owns it.
                {ladder && (
                    <>
                        {" "}
                        Career points:{" "}
                        <b className="text-secondary-foreground">{ladder.careerPoints}</b>.
                    </>
                )}
            </p>

            <ul className="flex list-none flex-col gap-3 p-0">
                {titles.map((t) => (
                    <li key={t.code}>
                        <div className="brass-plaque flex items-center gap-3 px-4 py-3">
                            <span className="text-2xl" aria-hidden="true">
                                {TITLE_ICONS[t.code] ?? "🏆"}
                            </span>
                            <div className="min-w-0">
                                <p className="text-engraved-brass m-0 text-sm font-bold tracking-wide">
                                    {t.code} — {t.label}
                                </p>
                                <p className="mt-0.5 mb-0 text-xs text-[color:var(--brass-ink)] opacity-80">
                                    {t.grantedAt &&
                                        `Earned ${new Date(t.grantedAt).toLocaleDateString("en-US", {
                                            month: "long",
                                            year: "numeric",
                                        })}`}
                                    {t.showYear !== null && ` · Show year ${showYearLabel(t.showYear)}`}
                                </p>
                            </div>
                        </div>
                    </li>
                ))}
                {unearned.map((p) => (
                    <LadderRow key={p.code} p={p} />
                ))}
            </ul>
        </div>
    );
}
