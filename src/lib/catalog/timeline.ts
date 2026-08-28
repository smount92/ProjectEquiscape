/**
 * Timeline shaping for mold and artist reference pages.
 *
 * Pure functions, no network — the rules live here so they can be
 * argued with in tests (the searchRank precedent). The Ledger design:
 * releases grouped into decade shelves, variations of one release
 * clustered behind their parent row, honest "undated" shelf for rows
 * whose year the catalog does not know yet.
 */

export interface TimelineSource {
    id: string;
    title: string;
    makerSlug?: string | null;
    slug?: string | null;
    attributes: Record<string, unknown> | null;
}

export interface TimelineRelease {
    id: string;
    title: string;
    makerSlug: string | null;
    slug: string | null;
    year: number | null;
    yearEnd: number | null;
    number: string | null;
    color: string | null;
    /** Collapsed same-release variants (finish/pattern differences). */
    variants: { id: string; color: string | null; slug: string | null }[];
}

export interface TimelineDecade {
    label: string;
    startYear: number;
    releases: TimelineRelease[];
}

export interface MoldTimeline {
    decades: TimelineDecade[];
    undated: TimelineRelease[];
    /** [decadeLabel, releaseCount] for the density strip, in order. */
    density: [string, number][];
    total: number;
    firstYear: number | null;
    lastYear: number | null;
}

/** Years arrive as numbers AND strings ("2000"); anything else is null. */
export function normalizeYear(raw: unknown): number | null {
    if (raw == null) return null;
    const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
    return Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : null;
}

