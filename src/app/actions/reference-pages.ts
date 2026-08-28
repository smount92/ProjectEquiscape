import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { getPublicImageUrls } from "@/lib/utils/storage";

// ============================================================
// REFERENCE PAGES (MOVE 1 / Batch I) — public catalog release data
// ============================================================
// Anon-safe reads (public horses via RLS + anon-granted RPCs), aggregate only.
// Uses a COOKIE-LESS anon client, and every read is wrapped in unstable_cache
// (revalidate 3600). The global authenticated <Header> forces pages dynamic
// app-wide, so page-level ISR can't apply — but this data cache means a
// Googlebot crawl of ~11k pages hits the DB at most once per page per hour
// instead of on every request. Server-only module (not a "use server" action).
// ============================================================

const REVALIDATE = 3600;

/**
 * Cache tag on every reference-page read below. Approving a catalog
 * suggestion calls revalidateTag(REFERENCE_PAGES_CACHE_TAG, "max")
 * (catalog-suggestions.ts) so corrections show up immediately instead of
 * after the hour-long revalidate window. One coarse tag on purpose:
 * approvals are rare, correctness beats cache-partition finesse.
 */
export const REFERENCE_PAGES_CACHE_TAG = "reference-pages";

export interface CatalogRow {
    id: string;
    item_type: string;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    attributes: Record<string, unknown> | null;
    /** Attribution split (migration 156) — corrected values win over derivation. */
    artist: string | null;
    manufacturer: string | null;
}

