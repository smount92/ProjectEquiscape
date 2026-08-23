import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import CatalogMasthead from "@/components/catalog/CatalogMasthead";
import CatalogFilterBar from "@/components/catalog/CatalogFilterBar";
import CatalogResultsTable from "@/components/catalog/CatalogResultsTable";
import CatalogCardsList from "@/components/catalog/CatalogCardsList";
import CatalogViewToggle from "@/components/catalog/CatalogViewToggle";

import {
    pickQuickChips,
    PREFERRED_QUICK_MAKERS,
    PREFERRED_QUICK_SCALES,
    type CardAttributes,
} from "@/lib/catalog/cardDisplay";
import { getCatalogItems } from "@/app/actions/catalog-suggestions";
import {
    parseCatalogSearchParams,
    buildCatalogSearchParams,
    catalogSortToQuery,
    countActiveCatalogFilters,
    type CatalogFilters,
} from "@/lib/catalog/filterParams";
import { sortScalesBySize } from "@/lib/catalog/taxonomy";

export const metadata: Metadata = {
    title: "Reference Catalog",
    description:
        "Browse 10,500+ model horse reference entries. Search by name, maker, mold, and scale. Community-maintained catalog for Breyer, Stone, and Artist Resins.",
};

const PAGE_SIZE = 50;

interface CatalogItemRow {
    id: string;
    item_type: string;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    /* getCatalogItems already selects these; the CARDS browse reads them
       (the flag-off table ignores them, as it always has). */
    parent_id?: string | null;
    attributes?: CardAttributes | null;
}

interface CatalogStat {
    catalog_id: string;
    owner_count: number;
    want_count: number;
    for_sale_count: number;
}

/** Build a /catalog href for a page number, preserving the active filters. */
function pageHref(filters: CatalogFilters, page: number): string {
    const qs = buildCatalogSearchParams({ ...filters, page }).toString();
    return qs ? `/catalog?${qs}` : "/catalog";
}

/** ISO timestamp for "7 days ago" — kept out of the component body so the
 *  clock read isn't an impure call during render (react-hooks/purity). */
