import Link from "next/link";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import ArtistNotesSuggest from "@/components/reference/ArtistNotesSuggest";
import type { ArtistCareerData } from "@/app/actions/reference-pages";

/**
 * The Braid — an artist's studio and factory work interleaved as one
 * chronological career, with the Workshop Shelf underneath for the
 * (currently much larger) undated body of work.
 *
 * On phones the braid is a single spine with lane-colored edges; from
 * md: up, dated rows spread into Facing Pages — studio on the left,
 * factory on the right, years down the gutter. Same DOM, a grid swap.
 */
export default function ArtistCareer({ data, artistName }: { data: ArtistCareerData; artistName: string }) {
    const { career, isArtist, meta } = data;
    if (!isArtist || (career.dated.length === 0 && career.shelf.length === 0)) return null;

    const href = (w: { id: string; title: string; makerSlug: string | null; slug: string | null }, maker?: string) =>
        referenceHref({ id: w.id, maker: maker ?? artistName, title: w.title, maker_slug: w.makerSlug, slug: w.slug });

    // The stat block: computed facts always (the catalog is the source
    // of truth for counts and ranges); curated facts (200) join in when
    // an artists row exists. Curated active years beat the documented
    // range — "documented 1997–2017" is a floor, not a biography.
    const active = meta?.activeFrom
        ? `${meta.activeFrom}–${meta.activeTo ?? "present"}`
        : career.firstYear
          ? `documented ${career.firstYear}–${career.lastYear ?? "present"}`
          : null;
    const statRows: [string, React.ReactNode][] = [
        ["Studio works", career.studioCount.toLocaleString()],
        ...(career.factoryCount > 0
            ? [["Factory sculpts", career.factoryCount.toLocaleString()] as [string, React.ReactNode]]
            : []),
        ...(career.forMakers.length > 0
            ? [["Sculpted for", career.forMakers.join(", ")] as [string, React.ReactNode]]
            : []),
        ...(active ? [["Active", active] as [string, React.ReactNode]] : []),
        ...(meta?.studioName ? [["Studio", meta.studioName] as [string, React.ReactNode]] : []),
        ...(meta?.disciplines.length
            ? [["Disciplines", meta.disciplines.join(", ")] as [string, React.ReactNode]]
            : []),
        ...(meta?.website
            ? [
                  [
                      "Website",
                      <a
                          key="w"
                          href={meta.website}
                          rel="nofollow noopener"
                          target="_blank"
                          className="text-forest hover:underline"
                      >
                          {meta.website.replace(/^https?:\/\//, "")}
                      </a>,
                  ] as [string, React.ReactNode],
              ]
            : []),
    ];

    return (
        <section className="mb-8">
            <h2 className="mb-3 font-serif text-xl font-bold text-foreground">About the artist</h2>

            {/* Stat block — the passport treatment, for a person. */}
            <div className="mb-4 rounded-xl border border-input bg-card px-5 py-2">
                {statRows.map(([label, value]) => (
                    <div
                        key={label}
                        className="flex items-baseline justify-between gap-4 border-b border-dashed border-border-tan/20 py-2.5 last:border-0"
                    >
                        <span className="text-sm font-medium text-secondary-foreground">{label}</span>
                        <span className="max-w-[70%] text-right text-sm font-semibold text-foreground">{value}</span>
                    </div>
                ))}
            </div>

            {/* Registry notes, artist edition — always visible, so the
                empty state IS the invitation. Suggestions ride the same
                pipeline as catalog notes; approval writes artists (200). */}
            <div className="mb-5">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="m-0 font-serif text-base font-bold text-foreground">Registry notes</h3>
                    <ArtistNotesSuggest
                        artistName={artistName}
                        hasNotes={Boolean(meta?.registryNotes)}
                        currentNotes={meta?.registryNotes ?? null}
                    />
                </div>
                {meta?.registryNotes ? (
                    <>
                        <p className="mt-0 mb-2 text-xs text-muted-foreground">
                            Written by the community, reviewed by curators.
                        </p>
                        <div className="rounded-xl border border-input bg-card px-5 py-4 text-[0.95rem] leading-relaxed whitespace-pre-line text-secondary-foreground">
                            {meta.registryNotes}
                        </div>
                    </>
                ) : (
                    <div className="rounded-xl border border-dashed border-input bg-card px-5 py-4 text-sm text-muted-foreground">
                        Nobody has written {artistName}&rsquo;s story yet — who they are in the hobby, what
                        they&rsquo;re known for, how to spot their work. Know it? You could write the first notes.
                    </div>
                )}
            </div>

            {career.dated.length > 0 && (
                <>
                    <h3 className="mb-1 font-serif text-base font-bold text-foreground">Career timeline</h3>
                    {/* Legend */}
                    <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span>
                            <span
                                aria-hidden="true"
                                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-forest align-middle"
                            />
                            Studio — released under {artistName}&rsquo;s own name
                        </span>
                        <span>
                            <span
                                aria-hidden="true"
                                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-(--brass) align-middle"
                            />
                            Factory — sculpted for a manufacturer
                        </span>
                    </div>

                    {/* Facing-page column heads, desktop only */}
                    <div className="mb-1 hidden grid-cols-[1fr_4rem_1fr] text-[0.68rem] font-bold tracking-widest text-muted-foreground uppercase md:grid">
                        <span className="text-right text-forest">Studio</span>
                        <span />
                        <span className="text-(--brass)">For manufacturers</span>
                    </div>

                    {/* Facing Pages needs EXPLICIT grid placement: with
                        auto-placement, a factory row (no studio cell) let
                        the year slide into the left column and the gutter
                        zigzagged. Every cell names its column; the spine
                        is one absolute rule the year chips sit on. */}
                    <div className="relative mb-5 rounded-xl border border-input bg-card px-3 py-2 md:px-4">
                        <span
                            aria-hidden="true"
                            className="absolute inset-y-3 left-1/2 hidden w-0.5 -translate-x-1/2 bg-(--brass)/35 md:block"
                        />
                        {career.dated.map((w) => (
                            <div
                                key={w.id}
                                className="grid grid-cols-[3.4rem_1fr] items-baseline gap-x-3 py-1.5 md:grid-cols-[1fr_5rem_1fr] md:items-start md:gap-x-0"
                            >
                                {/* Year: leads on mobile, becomes the gutter chip on md+ */}
                                <div className="text-sm font-bold text-foreground tabular-nums md:col-start-2 md:row-start-1 md:text-center">
                                    <span className="md:relative md:inline-block md:rounded-full md:bg-card md:px-2 md:py-0.5">
                                        {w.year}
                                    </span>
                                </div>
                                <div
                                    className={
                                        w.lane === "studio"
                                            ? "col-start-2 row-start-1 border-l-[3px] border-forest pl-3 md:col-start-1 md:border-l-0 md:pr-4 md:pl-0 md:text-right"
                                            : "col-start-2 row-start-1 border-l-[3px] border-(--brass) pl-3 md:col-start-3 md:border-l-0 md:pl-4"
                                    }
                                >
                                    <div className="text-[0.94rem] font-semibold">
                                        <Link
                                            href={href(w, w.lane === "factory" ? (w.forMaker ?? undefined) : undefined)}
                                            className="text-foreground hover:text-forest hover:underline"
                                        >
                                            {w.title}
                                        </Link>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {w.lane === "factory" ? (
                                            <>
                                                <span className="font-semibold text-(--brass)">
                                                    {w.forMaker ?? "manufacturer"}
                                                </span>
                                                {w.itemType === "plastic_mold" ? " · mold" : ""}
                                            </>
                                        ) : (
                                            <span className="font-semibold text-forest">
                                                {w.scale ?? "studio release"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* The Workshop Shelf — catalogued, awaiting years. */}
            {career.shelf.length > 0 && (
                <div>
                    <h3 className="mb-1 font-serif text-base font-bold text-foreground">
                        The Workshop Shelf{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                            {career.shelf.reduce((n, s) => n + s.count, 0)} works awaiting a year
                        </span>
                    </h3>
                    <p className="mb-2 text-xs text-muted-foreground">
                        Every chip is a work; a dated suggestion lifts it onto the timeline above.
                    </p>
                    {career.shelf.map((s) => (
                        <div key={s.scaleLabel} className="mb-2.5">
                            <div className="mb-1 text-[0.7rem] font-bold tracking-widest text-forest uppercase">
                                {s.scaleLabel} · {s.count}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {s.families.map((f) => {
                                    const first = f.works[0];
                                    return (
                                        <Link
                                            key={f.base + first.id}
                                            href={href(first)}
                                            className="rounded-lg border border-input bg-card px-2.5 py-1 text-sm text-foreground no-underline hover:border-forest"
                                        >
                                            {first.title}
                                            {f.works.length > 1 && (
                                                <span className="ml-1 text-[0.7rem] text-forest">
                                                    {f.works.length} sizes
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
