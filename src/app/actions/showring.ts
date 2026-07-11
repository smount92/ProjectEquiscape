"use server";

/**
 * Show Ring v2 server actions (NEXT_PUBLIC_SHOWRING_V2).
 *
 * Ports the Digital Stable filter engine (src/app/actions/stable.ts)
 * to the community showcase: the URL is the single source of truth,
 * ALL filtering happens server-side in the query (never a useMemo
 * over one 24-row page), Show More appends via loadMoreShowRing.
 *
 * ONE shared query core (queryShowRing) feeds both the first page and
 * Show More — the legacy build duplicated the whole query between
 * community/page.tsx and actions/community.ts and the copies drifted.
 *
 * Fixes carried in from the legacy Show Ring:
 *  - blocked-user exclusion moved into SQL (the old build filtered in
 *    JS AFTER fetching 24 rows → short pages and a drifting
 *    hasMore/totalCount),
 *  - q sanitized before PostgREST .or() interpolation,
 *  - maker/scale actually filter (via the catalog inner join),
 *  - soft-deleted horses excluded,
 *  - facet options derived from ALL public horses, not the loaded 24.
 *
 * ZERO new migrations this build: facet options use a bounded scan
 * (see fetchShowRingFacets) instead of an RPC; upgrade path noted
 * there.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { firstZodError, getShowRingPageSchema } from "@/lib/showring/schemas";
import type { ShowRingCard, ShowRingFacetOptions } from "@/lib/showring/types";

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

/** Max catalog rows matched for the q ilike-over-the-join expansion. */
const CATALOG_MATCH_CAP = 100;
/** Max blocked users honored in the SQL exclusion (uuids in a .not()). */
const BLOCKED_CAP = 1000;
/**
 * Facet-scan bound: distinct maker/scale/finish come from scanning up
 * to this many public horses (~1,800 exist today, so this covers the
 * whole dataset). Future migration: a get_showring_facets RPC
 * (SELECT DISTINCT over public non-deleted horses), mirroring
 * get_stable_facets from migration 123 — then this scan goes away.
 */
const FACET_SCAN_CAP = 2000;

type ShowRingPageInput = z.infer<typeof getShowRingPageSchema>;
type ShowRingFilterInput = Omit<ShowRingPageInput, "offset" | "limit">;

/** PostgREST .or() strings break on commas/parens — strip them. */
function sanitizeForOr(q: string): string {
    return q.replace(/[,()]/g, " ").trim();
}

/**
 * The viewer's block list, bounded for the SQL .not() exclusion.
 * Blocked owners are excluded IN the query so pages are always full
 * and count/hasMore are exact (the legacy build filtered the fetched
 * page in JS instead).
 */
async function fetchBlockedOwnerIds(
    supabase: SupabaseClient,
    userId: string,
): Promise<string[]> {
    const { data } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId)
        .limit(BLOCKED_CAP);
    return ((data ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id);
}

/**
 * Build the filtered, sorted public-horses page query. Everything
 * happens in the database — the returned rows ARE the result page.
 */