function sevenDaysAgoIso(): string {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function ReferencePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const filters = parseCatalogSearchParams(await searchParams);
    const { sortBy, sortDir } = catalogSortToQuery(filters.sort);
    const supabase = await createClient();

    // Filtered page of catalog rows + distinct facet options (one RPC).
    const [result, facetRes] = await Promise.all([
        getCatalogItems({
            search: filters.q,
            maker: filters.maker,
            manufacturer: filters.manufacturer,
            artist: filters.artist,
            scale: filters.scale,
            type: filters.type,
            yearFrom: filters.yearFrom,
            yearTo: filters.yearTo,
            color: filters.color,
            model: filters.model,
            medium: filters.medium,
            material: filters.material,
            runType: filters.runType,
            sortBy,
            sortDir,
            page: filters.page,
            pageSize: PAGE_SIZE,
        }),
        supabase.rpc("get_catalog_facets"),
    ]);

    const items = (result.success ? result.items : []) as CatalogItemRow[];
    const total = result.success ? result.total : 0;
    const facets = (facetRes.data ?? {}) as {
        makers?: string[];
        scales?: string[];
        materials?: string[];
        manufacturers?: string[];
        artists?: string[];
    };
    // Scales read largest model → smallest, never alphabetically.
    if (facets.scales) facets.scales = sortScalesBySize(facets.scales);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const activeCount = countActiveCatalogFilters(filters);

    // At-a-glance community stats for the visible page (batch, anon-safe RPC —
    // migration 134). One call for the whole page; degrades to no stats if the
    // RPC isn't deployed yet. Cast until gen-types includes get_catalog_stats.
    const statsMap = new Map<string, { owner: number; want: number; forSale: number }>();
    if (items.length > 0) {
        const rpc = supabase.rpc.bind(supabase) as unknown as (
            fn: string,
            args: { p_ids: string[] },
        ) => Promise<{ data: CatalogStat[] | null }>;
        const { data: statsRows } = await rpc("get_catalog_stats", {
            p_ids: items.map((i) => i.id),
        });
        for (const s of statsRows ?? []) {
            statsMap.set(s.catalog_id, {
                owner: Number(s.owner_count) || 0,
                want: Number(s.want_count) || 0,
                forSale: Number(s.for_sale_count) || 0,
            });
        }
    }

    // ── CATALOG_V2 (cards browse) extras — exactly two more batched calls ──
    // 1. get_catalog_browse_thumbs (migration 147): one community thumbnail
    //    per visible item. Feature-detected: pre-apply the RPC errors, the
    //    catch keeps the map empty, and cards render 🐴 placeholders.
    // 2. One grouped children query for the visible MOLDS' release counts
    //    (aggregated here — PostgREST has no GROUP BY). No per-item loops.
    const thumbsMap = new Map<string, string>();
    const releaseCounts = new Map<string, number>();
    if (items.length > 0) {
        const moldIds = items
            .filter((i) => i.item_type === "plastic_mold")
            .map((i) => i.id);
        const thumbsRpc = supabase.rpc.bind(supabase) as unknown as (
            fn: string,
            args: { p_ids: string[] },
        ) => Promise<{ data: { catalog_id: string; image_url: string }[] | null; error: unknown }>;
        const [thumbsRes, childRes] = await Promise.all([
            // Feature-detect wrapper: an RPC that doesn't exist yet reports
            // through `error` (ignored below); the try/catch only guards
            // transport-level throws. PostgrestBuilder is thenable-only, so
            // await-in-try rather than .catch().
            (async () => {
                try {
                    return await thumbsRpc("get_catalog_browse_thumbs", {
                        p_ids: items.map((i) => i.id),
                    });
                } catch {
                    return { data: null, error: true as unknown };
                }
            })(),
            moldIds.length > 0
                ? supabase
                      .from("catalog_items")
                      .select("parent_id")
                      .in("parent_id", moldIds)
                      .limit(10_000)
                : Promise.resolve({ data: null }),
        ]);
        for (const t of thumbsRes.data ?? []) {
            if (t.catalog_id && t.image_url) thumbsMap.set(t.catalog_id, t.image_url);
        }
        for (const c of (childRes.data ?? []) as { parent_id: string | null }[]) {
            if (c.parent_id)
                releaseCounts.set(c.parent_id, (releaseCounts.get(c.parent_id) ?? 0) + 1);
        }
    }

    // Sidebar data (unchanged from the previous catalog page).
    const [{ data: curators }, { count: pendingSuggestions }, { count: recentChanges }] =
        await Promise.all([
            supabase
                .from("users")
                .select("id, alias_name, avatar_url, approved_suggestions_count")
                .gt("approved_suggestions_count", 0)
                .order("approved_suggestions_count", { ascending: false })
                .limit(5),
            supabase
                .from("catalog_suggestions")
                .select("id", { count: "estimated", head: true })
                .eq("status", "pending"),
            supabase
                .from("catalog_changelog")
                .select("id", { count: "estimated", head: true })
                .gte("created_at", sevenDaysAgoIso()),
        ]);

    return (
        <ExplorerLayout noHeader>
            {/* Leather landmark: the catalog masthead IS the page header */}
            <CatalogMasthead totalCount={total} />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
                {/* Main: filter bar + results table + pagination.
                    min-w-0: a grid child's default min-width:auto lets wide
                    content (the v2 chips row's overflow-x-auto) blow the 1fr
                    track past the container and shove the aside off-viewport. */}
                <div className="min-w-0">
                    <CatalogFilterBar
                        filters={filters}
                        makers={facets.makers ?? []}
                        scales={facets.scales ?? []}
                        materials={facets.materials ?? []}
                        manufacturers={facets.manufacturers ?? []}
                        artists={facets.artists ?? []}
                        quickMakers={pickQuickChips(
                            facets.manufacturers?.length ? facets.manufacturers : facets.makers,
                            [...PREFERRED_QUICK_MAKERS],
                            4,
                        )}
                        quickScales={pickQuickChips(
                            facets.scales,
                            [...PREFERRED_QUICK_SCALES],
                            3,
                        )}
                    />

                    <p className="mt-3 mb-3 pl-1 text-sm text-muted-foreground italic" id="catalog-result-line">
                        <b className="text-foreground not-italic">{total.toLocaleString()}</b>{" "}
                        {activeCount > 0 ? "matching" : ""} entr{total === 1 ? "y" : "ies"}
                    </p>

                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-input bg-muted/40 p-16 text-center">
                            <span className="mb-4 text-5xl">🔍</span>
                            <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">No entries found</h2>
                            <p className="max-w-sm text-muted-foreground">
                                Nothing matches these filters.{" "}
                                {/* redirectTo = this filtered catalog URL, so the
                                    suggest flow (and its login bounce) can bring
                                    the searcher back to where they left off. */}
                                <Link
                                    href={`/catalog/suggestions/new?redirectTo=${encodeURIComponent(pageHref(filters, filters.page))}`}
                                    className="text-forest hover:underline"
                                >
                                    Suggest a new entry?
                                </Link>
                            </p>
                        </div>
                    ) : (
                        /* Identification cards with the compact-table toggle
                           for power curators — the table node IS the original
                           renderer, unforked. */
                        <CatalogViewToggle
                            cards={
                                <CatalogCardsList
                                    items={items}
                                    statsMap={statsMap}
                                    thumbs={thumbsMap}
                                    releaseCounts={releaseCounts}
                                />
                            }
                            table={<CatalogResultsTable items={items} statsMap={statsMap} />}
                        />
                    )}

                    {/* Pagination — plain anchor links (SEO-crawlable, no client JS) */}
                    {totalPages > 1 && (
                        <nav
                            className="mt-6 flex items-center justify-center gap-4"
                            aria-label="Catalog pagination"
                        >
                            {filters.page > 1 ? (
                                <Link
                                    href={pageHref(filters, filters.page - 1)}
                                    className="btn-ghostleather !px-4 !py-2 !text-xs"
                                    rel="prev"
                                >
                                    ← Previous
                                </Link>
                            ) : (
                                <span className="px-4 py-2 text-xs text-muted-foreground opacity-40">← Previous</span>
                            )}
                            <span className="text-sm text-muted-foreground">
                                Page {filters.page} of {totalPages.toLocaleString()}
                            </span>
                            {filters.page < totalPages ? (
                                <Link
                                    href={pageHref(filters, filters.page + 1)}
                                    className="btn-ghostleather !px-4 !py-2 !text-xs"
                                    rel="next"
                                >
                                    Next →
                                </Link>
                            ) : (
                                <span className="px-4 py-2 text-xs text-muted-foreground opacity-40">Next →</span>
                            )}
                        </nav>
                    )}
                </div>

                {/* Sidebar — a LEATHER rail (activity-rail precedent): frames the
                    parchment work area with the masthead, celebrates contributors,
                    and gives the ghostleather/brass buttons their proper ground. */}
                <aside className="flex flex-col gap-4">
                    <div className="leather-panel stitched flex flex-col gap-3 rounded-xl p-5">
                        <h3 className="text-engraved-light font-serif text-xs font-bold tracking-[0.14em] uppercase">
                            Community
                        </h3>
                        <div className="flex flex-col gap-2">
                            <Link href="/catalog/suggestions" className="btn-ghostleather !justify-start !px-4 !py-2 !text-xs">
                                💡 View Suggestions
                                {(pendingSuggestions ?? 0) > 0 && (
                                    <span className="ml-auto rounded-full bg-forest px-2 py-0.5 text-[0.7rem] font-bold text-white">
                                        {pendingSuggestions}
                                    </span>
                                )}
                            </Link>
                            <Link href="/catalog/suggestions/new" className="btn-brass !justify-start !px-4 !py-2 !text-xs no-underline hover:no-underline">
                                📗 Suggest New Entry
                            </Link>
                            <Link href="/catalog/changelog" className="btn-ghostleather !justify-start !px-4 !py-2 !text-xs">
                                📋 Changelog
                                {(recentChanges ?? 0) > 0 && (
                                    <span className="ml-auto text-[0.7rem]" style={{ color: "var(--leather-text-muted)" }}>
                                        {recentChanges} this week
                                    </span>
                                )}
                            </Link>
                        </div>
                    </div>

                    {(curators ?? []).length > 0 && (
                        <div className="leather-panel stitched flex flex-col gap-3 rounded-xl p-5">
                            <h3 className="text-engraved-light font-serif text-xs font-bold tracking-[0.14em] uppercase">
                                Top Curators
                            </h3>
                            <ul className="m-0 flex list-none flex-col p-0">
                                {(
                                    curators as {
                                        id: string;
                                        alias_name: string;
                                        avatar_url: string | null;
                                        approved_suggestions_count: number;
                                    }[]
                                ).map((curator, i) => (
                                    <li
                                        key={curator.id}
                                        className="flex items-center gap-2 py-2.5"
                                        style={
                                            i > 0
                                                ? { borderTop: "1px dashed rgba(217,185,120,0.22)" }
                                                : undefined
                                        }
                                    >
                                        <span className="min-w-[24px] text-center">
                                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                                        </span>
                                        <Link
                                            href={`/profile/${curator.alias_name}`}
                                            className="text-sm font-semibold no-underline hover:underline"
                                            style={{ color: "var(--leather-text)" }}
                                        >
                                            @{curator.alias_name}
                                        </Link>
                                        <span
                                            className="ml-auto font-serif text-xs tabular-nums"
                                            style={{ color: "var(--leather-text-muted)" }}
                                            title="approved contributions"
                                        >
                                            {curator.approved_suggestions_count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>
        </ExplorerLayout>
    );
}
