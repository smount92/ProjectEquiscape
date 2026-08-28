import Link from "next/link";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { buildSurvey } from "@/lib/catalog/timeline";
import { OwnedMark, OwnedProvider } from "@/components/reference/OwnedMarks";
import type { MoldTimelineData } from "@/app/actions/reference-pages";

/**
 * The Ledger — a mold's releases as decade shelves on a brass spine.
 *
 * Replaces the old alphabetical releases grid (which capped at 60 and
 * told no story). Variations of one release sit behind a <details>
 * fold; undated releases get an honest shelf that doubles as a dating
 * prompt; price chips are the live asking medians the Registry already
 * computes. Server component — zero client JS beyond native <details>.
 */
export default function MoldTimeline({
    data,
    maker,
}: {
    data: MoldTimelineData;
    maker: string;
}) {
    const { timeline, medians, thumbs } = data;
    if (timeline.total === 0) return null;

    const href = (r: { id: string; title: string; makerSlug: string | null; slug: string | null }) =>
        referenceHref({ id: r.id, maker, title: r.title, maker_slug: r.makerSlug, slug: r.slug });
    const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
    const maxDensity = Math.max(1, ...timeline.density.map(([, n]) => n));
    const survey = buildSurvey(timeline);
    const allIds = [
        ...timeline.decades.flatMap((d) => d.releases.flatMap((r) => [r.id, ...r.variants.map((v) => v.id)])),
        ...timeline.undated.map((r) => r.id),
    ];

    return (
        <OwnedProvider ids={allIds}>
        <section>
            <h2 className="mb-1 font-serif text-xl font-bold text-foreground">
                Releases on this mold{" "}
                <span className="text-sm font-normal text-muted-foreground">({timeline.total})</span>
            </h2>
            {timeline.firstYear && (
                <p className="mb-3 text-sm text-secondary-foreground">
                    {timeline.firstYear}–{timeline.lastYear ?? "present"} · every release the
                    community has catalogued, in the order they reached shelves.
                </p>
            )}

            {/* The Survey — the mold's life at true scale. Long runs get
                lanes at their real width; single-year releases bin into
                per-year dots. Collapsed by default; only long histories
                (15+ years) earn it at all. */}
            {survey && (
                <details className="border-input bg-card mb-4 rounded-xl border">
                    <summary className="text-forest cursor-pointer px-4 py-2.5 text-sm font-semibold select-none">
                        📊 Production at a glance, {survey.first}–{survey.last}
                    </summary>
                    <div className="px-4 pt-1 pb-3">
                        <div className="border-input relative mb-2 h-5 border-b">
                            <span className="text-muted-foreground absolute left-0 text-[0.68rem] tabular-nums">{survey.first}</span>
                            {survey.ticks.map((y) => (
                                <span
                                    key={y}
                                    className="text-muted-foreground absolute -translate-x-1/2 text-[0.68rem] tabular-nums"
                                    style={{ left: `${((y - survey.first) / (survey.last - survey.first + 1)) * 100}%` }}
                                >
                                    {y}
                                </span>
                            ))}
                            <span className="text-muted-foreground absolute right-0 text-[0.68rem] tabular-nums">{survey.last}</span>
                        </div>
                        {survey.runs.map((run) => (
                            <div key={run.title + run.span} className="relative mb-1 h-4">
                                <span
                                    className="bg-forest/80 absolute top-0.5 h-3 rounded-sm"
                                    style={{ left: `${run.startPct}%`, width: `${run.widthPct}%` }}
                                    title={`${run.title}${run.number ? ` #${run.number}` : ""} · ${run.span}`}
                                />
                                <span
                                    className="text-foreground absolute top-0 hidden max-w-[45%] truncate text-[0.68rem] font-medium sm:inline"
                                    style={{ left: `calc(${Math.min(run.startPct + run.widthPct, 55)}% + 6px)` }}
                                >
                                    {run.title}
                                    {run.number ? ` #${run.number}` : ""} · {run.span}
                                </span>
                            </div>
                        ))}
                        <div className="relative mt-1.5 h-4">
                            {survey.dots.map((d) => (
                                <span
                                    key={d.year}
                                    className="bg-(--brass) absolute top-1 h-2 w-2 rounded-full"
                                    style={{ left: `${d.pct}%` }}
                                    title={`${d.year}: ${d.count} release${d.count !== 1 ? "s" : ""}`}
                                />
                            ))}
                        </div>
                        <p className="text-muted-foreground mt-1.5 mb-0 text-[0.7rem]">
                            Bars are production runs at true width · dots are single-year releases
                            {survey.extraRuns > 0 && <> · {survey.extraRuns} shorter runs shown as dots</>}
                            . Details on every row below.
                        </p>
                    </div>
                </details>
            )}

            {/* Density strip — the mold's production heartbeat. */}
            {timeline.density.length >= 3 && (
                <div className="border-input bg-card mb-5 flex items-end gap-2 rounded-xl border px-4 pt-3 pb-2">
                    {timeline.density.map(([label, n]) => (
                        <div key={label} className="flex-1 text-center">
                            <div className="text-forest text-[0.7rem] font-semibold tabular-nums">{n}</div>
                            <div
                                className="bg-forest/75 mx-auto w-3/5 rounded-t-sm"
                                style={{ height: `${Math.max(4, Math.round((n / maxDensity) * 44))}px` }}
                            />
                            <div className="text-muted-foreground mt-0.5 text-[0.68rem] tabular-nums">
                                &rsquo;{label.slice(2, 4)}s
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {timeline.decades.map((decade) => (
                <div key={decade.label} className="relative mb-5 pl-7">
                    <span
                        aria-hidden="true"
                        className="border-(--brass)/45 absolute top-8 bottom-0 left-[7px] w-0 border-l-2"
                    />
                    <h3 className="relative mb-2 font-serif text-lg font-bold text-foreground">
                        <span
                            aria-hidden="true"
                            className="bg-(--brass) border-background absolute top-[0.42em] -left-[26px] h-3 w-3 rounded-full border-2"
                        />
                        {decade.label}{" "}
                        <span className="text-muted-foreground text-xs font-normal">
                            {decade.releases.length} release{decade.releases.length !== 1 ? "s" : ""}
                        </span>
                    </h3>
                    {decade.releases.map((r) => (
                        <div
                            key={r.id}
                            className="hover:bg-card grid grid-cols-[3.6rem_1fr_auto] items-start gap-x-3 rounded-lg px-2 py-1.5"
                        >
                            <div className="text-forest pt-0.5 text-sm font-semibold tabular-nums">
                                {r.year}
                                {r.yearEnd && r.yearEnd !== r.year && (
                                    <span className="text-muted-foreground block text-[0.65rem] font-medium">
                                        –{r.yearEnd}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[0.95rem] font-semibold">
                                    <Link href={href(r)} className="text-foreground hover:text-forest hover:underline">
                                        {r.title}
                                    </Link>
                                    {r.number && (
                                        <span className="text-muted-foreground ml-1.5 text-sm font-normal">#{r.number}</span>
                                    )}
                                    <OwnedMark id={r.id} />
                                    {medians[r.id] !== undefined && (
                                        <span
                                            className="border-(--brass)/40 bg-(--brass)/10 text-foreground ml-2 inline-block rounded-full border px-2 py-px align-[2px] text-[0.68rem] font-semibold tabular-nums"
                                            title="Median asking price on eBay right now — not a sale price."
                                        >
                                            🏷️ ~{money(medians[r.id])}
                                        </span>
                                    )}
                                </div>
                                {r.color && (
                                    <div className="text-muted-foreground truncate text-sm">{r.color}</div>
                                )}
                                {r.variants.length > 0 && (
                                    <details className="mt-0.5">
                                        <summary className="text-forest cursor-pointer text-xs font-semibold">
                                            +{r.variants.length} variation{r.variants.length !== 1 ? "s" : ""}
                                        </summary>
                                        <ul className="text-muted-foreground m-0 list-none p-0 pl-3 text-sm">
                                            {r.variants.map((v) => (
                                                <li key={v.id} className="mt-0.5">
                                                    <Link
                                                        href={referenceHref({
                                                            id: v.id,
                                                            maker,
                                                            title: r.title,
                                                            maker_slug: r.makerSlug,
                                                            slug: v.slug,
                                                        })}
                                                        className="hover:text-forest hover:underline"
                                                    >
                                                        {v.color ?? "variation"}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
                            </div>
                            {thumbs[r.id] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={thumbs[r.id]}
                                    alt=""
                                    loading="lazy"
                                    className="border-input h-12 w-12 rounded-md border object-cover"
                                />
                            ) : (
                                <span />
                            )}
                        </div>
                    ))}
                </div>
            ))}

            {timeline.undated.length > 0 && (
                <div className="border-input mt-4 border-t-2 pt-3 pl-7">
                    <h3 className="text-muted-foreground mb-2 font-serif text-base font-bold">
                        Undated — {timeline.undated.length} release
                        {timeline.undated.length !== 1 ? "s" : ""} still need a year
                    </h3>
                    {timeline.undated.map((r) => (
                        <div key={r.id} className="grid grid-cols-[3.6rem_1fr] gap-x-3 px-2 py-1">
                            <div className="text-muted-foreground text-sm">—</div>
                            <div className="min-w-0 text-sm">
                                <Link href={href(r)} className="text-foreground font-semibold hover:text-forest hover:underline">
                                    {r.title}
                                </Link>
                                {r.color && <span className="text-muted-foreground"> · {r.color}</span>}{" "}
                                <Link href={`/catalog/${r.id}?suggest=true`} className="text-forest whitespace-nowrap hover:underline">
                                    know the year? Suggest it →
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
        </OwnedProvider>
    );
}