async function queryShowRing(
    supabase: SupabaseClient,
    userId: string,
    filters: ShowRingFilterInput,
    offset: number,
    limit: number,
) {
    const blockedOwnerIds = await fetchBlockedOwnerIds(supabase, userId);

    // Filtering on the joined catalog columns requires an inner join;
    // otherwise keep the left join so unlisted molds still appear.
    const needsInnerJoin = Boolean(filters.maker || filters.scale);
    const catalogSelect = needsInnerJoin
        ? "catalog_items:catalog_id!inner(title, maker, scale, item_type)"
        : "catalog_items:catalog_id(title, maker, scale, item_type)";

    let query = supabase
        .from("user_horses")
        .select(
            `id, owner_id, custom_name, finish_type, condition_grade, asset_category, created_at, sculptor, trade_status, listing_price, marketplace_notes, catalog_id,
             users!inner(alias_name),
             ${catalogSelect},
             horse_images(image_url, angle_profile)`,
            { count: "exact" },
        )
        .eq("visibility", "public")
        .is("deleted_at", null);

    // Blocked-user exclusion in SQL (owner ids are uuids — safe to
    // interpolate into the .not() list).
    if (blockedOwnerIds.length > 0) {
        query = query.not("owner_id", "in", `(${blockedOwnerIds.join(",")})`);
    }

    if (filters.finish) query = query.eq("finish_type", filters.finish);
    if (filters.trade) query = query.eq("trade_status", filters.trade);
    if (filters.maker) query = query.eq("catalog_items.maker", filters.maker);
    if (filters.scale) query = query.eq("catalog_items.scale", filters.scale);

    if (filters.q) {
        const q = sanitizeForOr(filters.q);
        if (q) {
            // Whole-ring search: custom name + sculptor on the base
            // table, catalog title/maker via a bounded id expansion
            // (PostgREST .or() can't mix base and embedded columns).
            const { data: catalogMatches } = await supabase
                .from("catalog_items")
                .select("id")
                .or(`title.ilike.%${q}%,maker.ilike.%${q}%`)
                .limit(CATALOG_MATCH_CAP);
            const parts = [`custom_name.ilike.%${q}%`, `sculptor.ilike.%${q}%`];
            const catalogIds = ((catalogMatches ?? []) as { id: string }[]).map((r) => r.id);
            if (catalogIds.length > 0) parts.push(`catalog_id.in.(${catalogIds.join(",")})`);
            query = query.or(parts.join(","));
        }
    }

    // Stable ordering: the sort key plus an id tiebreaker, so Show
    // More pages never skip or duplicate rows. Honest sorts only —
    // "most-favorited" was removed (see SHOWRING_SORTS).
    query = query.order("created_at", { ascending: filters.sort === "oldest" });
    query = query.order("id", { ascending: true });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as unknown as Record<string, unknown>[], count: count ?? 0 };
}

/** Enrich a page of horse rows into ShowRingCards (social counts + signed thumbs). */
async function buildShowRingCards(
    supabase: SupabaseClient,
    userId: string,
    rows: Record<string, unknown>[],
): Promise<ShowRingCard[]> {
    if (rows.length === 0) return [];
    const pageIds = rows.map((r) => r.id as string);

    const [allFavsResult, userFavsResult, hoofprintResult] = await Promise.all([
        supabase.from("horse_favorites").select("horse_id").in("horse_id", pageIds),
        supabase
            .from("horse_favorites")
            .select("horse_id")
            .eq("user_id", userId)
            .in("horse_id", pageIds),
        supabase
            .from("v_horse_hoofprint")
            .select("horse_id")
            .in("horse_id", pageIds)
            .eq("is_public", true),
    ]);

    const favCountMap = new Map<string, number>();
    for (const f of (allFavsResult.data ?? []) as { horse_id: string }[]) {
        favCountMap.set(f.horse_id, (favCountMap.get(f.horse_id) || 0) + 1);
    }
    const userFavSet = new Set(
        ((userFavsResult.data ?? []) as { horse_id: string }[]).map((f) => f.horse_id),
    );
    const hoofprintCountMap = new Map<string, number>();
    for (const e of (hoofprintResult.data ?? []) as { horse_id: string | null }[]) {
        if (e.horse_id) hoofprintCountMap.set(e.horse_id, (hoofprintCountMap.get(e.horse_id) || 0) + 1);
    }

    const thumbnailUrls: string[] = [];
    for (const row of rows) {
        const images = (row.horse_images ?? []) as { image_url: string; angle_profile: string }[];
        const thumb = images.find((img) => img.angle_profile === "Primary_Thumbnail");
        const url = thumb?.image_url || images[0]?.image_url;
        if (url) thumbnailUrls.push(url);
    }
    const signedUrlMap = getPublicImageUrls(thumbnailUrls);

    return rows.map((row) => {
        const images = (row.horse_images ?? []) as { image_url: string; angle_profile: string }[];
        const thumb = images.find((img) => img.angle_profile === "Primary_Thumbnail");
        const imageUrl = thumb?.image_url || images[0]?.image_url;
        const catalog = row.catalog_items as { title: string; maker: string; scale: string } | null;
        const owner = row.users as { alias_name: string } | null;
        return {
            id: row.id as string,
            ownerId: row.owner_id as string,
            customName: row.custom_name as string,
            finishType: (row.finish_type as string | null) ?? "OF",
            conditionGrade: (row.condition_grade as string | null) ?? "",
            createdAt: row.created_at as string,
            refName: catalog ? `${catalog.maker} ${catalog.title}` : "Unlisted Mold",
            ownerAlias: owner?.alias_name ?? "Unknown",
            thumbnailUrl: (imageUrl && signedUrlMap.get(imageUrl)) || null,
            sculptor: (row.sculptor as string | null) || null,
            tradeStatus: (row.trade_status as string | null) || "Not for Sale",
            listingPrice: (row.listing_price as number | null) ?? null,
            marketplaceNotes: (row.marketplace_notes as string | null) || null,
            moldName: catalog?.title || null,
            catalogId: (row.catalog_id as string | null) || null,
            favoriteCount: favCountMap.get(row.id as string) || 0,
            isFavorited: userFavSet.has(row.id as string),
            scale: catalog?.scale || null,
            hoofprintCount: hoofprintCountMap.get(row.id as string) || 0,
            assetCategory: (row.asset_category as string | null) || "model",
        };
    });
}

