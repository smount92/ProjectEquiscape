/**
 * "My Season" — the exhibitor's championship line, at the top of
 * /shows (season-felt wave). This is the surface that makes the
 * series exist for a signed-in entrant: rank, points, live cards,
 * and the next rung of the ladder, every visit.
 *
 * Renders nothing for users with no season activity AND no career
 * history — a brand-new member sees shows, not empty scoreboards.
 */

import Link from "next/link";

import { showYearLabel } from "@/lib/shows/showYear";
import type { MySeason } from "@/app/actions/standings";

function Stat({ num, label }: { num: string; label: string }) {
    return (
        <div className="flex flex-col items-center px-4 py-1">
            <span className="font-serif text-xl font-bold text-foreground tabular-nums">{num}</span>
            <span className="text-[0.65rem] font-semibold tracking-widest text-secondary-foreground uppercase">
                {label}
            </span>
        </div>
    );
}

export default function MySeasonCard({
    season,
    standingsLive,
}: {
    season: MySeason;
    /** Flag-gated: only link to the rankings page once it exists. */
    standingsLive: boolean;
}) {
    const quiet =
        season.points === 0 &&
        season.liveCards === 0 &&
        season.careerPoints === 0;
    if (quiet) return null;

    return (
        <section
            className="mb-6 rounded-lg border border-border-tan/30 bg-card/20 px-5 py-4"
            aria-labelledby="my-season-heading"
        >
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div>
                    <h2
                        id="my-season-heading"
                        className="m-0 text-xs font-semibold tracking-widest text-secondary-foreground uppercase"
                    >
                        🏅 My Season · {showYearLabel(season.showYear)}
                    </h2>
                    {season.nextStar && (
                        <p className="mt-1 mb-0 text-xs text-muted-foreground">
                            {season.nextStar.pointsNeeded} career point
                            {season.nextStar.pointsNeeded === 1 ? "" : "s"} to{" "}
                            {season.nextStar.label}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center divide-x divide-border-tan/30">
                    {season.rank !== null && <Stat num={`#${season.rank}`} label="Stable rank" />}
                    <Stat num={String(season.points)} label="Season pts" />
                    <Stat
                        num={
                            season.stakesCards > 0
                                ? `${season.liveCards} (${season.stakesCards}★)`
                                : String(season.liveCards)
                        }
                        label="Cards held"
                    />
                    <Stat num={String(season.careerPoints)} label="Career pts" />
                </div>

                <div className="flex items-center gap-3 text-sm">
                    {standingsLive && (
                        <Link href="/standings" className="font-semibold text-forest hover:underline">
                            Rankings →
                        </Link>
                    )}
                    <Link
                        href="/shows/rules"
                        className="text-muted-foreground underline decoration-dotted hover:text-foreground"
                    >
                        How points work
                    </Link>
                </div>
            </div>
        </section>
    );
}