function normTitle(t: string): string {
    return t.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Variants of one release — same model number, same title, same start
 * year, different finish/pattern text — collapse into one row (the
 * seven Ponokah-Eemetah paint patterns are one release to a shelf).
 * Rows without a number never cluster: "no number" is not a shared
 * identity.
 */
function clusterKey(r: TimelineRelease): string | null {
    if (!r.number) return null;
    return `${r.number}|${normTitle(r.title)}|${r.year ?? "?"}`;
}

export function toRelease(row: TimelineSource): TimelineRelease {
    const a = row.attributes ?? {};
    const num = a.model_number == null ? null : String(a.model_number).replace(/^#/, "").trim() || null;
    return {
        id: row.id,
        title: row.title,
        makerSlug: row.makerSlug ?? null,
        slug: row.slug ?? null,
        year: normalizeYear(a.release_year_start),
        yearEnd: normalizeYear(a.release_year_end),
        number: num,
        color: a.color_description ? String(a.color_description).trim() || null : null,
        variants: [],
    };
}

export function buildMoldTimeline(rows: TimelineSource[]): MoldTimeline {
    const releases = rows.map(toRelease);

    // Cluster variants; the first row seen anchors the cluster.
    const byKey = new Map<string, TimelineRelease>();
    const clustered: TimelineRelease[] = [];
    for (const r of releases) {
        const key = clusterKey(r);
        const anchor = key ? byKey.get(key) : undefined;
        if (anchor) {
            anchor.variants.push({ id: r.id, color: r.color, slug: r.slug });
        } else {
            if (key) byKey.set(key, r);
            clustered.push(r);
        }
    }

    const dated = clustered
        .filter((r) => r.year !== null)
        .sort((a, b) => a.year! - b.year! || a.title.localeCompare(b.title));
    const undated = clustered
        .filter((r) => r.year === null)
        .sort((a, b) => a.title.localeCompare(b.title));

    const decadeMap = new Map<number, TimelineRelease[]>();
    for (const r of dated) {
        const d = Math.floor(r.year! / 10) * 10;
        if (!decadeMap.has(d)) decadeMap.set(d, []);
        decadeMap.get(d)!.push(r);
    }
    const decades: TimelineDecade[] = [...decadeMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([startYear, rel]) => ({ label: `${startYear}s`, startYear, releases: rel }));

    return {
        decades,
        undated,
        density: decades.map((d) => [d.label, d.releases.length]),
        total: clustered.length,
        firstYear: dated[0]?.year ?? null,
        lastYear: dated.length ? dated[dated.length - 1].year! : null,
    };
}

// ── Artist career (the Braid) ────────────────────────────────────

export interface CareerWork {
    id: string;
    title: string;
    makerSlug: string | null;
    slug: string | null;
    year: number | null;
    /** "studio" = released under the artist's own name. */
    lane: "studio" | "factory";
    /** The manufacturer credited, for factory lane rows. */
    forMaker: string | null;
    itemType: string;
    scale: string | null;
}

export interface ShelfFamily {
    /** Base sculpt name shared by the sizes ("Nitro"). */
    base: string;
    works: { id: string; title: string; slug: string | null; makerSlug: string | null }[];
}

export interface ArtistCareer {
    dated: CareerWork[];
    /** Distinct manufacturers credited on factory work, most works first. */
    forMakers: string[];
    /** Undated studio works, grouped by scale label then family. */
    shelf: { scaleLabel: string; families: ShelfFamily[]; count: number }[];
    studioCount: number;
    factoryCount: number;
    firstYear: number | null;
    lastYear: number | null;
}

/** "Micro Nitro", "Nitro (mini)", "Haggis (trad.)" → base "nitro"/"haggis". */
export function familyBase(title: string): string {
    return title
        .toLowerCase()
        .replace(/\(([^)]*)\)/g, " ")
        .replace(/\b(micro|mini|trad\.?|traditional|classic|stablemate|sm|resin)\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

export function buildArtistCareer(
    own: (TimelineSource & { itemType: string; scale: string | null })[],
    factory: (TimelineSource & { itemType: string; scale: string | null; maker: string })[],
): ArtistCareer {
    const works: CareerWork[] = [
        ...own.map((r) => ({
            id: r.id,
            title: r.title,
            makerSlug: r.makerSlug ?? null,
            slug: r.slug ?? null,
            year: normalizeYear(r.attributes?.release_year_start),
            lane: "studio" as const,
            forMaker: null,
            itemType: r.itemType,
            scale: r.scale,
        })),
        ...factory.map((r) => ({
            id: r.id,
            title: r.title,
            makerSlug: r.makerSlug ?? null,
            slug: r.slug ?? null,
            year: normalizeYear(r.attributes?.release_year_start),
            lane: "factory" as const,
            forMaker: r.maker,
            itemType: r.itemType,
            scale: r.scale,
        })),
    ];

    const dated = works
        .filter((w) => w.year !== null)
        .sort((a, b) => a.year! - b.year! || a.title.localeCompare(b.title));

    // The Workshop Shelf: undated STUDIO works grouped by scale, sizes
    // of one sculpt clustered into a family. Undated factory work is
    // rare and rides along under its manufacturer name as the scale
    // label, so nothing catalogued ever disappears.
    const undatedStudio = works.filter((w) => w.year === null && w.lane === "studio");
    const undatedFactory = works.filter((w) => w.year === null && w.lane === "factory");

    const byScale = new Map<string, typeof undatedStudio>();
    for (const w of undatedStudio) {
        const label = w.scale ?? "Scale not yet recorded";
        if (!byScale.has(label)) byScale.set(label, []);
        byScale.get(label)!.push(w);
    }
    for (const w of undatedFactory) {
        const label = `For ${w.forMaker ?? "a manufacturer"}`;
        if (!byScale.has(label)) byScale.set(label, []);
        byScale.get(label)!.push(w);
    }

    const shelf = [...byScale.entries()]
        .map(([scaleLabel, list]) => {
            const fams = new Map<string, ShelfFamily>();
            for (const w of list) {
                const base = familyBase(w.title) || w.title.toLowerCase();
                if (!fams.has(base)) fams.set(base, { base, works: [] });
                fams.get(base)!.works.push({ id: w.id, title: w.title, slug: w.slug, makerSlug: w.makerSlug });
            }
            const families = [...fams.values()].sort((a, b) => a.base.localeCompare(b.base));
            return { scaleLabel, families, count: list.length };
        })
        .sort((a, b) => b.count - a.count);

    const makerCounts = new Map<string, number>();
    for (const f of factory) makerCounts.set(f.maker, (makerCounts.get(f.maker) ?? 0) + 1);
    const forMakers = [...makerCounts.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);

    return {
        dated,
        shelf,
        forMakers,
        studioCount: own.length,
        factoryCount: factory.length,
        firstYear: dated[0]?.year ?? null,
        lastYear: dated.length ? dated[dated.length - 1].year! : null,
    };
}

// ── The Survey: true-scale production overview ───────────────────

export interface SurveyRun {
    title: string;
    number: string | null;
    startPct: number;
    widthPct: number;
    span: string;
}

export interface SurveyDot {
    year: number;
    count: number;
    pct: number;
}

export interface Survey {
    first: number;
    last: number;
    /** Longest production runs, one lane each, in start order. */
    runs: SurveyRun[];
    /** Single-year releases (and overflow runs) binned per year. */
    dots: SurveyDot[];
    /** Runs that did not get a lane and joined the dots instead. */
    extraRuns: number;
    ticks: number[];
}

/**
 * The collapsible chart above long timelines: years at true scale, so
 * a 27-year run visibly owns its third of the mold's life. Null for
 * short histories — under 15 years the Ledger alone tells the story.
 */
export function buildSurvey(t: MoldTimeline, maxLanes = 8): Survey | null {
    if (t.firstYear === null || t.lastYear === null || t.lastYear - t.firstYear < 15) return null;
    const span = t.lastYear - t.firstYear + 1;
    const all = t.decades.flatMap((d) => d.releases);

    const runs = all
        .filter((r) => r.year !== null && r.yearEnd !== null && r.yearEnd > r.year)
        .sort((a, b) => (b.yearEnd! - b.year!) - (a.yearEnd! - a.year!));
    const lanes = runs
        .slice(0, maxLanes)
        .sort((a, b) => a.year! - b.year!)
        .map((r) => ({
            title: r.title,
            number: r.number,
            startPct: ((r.year! - t.firstYear!) / span) * 100,
            widthPct: Math.max(1.5, ((r.yearEnd! - r.year! + 1) / span) * 100),
            span: `${r.year}–${r.yearEnd}`,
        }));

    const dotSource = [...all.filter((r) => r.yearEnd === null || r.yearEnd === r.year), ...runs.slice(maxLanes)];
    const byYear = new Map<number, number>();
    for (const r of dotSource) {
        if (r.year === null) continue;
        byYear.set(r.year, (byYear.get(r.year) ?? 0) + 1);
    }
    const dots = [...byYear.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, count]) => ({ year, count, pct: ((year - t.firstYear!) / span) * 100 }));

    // Ticks land on round-ish years: first, last, and 2-3 between.
    const step = Math.max(5, Math.round(span / 4 / 5) * 5);
    const ticks: number[] = [];
    for (let y = Math.ceil(t.firstYear / step) * step; y < t.lastYear - 2; y += step) {
        if (y > t.firstYear + 2) ticks.push(y);
    }

    return {
        first: t.firstYear,
        last: t.lastYear,
        runs: lanes,
        dots,
        extraRuns: Math.max(0, runs.length - maxLanes),
        ticks,
    };
}
