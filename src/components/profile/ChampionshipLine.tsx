/**
 * The championship line — what the MHH series knows about this
 * exhibitor, on the ledger card the show surfaces use.
 *
 * Every number here is public record by RLS policy, not by our
 * choosing: exhibitor_career and exhibitor_distinctions are both
 * `USING (true)`, card counts come from a SECURITY DEFINER RPC that
 * returns counts and no card codes, and rank/points are computed
 * from completed shows. See src/app/profile/reads.ts for the audit.
 */

import Link from "next/link";

import { showYearLabel } from "@/lib/shows/showYear";
import type { ProfileSeason, StableTitle } from "@/app/profile/reads";
import { SectionHeading } from "./ProfileSection";

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

export default function ChampionshipLine({
    alias,
    isOwnProfile,
    season,
    titles,
}: {
    alias: string;
    isOwnProfile: boolean;
    season: ProfileSeason;
    titles: StableTitle[];
}) {
    // Collapse titles to one row per horse: "Bramble — CH, ROM".
    const byHorse = new Map<string, { name: string; labels: string[] }>();
    for (const title of titles) {
        const entry = byHorse.get(title.horseId) ?? { name: title.horseName, labels: [] };
        entry.labels.push(title.code);
        byHorse.set(title.horseId, entry);
    }
    const titleRows = [...byHorse.entries()];

    return (
        <section className="animate-fade-in-up mt-10" id="season">
            <SectionHeading
                title={<>🏅 The Championship Line</>}
                note={`MHH season ${showYearLabel(season.showYear)}`}
            />

            <div className="ledger-card">
                <span className="ledger-tab">Season Record — @{alias}</span>

                <div className="flex flex-wrap items-center justify-center divide-x divide-border-tan/30 sm:justify-start">
                    {season.rank !== null && <Stat num={`#${season.rank}`} label="Stable rank" />}
                    {season.points !== null && (
                        <Stat num={String(season.points)} label="Season pts" />
                    )}
                    <Stat
                        num={
                            season.stakesCards > 0
                                ? `${season.liveCards} (${season.stakesCards}★)`
                                : String(season.liveCards)
                        }
                        label="Cards held"
                    />
                    <Stat num={String(season.careerPoints)} label="Career pts" />
                    {season.championships ? (
                        <Stat num={String(season.championships)} label="Championships" />
                    ) : null}
                    {season.star && (
                        <Stat num={"★".repeat(season.star.stars)} label={season.star.label} />
                    )}
                </div>

                {season.nextStar && (
                    <p className="mt-3 mb-0 text-xs text-muted-foreground">
                        {season.nextStar.pointsNeeded} career point
                        {season.nextStar.pointsNeeded === 1 ? "" : "s"} to {season.nextStar.label}.
                    </p>
                )}

                {season.standingsDark && (
                    <p className="mt-3 mb-0 text-xs text-muted-foreground">
                        Season rank and points appear here once the rankings go live.
                    </p>
                )}

                {titleRows.length > 0 && (
                    <div className="border-input mt-4 border-t pt-3">
                        <h3 className="mb-2 text-[0.65rem] font-semibold tracking-widest text-secondary-foreground uppercase">
                            Titled horses
                        </h3>
                        <ul className="m-0 flex flex-wrap gap-x-4 gap-y-1.5 p-0 text-sm">
                            {titleRows.map(([horseId, entry]) => (
                                <li key={horseId} className="list-none">
                                    <Link
                                        href={`/community/${horseId}`}
                                        className="font-bold text-foreground no-underline hover:underline"
                                    >
                                        {entry.name}
                                    </Link>{" "}
                                    <span className="stamp ml-1">{entry.labels.join(" · ")}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                    <Link
                        href="/shows/rules"
                        className="text-muted-foreground underline decoration-dotted hover:text-foreground"
                    >
                        How points work
                    </Link>
                    {isOwnProfile && (
                        <Link href="/shows" className="font-semibold text-forest hover:underline">
                            Enter a show →
                        </Link>
                    )}
                </div>
            </div>
        </section>
    );
}