export const resolveReferenceItem = unstable_cache(
    async (makerSlug: string, slug: string): Promise<CatalogRow | null> => {
        const supabase = createAnonClient();
        const { data } = await supabase
            .from("catalog_items")
            .select("id, item_type, title, maker, maker_slug, slug, scale, attributes, artist, manufacturer")
            .eq("maker_slug", makerSlug)
            .eq("slug", slug)
            .maybeSingle();
        return (data as CatalogRow | null) ?? null;
    },
    ["reference:item"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

export interface ReferenceListing {
    id: string;
    name: string;
    tradeStatus: string;
    price: number | null;
    notes: string | null;
    thumbnailUrl: string | null;
    ownerAlias: string;
}

/**
 * Active for-sale listings of a catalog model, cheapest first, via the anon-safe
 * get_catalog_listings RPC (migration 132) so the seller alias renders for anon.
 * Text-only (no thumbnail), so the photo opt-out doesn't affect listings.
 */
export const getActiveListingsForCatalog = unstable_cache(
    async (catalogId: string, limit = 12): Promise<ReferenceListing[]> => {
        const supabase = createAnonClient();
        const { data } = await supabase.rpc("get_catalog_listings", {
            p_catalog_id: catalogId,
            p_limit: limit,
        });
        const rows = (data ?? []) as {
            horse_id: string;
            custom_name: string | null;
            trade_status: string | null;
            listing_price: number | null;
            marketplace_notes: string | null;
            owner_alias: string | null;
        }[];
        return rows.map((r) => ({
            id: r.horse_id,
            name: r.custom_name ?? "Unnamed",
            tradeStatus: r.trade_status ?? "",
            price: r.listing_price != null ? Number(r.listing_price) : null,
            notes: r.marketplace_notes,
            thumbnailUrl: null,
            ownerAlias: r.owner_alias ?? "",
        }));
    },
    ["reference:listings"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

export interface ReferencePhoto {
    url: string;
    /** The owning collector's name for their horse — distinguishes finishes on a mold. */
    name: string;
    /** The owner's public horse id — links the photo to its passport (/community/[id]). */
    horseId: string;
}

/**
 * Representative photos of a catalog model from any public owner (the catalog
 * table stores no images). Each photo carries the owner's horse name so a mold
 * page can label its varied finishes. Honors the show_photos_on_reference
 * opt-out (migration 131) via a SECURITY DEFINER RPC.
 */
export const getCatalogPhotos = unstable_cache(
    async (catalogId: string, limit = 8): Promise<ReferencePhoto[]> => {
        const supabase = createAnonClient();
        const { data } = await supabase.rpc("get_catalog_reference_photos", {
            p_catalog_id: catalogId,
            p_limit: limit,
        });
        const rows = (data ?? []) as unknown as {
            horse_id: string;
            image_url: string | null;
            horse_name: string | null;
        }[];
        const withPhoto = rows.filter((r) => r.image_url) as {
            horse_id: string;
            image_url: string;
            horse_name: string | null;
        }[];
        const urlMap = getPublicImageUrls(withPhoto.map((r) => r.image_url));
        return withPhoto.map((r) => ({
            url: urlMap.get(r.image_url) ?? r.image_url,
            name: r.horse_name ?? "",
            horseId: r.horse_id,
        }));
    },
    ["reference:photos-v2"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

export interface ChildRelease {
    id: string;
    title: string;
    makerSlug: string | null;
    slug: string | null;
    color: string | null;
}

/**
 * Releases catalogued on a given mold (mold→versions). Empty for molds with no
 * discrete releases (e.g. Peter Stone one-of-a-kinds).
 */
export const getChildReleases = unstable_cache(
    async (moldId: string, limit = 60): Promise<ChildRelease[]> => {
        const supabase = createAnonClient();
        const { data } = await supabase
            .from("catalog_items")
            .select("id, title, maker_slug, slug, attributes")
            .eq("parent_id", moldId)
            .eq("item_type", "plastic_release")
            .order("title")
            .limit(limit);
        const rows = (data ?? []) as unknown as {
            id: string;
            title: string;
            maker_slug: string | null;
            slug: string | null;
            attributes: Record<string, unknown> | null;
        }[];
        return rows.map((r) => ({
            id: r.id,
            title: r.title,
            makerSlug: r.maker_slug,
            slug: r.slug,
            color: (r.attributes?.color_description as string) ?? null,
        }));
    },
    ["reference:child-releases"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

/**
 * "N collectors have this" + "N want this" aggregate counts (migration 130).
 */
export const getCatalogCounts = unstable_cache(
    async (catalogId: string): Promise<{ collectors: number; wanters: number }> => {
        const supabase = createAnonClient();
        const [collectorsRes, wantersRes] = await Promise.all([
            supabase.rpc("count_catalog_collectors", { p_catalog_id: catalogId }),
            supabase.rpc("count_catalog_wanters", { p_catalog_id: catalogId }),
        ]);
        return {
            collectors: Number(collectorsRes.data ?? 0),
            wanters: Number(wantersRes.data ?? 0),
        };
    },
    ["reference:counts"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

export interface ReferenceMarket {
    medianPrice: number;
    lowestPrice: number;
    highestPrice: number;
    transactionVolume: number;
}

/**
 * Blue Book aggregate for the reference teaser via the anon-safe get_market_rows
 * RPC (migration 126). Mirrors getMarketPrice's "first row" behavior.
 */
export const getReferenceMarket = unstable_cache(
    async (catalogId: string): Promise<ReferenceMarket | null> => {
        const supabase = createAnonClient();
        const { data } = await supabase.rpc("get_market_rows", { p_catalog_id: catalogId });
        const row = (data as Record<string, unknown>[] | null)?.[0];
        if (!row) return null;
        return {
            medianPrice: Number(row.median_price) || 0,
            lowestPrice: Number(row.lowest_price) || 0,
            highestPrice: Number(row.highest_price) || 0,
            transactionVolume: Number(row.transaction_volume) || 0,
        };
    },
    ["reference:market"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

export interface MarketHistoryPoint {
    date: string;
    price: number;
    finishType: string;
}

/**
 * Per-item completed-sale points for the Blue Book PRO chart via the
 * anon-safe get_market_history RPC (migration 152 — dates/prices/finish
 * only, no transaction ids or parties). Same cache posture as the
 * aggregate above.
 */
export const getReferenceMarketHistory = unstable_cache(
    async (catalogId: string): Promise<MarketHistoryPoint[]> => {
        const supabase = createAnonClient();
        const { data } = await supabase.rpc("get_market_history", { p_catalog_id: catalogId });
        return ((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
            date: String(row.sale_date),
            price: Number(row.price) || 0,
            finishType: String(row.finish_type ?? "OF"),
        }));
    },
    ["reference:market-history"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

// ── The Ledger: mold timeline ────────────────────────────────────

import {
    buildArtistCareer,
    buildMoldTimeline,
    type ArtistCareer,
    type MoldTimeline,
} from "@/lib/catalog/timeline";

export interface MoldTimelineData {
    timeline: MoldTimeline;
    /** catalog id → live asking median (flag-aware). Plain object — this
     *  return passes through unstable_cache serialization. */
    medians: Record<string, number>;
    /** catalog id → community photo thumbnail URL. */
    thumbs: Record<string, string>;
}

/**
 * Everything the Ledger needs for one mold: ALL child releases (the old
 * releases grid capped at 60 and sorted alphabetically — a timeline
 * cannot), their price signals, and community thumbs. Shaped by the
 * pure builder in lib/catalog/timeline.
 */
export const getMoldTimelineData = unstable_cache(
    async (moldId: string): Promise<MoldTimelineData> => {
        const supabase = createAnonClient();
        const rows: {
            id: string;
            title: string;
            maker_slug: string | null;
            slug: string | null;
            attributes: Record<string, unknown> | null;
        }[] = [];
        // Paginated: PostgREST caps one request at 1,000 rows, and this
        // codebase has been bitten by that cap five separate times.
        for (let from = 0; from < 5000; from += 1000) {
            const { data } = await supabase
                .from("catalog_items")
                .select("id, title, maker_slug, slug, attributes")
                .eq("parent_id", moldId)
                .eq("item_type", "plastic_release")
                .range(from, from + 999);
            const page = (data ?? []) as unknown as typeof rows;
            rows.push(...page);
            if (page.length < 1000) break;
        }

        const timeline = buildMoldTimeline(
            rows.map((r) => ({
                id: r.id,
                title: r.title,
                makerSlug: r.maker_slug,
                slug: r.slug,
                attributes: r.attributes,
            })),
        );

        const ids = rows.map((r) => r.id);
        const medians: Record<string, number> = {};
        const thumbs: Record<string, string> = {};
        if (ids.length > 0) {
            try {
                const sig = supabase as unknown as {
                    from: (t: string) => {
                        select: (c: string) => {
                            in: (k: string, v: string[]) => PromiseLike<{ data: Record<string, unknown>[] | null }> & {
                                eq: (k2: string, v2: string) => PromiseLike<{ data: Record<string, unknown>[] | null }>;
                            };
                        };
                    };
                };
                const [{ data: sigs }, { data: flags }] = await Promise.all([
                    sig.from("catalog_price_signals").select("catalog_item_id, asking_median").in("catalog_item_id", ids),
                    sig.from("catalog_price_signal_flags").select("catalog_item_id").in("catalog_item_id", ids).eq("status", "active"),
                ]);
                const flagged = new Set((flags ?? []).map((f) => String(f.catalog_item_id)));
                for (const s of sigs ?? []) {
                    const id = String(s.catalog_item_id);
                    if (!flagged.has(id)) medians[id] = Number(s.asking_median);
                }
            } catch {
                /* pre-189/196 — no chips */
            }
            try {
                const rpc = supabase.rpc.bind(supabase) as unknown as (
                    fn: string,
                    args: { p_ids: string[] },
                ) => Promise<{ data: { catalog_id: string; image_url: string }[] | null }>;
                const { data: t } = await rpc("get_catalog_browse_thumbs", { p_ids: ids });
                for (const row of t ?? []) if (row.image_url) thumbs[row.catalog_id] = row.image_url;
            } catch {
                /* RPC absent — no thumbs */
            }
        }

        return { timeline, medians, thumbs };
    },
    ["reference:mold-timeline"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);

// ── The Braid: artist career ─────────────────────────────────────

export interface ArtistMeta {
    studioName: string | null;
    disciplines: string[];
    activeFrom: number | null;
    activeTo: number | null;
    website: string | null;
    registryNotes: string | null;
}

export interface ArtistCareerData {
    career: ArtistCareer;
    /** False for manufacturers (Breyer has molds of its own) — the
     *  career section renders only for artists. */
    isArtist: boolean;
    /** Curated facts from the artists table (200); null pre-migration
     *  or for artists nobody has written up yet. */
    meta: ArtistMeta | null;
}

/**
 * An artist's two-stream body of work: everything released under their
 * own name, plus factory pieces whose sculptor credit names them.
 * A maker who owns plastic molds/releases is a manufacturer, not an
 * artist — Breyer gets no braid.
 */
export const getArtistCareerData = unstable_cache(
    async (makerName: string): Promise<ArtistCareerData> => {
        const supabase = createAnonClient();
        const own: {
            id: string; title: string; maker_slug: string | null; slug: string | null;
            item_type: string; scale: string | null; attributes: Record<string, unknown> | null;
        }[] = [];
        for (let from = 0; from < 5000; from += 1000) {
            const { data } = await supabase
                .from("catalog_items")
                .select("id, title, maker_slug, slug, item_type, scale, attributes")
                .eq("maker", makerName)
                .range(from, from + 999);
            const page = (data ?? []) as unknown as typeof own;
            own.push(...page);
            if (page.length < 1000) break;
        }

        const isArtist =
            own.length > 0 &&
            !own.some((r) => r.item_type === "plastic_mold" || r.item_type === "plastic_release");

        const { data: fac } = await supabase
            .from("catalog_items")
            .select("id, title, maker, maker_slug, slug, item_type, scale, attributes")
            .ilike("attributes->>sculptor", `%${makerName}%`)
            .neq("maker", makerName)
            .limit(500);
        const factory = ((fac ?? []) as unknown as {
            id: string; title: string; maker: string; maker_slug: string | null; slug: string | null;
            item_type: string; scale: string | null; attributes: Record<string, unknown> | null;
        }[]);

        // Curated facts (200). Tolerant: pre-migration the table is
        // missing and the stat block shows computed facts only.
        let meta: ArtistMeta | null = null;
        try {
            const { data: a } = await (supabase as unknown as {
                from: (t: string) => {
                    select: (c: string) => {
                        eq: (k: string, v: string) => {
                            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
                        };
                    };
                };
            })
                .from("artists")
                .select("studio_name, disciplines, active_from, active_to, website, registry_notes")
                .eq("name", makerName)
                .maybeSingle();
            if (a) {
                meta = {
                    studioName: (a.studio_name as string | null) ?? null,
                    disciplines: Array.isArray(a.disciplines) ? (a.disciplines as string[]) : [],
                    activeFrom: typeof a.active_from === "number" ? a.active_from : null,
                    activeTo: typeof a.active_to === "number" ? a.active_to : null,
                    website: (a.website as string | null) ?? null,
                    registryNotes: (a.registry_notes as string | null) ?? null,
                };
            }
        } catch {
            /* pre-200 */
        }

        const career = buildArtistCareer(
            own.map((r) => ({
                id: r.id, title: r.title, makerSlug: r.maker_slug, slug: r.slug,
                attributes: r.attributes, itemType: r.item_type, scale: r.scale,
            })),
            factory.map((r) => ({
                id: r.id, title: r.title, makerSlug: r.maker_slug, slug: r.slug,
                attributes: r.attributes, itemType: r.item_type, scale: r.scale, maker: r.maker,
            })),
        );

        return { career, isArtist, meta };
    },
    ["reference:artist-career"],
    { revalidate: REVALIDATE, tags: [REFERENCE_PAGES_CACHE_TAG] },
);
