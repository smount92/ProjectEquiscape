import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { REFERENCE_PAGES_CACHE_TAG } from "@/app/actions/reference-pages";
import { groupMakerCounts, countByParent, type MakerSummary } from "@/lib/catalog/makerHub";

// ============================================================
// MAKER HUB PAGES (/reference, /reference/[maker]) — data loaders
// ============================================================
// Same stack as reference-pages.ts: cookie-less anon client (catalog_items is
// anon-readable, migration 124) + unstable_cache so the hub pages stay
// static/ISR-cacheable. Every loader is BOUNDED: light-column paged selects
// grouped in process — never a per-item query or RPC loop. PostgREST has no
// GROUP BY, so "one grouped query" here means one logical paged scan of the
// grouping column(s), the same idiom sitemap.ts and generateStaticParams
// already use over this table.
// ============================================================

const REVALIDATE = 3600;

/** PostgREST caps a select at 1000 rows — page through, hard-capped. */
const PAGE = 1000;
const SCAN_CAP = 60_000; // catalog is ~11k rows; same ceiling as sitemap.ts

/**
 * Distinct makers with item counts — ONE paged scan of (maker, maker_slug)
 * grouped in process, cached for an hour. Serves the /reference index, hub
 * name resolution, per-maker totals, and cross-links, so the whole maker
 * surface costs a single cached scan.
 */
export const getMakerIndex = unstable_cache(
    async (): Promise<MakerSummary[]> => {
        const supabase = createAnonClient();
        const rows: { maker: string | null; maker_slug: string | null }[] = [];
        for (let from = 0; from < SCAN_CAP; from += PAGE) {
            const { data, error } = await supabase
                .from("catalog_items")
                .select("maker, maker_slug")
                .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            rows.push(...(data as { maker: string | null; maker_slug: string | null }[]));
            if (data.length < PAGE) break;
        }
        return groupMakerCounts(rows);
    },
    ["maker-hubs:index"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

export interface MakerMold {
    id: string;
    title: string;
    makerSlug: string | null;
    slug: string | null;
    /** Number of catalogued releases on this mold (0 for none). */
    releaseCount: number;
}

/**
 * A maker's molds, alphabetical, each with its child-release count.
 * Two bounded queries total: (1) the maker's plastic_mold rows, (2) one
 * paged scan of the parent_id column over the maker's plastic_release rows,
 * counted in process — NOT a count query per mold.
 */
export const getMakerMolds = unstable_cache(
    async (makerSlug: string): Promise<MakerMold[]> => {
        const supabase = createAnonClient();

        const { data: moldData } = await supabase
            .from("catalog_items")
            .select("id, title, maker_slug, slug")
            .eq("maker_slug", makerSlug)
            .eq("item_type", "plastic_mold")
            .order("title")
            .limit(1000);
        const molds = (moldData ?? []) as {
            id: string;
            title: string;
            maker_slug: string | null;
            slug: string | null;
        }[];
        if (molds.length === 0) return [];

        // One grouped pass over the maker's releases' parent_id column.
        const parentIds: (string | null)[] = [];
        for (let from = 0; from < SCAN_CAP; from += PAGE) {
            const { data, error } = await supabase
                .from("catalog_items")
                .select("parent_id")
                .eq("maker_slug", makerSlug)
                .eq("item_type", "plastic_release")
                .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            parentIds.push(...(data as { parent_id: string | null }[]).map((r) => r.parent_id));
            if (data.length < PAGE) break;
        }
        const counts = countByParent(parentIds);

        return molds.map((m) => ({
            id: m.id,
            title: m.title,
            makerSlug: m.maker_slug,
            slug: m.slug,
            releaseCount: counts.get(m.id) ?? 0,
        }));
    },
    ["maker-hubs:molds"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

export interface MakerRecentItem {
    id: string;
    title: string;
    maker: string;
    makerSlug: string | null;
    slug: string | null;
    createdAt: string | null;
}

/** Newest catalog entries for a maker — one ordered, limited query. */
export const getMakerRecent = unstable_cache(
    async (makerSlug: string, limit = 12): Promise<MakerRecentItem[]> => {
        const supabase = createAnonClient();
        const { data } = await supabase
            .from("catalog_items")
            .select("id, title, maker, maker_slug, slug, created_at")
            .eq("maker_slug", makerSlug)
            .order("created_at", { ascending: false })
            .limit(limit);
        const rows = (data ?? []) as unknown as {
            id: string;
            title: string;
            maker: string;
            maker_slug: string | null;
            slug: string | null;
            created_at: string | null;
        }[];
        return rows.map((r) => ({
            id: r.id,
            title: r.title,
            maker: r.maker,
            makerSlug: r.maker_slug,
            slug: r.slug,
            createdAt: r.created_at,
        }));
    },
    ["maker-hubs:recent"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);
