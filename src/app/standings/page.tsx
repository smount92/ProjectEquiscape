import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getStandings, type GetStandingsResult } from "@/app/actions/standings";
import { showStandingsEnabled } from "@/lib/shows/flags";
import { showYearLabel, showYearOf } from "@/lib/shows/showYear";
import { createClient } from "@/lib/supabase/server";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Season Standings",
    description:
        "Season standings across the show year — points for placings and championships, by horse and by stable.",
};

/** First show year the rebuilt show system produced results in. */
const FIRST_STANDINGS_YEAR = 2026;

type ShowsParam = "qualifying" | "all";
type ScopeParam = "horses" | "stables";

/** /standings href with the three params, omitting defaults. */
function standingsHref(year: number, scope: ScopeParam, shows: ShowsParam): string {
    const params = new URLSearchParams();
    params.set("year", String(year));
    if (scope !== "horses") params.set("scope", scope);
    if (shows !== "qualifying") params.set("shows", shows);
    const qs = params.toString();
    return qs ? `/standings?${qs}` : "/standings";
}

/** Ledger control pill — active gets the rubber stamp, idle stays quiet. */
function ControlLink({
    href,
    active,
    children,
}: {
    href: string;
    active: boolean;
    children: React.ReactNode;
}) {
    if (active) {
        return (
            <span className="stamp" aria-current="true">
                {children}
            </span>
        );
    }
    return (
        <Link
            href={href}
            className="font-serif text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase no-underline hover:text-foreground hover:underline"
        >
            {children}
        </Link>
    );
}

/** Brass medallion for ranks 1–3; plain ledger numerals below the podium.
 *  Colors come from .brass-medallion so Lamplight and Simple Mode restyle
 *  it like every other medallion — only the size is pinned inline. */
function RankCell({ rank }: { rank: number }) {
    if (rank <= 3) {
        return (
            <span
                className="brass-medallion"
                style={{ width: 30, height: 30, borderWidth: 2, fontSize: "0.8rem" }}
            >
                {rank}
            </span>
        );
    }
    return <span className="pl-2 font-serif text-sm tabular-nums">{rank}</span>;
}

function StandingsTable({ result }: { result: GetStandingsResult & { success: true } }) {
    if (result.rows.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                The show year is young — results land here as shows publish.
            </p>
        );
    }
    const isHorses = result.scope === "horses";
    return (
        <Table className="min-w-[560px]">
            <TableHeader>
                <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>{isHorses ? "Horse" : "Stable"}</TableHead>
                    {isHorses && <TableHead>Stable</TableHead>}
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Placings</TableHead>
                    <TableHead className="text-right">Championships</TableHead>
                    <TableHead className="text-right">Shows</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {result.scope === "horses"
                    ? result.rows.map((row) => (
                          <TableRow key={row.horseId}>
                              <TableCell>
                                  <RankCell rank={row.rank} />
                              </TableCell>
                              <TableCell className="font-semibold">
                                  <Link
                                      href={`/stable/${row.horseId}`}
                                      className="text-foreground no-underline hover:underline"
                                  >
                                      {row.horseName}
                                  </Link>
                              </TableCell>
                              <TableCell>
                                  <Link
                                      href={`/profile/${encodeURIComponent(row.ownerAlias)}`}
                                      className="text-muted-foreground no-underline hover:underline"
                                  >
                                      @{row.ownerAlias.replace(/^@+/, "")}
                                  </Link>
                              </TableCell>
                              <TableCell className="text-right font-bold tabular-nums">
                                  {row.points}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                  {row.placings}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                  {row.championships}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                  {row.showsEntered}
                              </TableCell>
                          </TableRow>
                      ))
                    : result.rows.map((row) => (
                          <TableRow key={row.ownerId}>
                              <TableCell>
                                  <RankCell rank={row.rank} />
                              </TableCell>
                              <TableCell className="font-semibold">
                                  <Link
                                      href={`/profile/${encodeURIComponent(row.ownerAlias)}`}
                                      className="text-foreground no-underline hover:underline"
                                  >
                                      @{row.ownerAlias.replace(/^@+/, "")}
                                  </Link>
                              </TableCell>
                              <TableCell className="text-right font-bold tabular-nums">
                                  {row.points}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                  {row.placings}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                  {row.championships}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                  {row.showsEntered}
                              </TableCell>
                          </TableRow>
                      ))}
            </TableBody>
        </Table>
    );
}