/**
 * Facet dropdown options across ALL public horses (the old build
 * derived them from the loaded 24 — and split maker names into
 * CHARACTERS). Bounded scan, JS-distinct; the FACET_SCAN_CAP note
 * above documents the future get_showring_facets RPC upgrade path.
 */
async function fetchShowRingFacets(supabase: SupabaseClient): Promise<ShowRingFacetOptions> {
    const { data, error } = await supabase
        .from("user_horses")
        .select("finish_type, catalog_items:catalog_id(maker, scale)")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .limit(FACET_SCAN_CAP);

    if (error || !data) return { makers: [], scales: [], finishes: [] };

    const makers = new Set<string>();
    const scales = new Set<string>();
    const finishes = new Set<string>();
    for (const row of data as unknown as {
        finish_type: string | null;
        catalog_items: { maker: string | null; scale: string | null } | null;
    }[]) {
        if (row.finish_type) finishes.add(row.finish_type);
        if (row.catalog_items?.maker) makers.add(row.catalog_items.maker);
        if (row.catalog_items?.scale) scales.add(row.catalog_items.scale);
    }
    return {
        makers: [...makers].sort(),
        scales: [...scales].sort(),
        finishes: [...finishes].sort(),
    };
}

// ══════════════════════════════════════════════════════════════
// Reading the Show Ring
// ══════════════════════════════════════════════════════════════

/**
 * The filtered, sorted first page of public horses plus exact match
 * count and whole-dataset facet options.
 */
export async function getShowRingPage(
    input: z.input<typeof getShowRingPageSchema>,
): Promise<
    ActionResult<{
        cards: ShowRingCard[];
        totalCount: number;
        hasMore: boolean;
        facetOptions: ShowRingFacetOptions;
    }>
> {
    const parsed = getShowRingPageSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { offset, limit, ...filters } = parsed.data;

    try {
        const [{ rows, count }, facetOptions] = await Promise.all([
            queryShowRing(supabase, user.id, filters, offset, limit),
            fetchShowRingFacets(supabase),
        ]);
        const cards = await buildShowRingCards(supabase, user.id, rows);
        return {
            success: true,
            cards,
            totalCount: count,
            hasMore: count > offset + rows.length,
            facetOptions,
        };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Query failed." };
    }
}

/**
 * Append the next page for the "Show More" button — same filters,
 * offset past what's loaded. Runs the SAME queryShowRing core as the
 * first page, so paging can never drift from the page query.
 */
export async function loadMoreShowRing(
    input: z.input<typeof getShowRingPageSchema>,
): Promise<ActionResult<{ cards: ShowRingCard[]; hasMore: boolean }>> {
    const parsed = getShowRingPageSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { offset, limit, ...filters } = parsed.data;

    try {
        const { rows, count } = await queryShowRing(supabase, user.id, filters, offset, limit);
        const cards = await buildShowRingCards(supabase, user.id, rows);
        return { success: true, cards, hasMore: count > offset + rows.length };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Query failed." };
    }
}