export default async function StandingsPage({
    searchParams,
}: {
    searchParams: Promise<{ year?: string; scope?: string; shows?: string }>;
}) {
    if (!showStandingsEnabled()) notFound();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?redirectTo=" + encodeURIComponent("/standings"));

    const params = await searchParams;
    const currentYear = showYearOf(new Date());
    const parsedYear = parseInt(params.year ?? "", 10);
    const year = Number.isInteger(parsedYear) ? parsedYear : currentYear;
    const scope: ScopeParam = params.scope === "stables" ? "stables" : "horses";
    const shows: ShowsParam = params.shows === "all" ? "all" : "qualifying";

    const result = await getStandings({
        showYear: year,
        scope,
        qualifyingOnly: shows === "qualifying",
    });

    // Year picker: every show year since the system's first, newest
    // first (plus the requested year if a link carried an odd one).
    const years: number[] = [];
    for (let y = Math.max(currentYear, year); y >= Math.min(FIRST_STANDINGS_YEAR, year); y--) {
        years.push(y);
    }

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="🏅"
                title="Season Standings"
                subtitle="Show year runs May 1 – April 30"
            />

            <div
                className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3"
                aria-label="Standings filters"
            >
                <div className="flex flex-wrap items-center gap-3" aria-label="Show year">
                    {years.map((y) => (
                        <ControlLink
                            key={y}
                            href={standingsHref(y, scope, shows)}
                            active={y === year}
                        >
                            {showYearLabel(y)}
                        </ControlLink>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-3" aria-label="Standings scope">
                    <ControlLink
                        href={standingsHref(year, "horses", shows)}
                        active={scope === "horses"}
                    >
                        Horses
                    </ControlLink>
                    <ControlLink
                        href={standingsHref(year, "stables", shows)}
                        active={scope === "stables"}
                    >
                        Stables
                    </ControlLink>
                </div>
                <div className="flex flex-wrap items-center gap-3" aria-label="Which shows count">
                    <ControlLink
                        href={standingsHref(year, scope, "qualifying")}
                        active={shows === "qualifying"}
                    >
                        Qualifying shows
                    </ControlLink>
                    <ControlLink
                        href={standingsHref(year, scope, "all")}
                        active={shows === "all"}
                    >
                        All shows
                    </ControlLink>
                </div>
            </div>

            <section className="ledger-card" aria-labelledby="standings-heading">
                <span className="ledger-tab" id="standings-heading">
                    Standings — {showYearLabel(year)}
                </span>

                {!result.success ? (
                    <p role="alert" className="text-sm font-semibold text-destructive">
                        {result.error}
                    </p>
                ) : (
                    <>
                        <StandingsTable result={result} />
                        <p className="mt-4 text-xs text-muted-foreground">
                            {result.countedShows.length > 0 ? (
                                <>
                                    Scored from {result.countedShows.length} show
                                    {result.countedShows.length === 1 ? "" : "s"} with published
                                    results:{" "}
                                    {result.countedShows.map((s, i) => (
                                        <span key={s.id}>
                                            {i > 0 && ", "}
                                            <Link
                                                href={`/shows/${s.id}`}
                                                className="text-muted-foreground underline hover:text-foreground"
                                            >
                                                {s.title}
                                            </Link>
                                        </span>
                                    ))}
                                    .{" "}
                                </>
                            ) : null}
                            Points: 7·5·4·3·2·1 for 1st–6th · Championship bonuses: section +3,
                            division +5, show +10 · Only shows with published results count
                            {shows === "qualifying" ? " · MHH-qualifying shows only" : ""}.
                        </p>
                    </>
                )}
            </section>
        </ExplorerLayout>
    );
}
