"use server";

/**
 * Digital Stable v2 server actions (NEXT_PUBLIC_STABLE_V2).
 *
 * The dashboard adopts the Show Ring architecture: URL is the single
 * source of truth, ALL filtering happens server-side in the query
 * (never a useMemo over one 48-row page), Show More appends via
 * loadMoreStable.
 *
 * RLS-first: every query runs on the user's client and is additionally
 * owner-scoped with .eq("owner_id", user.id). Each action:
 *   1. zod-parses its input (src/lib/stable/schemas.ts),
 *   2. requireAuth(),
 *   3. returns { success, error? } — never throws for domain errors.
 *
 * getStableSummary / facet options run on the migration-123 RPCs
 * (get_stable_summary / get_stable_facets) — canonical since 123 was
 * applied 2026-07-10; the pre-migration fallbacks were removed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { sanitizeForOr } from "@/lib/utils/search";
import {
    deleteStableViewSchema,
    firstZodError,
    getMatchingHorseIdsSchema,
    getStablePageSchema,
    saveStableViewSchema,
} from "@/lib/stable/schemas";
import type {
    SavedView,
    StableCard,
    StableFacetOptions,
    StableSavedViewRow,
    StableSummary,
    StableSummaryRow,
} from "@/lib/stable/types";

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

const PAGE_SIZE = 48;
/** Max catalog rows matched for the q ilike-over-the-join expansion. */
const CATALOG_MATCH_CAP = 100;
/** Max horse ids in an .in() constraint (collection / has-records). */
const ID_CONSTRAINT_CAP = 1000;
/** "Select all N matching" hard cap. */
const SELECT_ALL_CAP = 500;

type StablePageInput = z.infer<typeof getStablePageSchema>;
type StableFilterInput = z.infer<typeof getMatchingHorseIdsSchema>;

/**
 * Resolve filters that constrain by horse-id set (junction-aware
 * collection membership, has-show-records). Returns null when no id
 * constraint applies, [] when the constraint provably matches nothing.
 */
async function resolveIdConstraint(
    supabase: SupabaseClient,
    userId: string,
    filters: StableFilterInput,
): Promise<string[] | null> {
    let constraint: Set<string> | null = null;

    if (filters.collection) {
        // Dual-source membership: junction table ∪ legacy FK.
        const [junction, legacy] = await Promise.all([
            supabase
                .from("horse_collections")
                .select("horse_id")
                .eq("collection_id", filters.collection)
                .limit(ID_CONSTRAINT_CAP),
            supabase
                .from("user_horses")
                .select("id")
                .eq("owner_id", userId)
                .eq("collection_id", filters.collection)
                .is("deleted_at", null)
                .limit(ID_CONSTRAINT_CAP),
        ]);
        constraint = new Set<string>([
            ...((junction.data ?? []) as { horse_id: string }[]).map((r) => r.horse_id),
            ...((legacy.data ?? []) as { id: string }[]).map((r) => r.id),
        ]);
    }

    if (filters.hasRecords) {
        const { data: records } = await supabase
            .from("show_records")
            .select("horse_id")
            .eq("user_id", userId)
            .limit(5000);
        const recordIds = new Set(((records ?? []) as { horse_id: string }[]).map((r) => r.horse_id));
        constraint = constraint
            ? new Set([...constraint].filter((id) => recordIds.has(id)))
            : recordIds;
    }

    if (constraint === null) return null;
    return [...constraint].slice(0, ID_CONSTRAINT_CAP);
}

/**
 * Build the filtered, sorted, owner-scoped page query. Everything
 * happens in the database — the returned rows ARE the result page.
 */
async function queryStableHorses(
    supabase: SupabaseClient,
    userId: string,
    filters: StableFilterInput,
    offset: number,
    limit: number,
    idOnly = false,
) {
    const idConstraint = await resolveIdConstraint(supabase, userId, filters);
    if (idConstraint !== null && idConstraint.length === 0) {
        return { rows: [], count: 0 };
    }

    // Filtering on the joined catalog columns requires an inner join;
    // otherwise keep the left join so unlisted molds still appear.
    const needsInnerJoin = Boolean(filters.maker || filters.scale);
    const catalogSelect = needsInnerJoin
        ? "catalog_items:catalog_id!inner(title, maker, scale, item_type, parent_id)"
        : "catalog_items:catalog_id(title, maker, scale, item_type, parent_id)";

    const columns = idOnly
        ? `id, ${catalogSelect}`
        : `id, custom_name, finish_type, condition_grade, created_at, collection_id, sculptor, trade_status, asset_category,
           ${catalogSelect},
           horse_images(image_url, angle_profile)`;

    let query = supabase
        .from("user_horses")
        .select(columns, { count: "exact" })
        .eq("owner_id", userId)
        .is("deleted_at", null);

    if (filters.finish) query = query.eq("finish_type", filters.finish);
    if (filters.unlinked) query = query.is("catalog_id", null);
    if (filters.category) query = query.eq("asset_category", filters.category);
    if (filters.trade) query = query.eq("trade_status", filters.trade);
    if (filters.maker) query = query.eq("catalog_items.maker", filters.maker);
    if (filters.scale) query = query.eq("catalog_items.scale", filters.scale);
    if (filters.mold) {
        // One mold, every release: the horses linked to the mold itself
        // plus those linked to any release on it.
        const { data: releases } = await supabase
            .from("catalog_items")
            .select("id")
            .eq("parent_id", filters.mold)
            .limit(CATALOG_MATCH_CAP * 4);
        const ids = [filters.mold, ...((releases ?? []) as { id: string }[]).map((r) => r.id)];
        query = query.in("catalog_id", ids);
    }
    if (idConstraint) query = query.in("id", idConstraint);

    if (filters.q) {
        const q = sanitizeForOr(filters.q);
        if (q) {
            // The whole-collection search: custom name + sculptor on the
            // base table, catalog title/maker via a bounded id expansion
            // (PostgREST .or() can't mix base and embedded columns).
            const { data: catalogMatches } = await supabase
                .from("catalog_items")
                .select("id, item_type")
                .or(`title.ilike.%${q}%,maker.ilike.%${q}%`)
                .limit(CATALOG_MATCH_CAP);
            const parts = [`custom_name.ilike.%${q}%`, `sculptor.ilike.%${q}%`];
            const matched = (catalogMatches ?? []) as { id: string; item_type: string | null }[];
            const catalogIds = matched.map((r) => r.id);
            // A mold's name must find the horses linked to its releases:
            // "Stock Horse Stallion" is what she types, "Smoky" is the link.
            const moldIds = matched.filter((r) => r.item_type === "plastic_mold").map((r) => r.id);
            if (moldIds.length > 0) {
                const { data: releases } = await supabase
                    .from("catalog_items")
                    .select("id")
                    .in("parent_id", moldIds)
                    .limit(CATALOG_MATCH_CAP * 4);
                for (const r of (releases ?? []) as { id: string }[]) catalogIds.push(r.id);
            }
            if (catalogIds.length > 0) parts.push(`catalog_id.in.(${catalogIds.join(",")})`);
            query = query.or(parts.join(","));
        }
    }

    // Stable ordering: the sort key plus an id tiebreaker, so Show More
    // pages never skip or duplicate rows.
    switch (filters.sort) {
        case "oldest":
            query = query.order("created_at", { ascending: true });
            break;
        case "name-az":
            query = query.order("custom_name", { ascending: true });
            break;
        case "name-za":
            query = query.order("custom_name", { ascending: false });
            break;
        default:
            query = query.order("created_at", { ascending: false });
    }
    query = query.order("id", { ascending: true });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as unknown as Record<string, unknown>[], count: count ?? 0 };
}

/** Enrich a page of horse rows into the shared StableCard shape. */
async function buildCards(
    supabase: SupabaseClient,
    userId: string,
    rows: Record<string, unknown>[],
): Promise<StableCard[]> {
    if (rows.length === 0) return [];
    const pageIds = rows.map((r) => r.id as string);

    const [vaultResult, recordsResult, collectionsResult] = await Promise.all([
        supabase
            .from("financial_vault")
            .select("horse_id, purchase_price, estimated_current_value")
            .in("horse_id", pageIds),
        supabase.from("show_records").select("horse_id").eq("user_id", userId).in("horse_id", pageIds),
        supabase.from("user_collections").select("id, name").eq("user_id", userId),
    ]);

    const vaultMap = new Map<string, number>();
    for (const v of (vaultResult.data ?? []) as {
        horse_id: string;
        purchase_price: number | null;
        estimated_current_value: number | null;
    }[]) {
        const val = v.estimated_current_value ?? v.purchase_price ?? 0;
        if (val > 0) vaultMap.set(v.horse_id, val);
    }

    const recordCountMap = new Map<string, number>();
    for (const r of (recordsResult.data ?? []) as { horse_id: string }[]) {
        recordCountMap.set(r.horse_id, (recordCountMap.get(r.horse_id) || 0) + 1);
    }

    const collectionNameMap = new Map<string, string>();
    for (const c of (collectionsResult.data ?? []) as { id: string; name: string }[]) {
        collectionNameMap.set(c.id, c.name);
    }

    const thumbnailUrls: string[] = [];
    for (const row of rows) {
        const images = (row.horse_images ?? []) as { image_url: string; angle_profile: string }[];
        const thumb = images.find((img) => img.angle_profile === "Primary_Thumbnail");
        const url = thumb?.image_url || images[0]?.image_url;
        if (url) thumbnailUrls.push(url);
    }
    const signedUrlMap = getPublicImageUrls(thumbnailUrls);

    // A release's card names its mold too, so one mold across four
    // releases reads as one family instead of four strangers.
    const parentIds = [
        ...new Set(
            rows
                .map((r) => (r.catalog_items as { parent_id?: string | null } | null)?.parent_id ?? null)
                .filter((id): id is string => !!id),
        ),
    ];
    const parentTitle = new Map<string, string>();
    if (parentIds.length > 0) {
        const { data: parents } = await supabase.from("catalog_items").select("id, title").in("id", parentIds);
        for (const p of (parents ?? []) as { id: string; title: string }[]) parentTitle.set(p.id, p.title);
    }

    return rows.map((row) => {
        const images = (row.horse_images ?? []) as { image_url: string; angle_profile: string }[];
        const thumb = images.find((img) => img.angle_profile === "Primary_Thumbnail");
        const imageUrl = thumb?.image_url || images[0]?.image_url;
        const catalog = row.catalog_items as
            | { title: string; maker: string; item_type?: string | null; parent_id?: string | null }
            | null;
        const moldName = catalog
            ? catalog.parent_id
                ? (parentTitle.get(catalog.parent_id) ?? null)
                : catalog.item_type === "plastic_mold"
                  ? catalog.title
                  : null
            : null;
        const releaseName = catalog && catalog.parent_id && moldName ? catalog.title : null;
        const collectionId = row.collection_id as string | null;
        return {
            id: row.id as string,
            customName: row.custom_name as string,
            finishType: (row.finish_type as string | null) ?? "OF",
            conditionGrade: (row.condition_grade as string | null) ?? "",
            createdAt: row.created_at as string,
            refName: catalog
                ? releaseName
                    ? `${catalog.maker} ${moldName} · ${releaseName}`
                    : `${catalog.maker} ${catalog.title}`
                : "Unlisted Mold",
            thumbnailUrl: (imageUrl && signedUrlMap.get(imageUrl)) || null,
            collectionName: collectionId ? collectionNameMap.get(collectionId) || null : null,
            sculptor: (row.sculptor as string | null) || null,
            tradeStatus: (row.trade_status as string | null) || "Not for Sale",
            assetCategory: (row.asset_category as string | null) || "model",
            vaultValue: vaultMap.get(row.id as string) ?? null,
            showRecordCount: recordCountMap.get(row.id as string) || 0,
            moldName: moldName ?? catalog?.title ?? null,
            releaseName,
        };
    });
}

/**
 * Facet dropdown options across the owner's WHOLE collection (not the
 * loaded page). Prefers the get_stable_facets RPC; bounded JS-distinct
 * fallback until migration 123 is applied.
 */
/** Rows of catalog_id scanned for the mold facet; a stable past this is still filterable, just unfaceted. */
const MOLD_FACET_SCAN = 2000;

type CatalogFamilyRow = { id: string; title: string; maker: string; item_type: string | null; parent_id: string | null };

async function fetchCatalogRows(supabase: SupabaseClient, ids: string[]): Promise<CatalogFamilyRow[]> {
    const out: CatalogFamilyRow[] = [];
    for (let i = 0; i < ids.length; i += 150) {
        const { data } = await supabase
            .from("catalog_items")
            .select("id, title, maker, item_type, parent_id")
            .in("id", ids.slice(i, i + 150));
        out.push(...((data ?? []) as CatalogFamilyRow[]));
    }
    return out;
}

/**
 * The Mold facet: every mold with two or more of the owner's horses on
 * it, with releases folded into their mold. Built here rather than in
 * the facets RPC because the fold needs the parent walk. Best effort —
 * a failure leaves the dropdown empty and nothing else changes.
 */
async function fetchMoldFacet(supabase: SupabaseClient, userId: string): Promise<StableFacetOptions["molds"]> {
    try {
        const { data: rows } = await supabase
            .from("user_horses")
            .select("catalog_id")
            .eq("owner_id", userId)
            .is("deleted_at", null)
            .limit(MOLD_FACET_SCAN);
        const counts = new Map<string, number>();
        for (const r of (rows ?? []) as { catalog_id: string | null }[]) {
            if (r.catalog_id) counts.set(r.catalog_id, (counts.get(r.catalog_id) ?? 0) + 1);
        }
        if (counts.size === 0) return [];

        const items = await fetchCatalogRows(supabase, [...counts.keys()]);
        const families = new Map<string, { count: number; label: string | null }>();
        for (const it of items) {
            const key = it.parent_id ?? (it.item_type === "plastic_mold" ? it.id : null);
            if (!key) continue; // resins, tack and props have no mold family
            const entry = families.get(key) ?? { count: 0, label: null };
            entry.count += counts.get(it.id) ?? 0;
            if (!it.parent_id) entry.label = `${it.maker} ${it.title}`;
            families.set(key, entry);
        }
        const unnamed = [...families.entries()].filter(([, e]) => !e.label).map(([id]) => id);
        if (unnamed.length > 0) {
            for (const p of await fetchCatalogRows(supabase, unnamed)) {
                const entry = families.get(p.id);
                if (entry) entry.label = `${p.maker} ${p.title}`;
            }
        }
        return [...families.entries()]
            .filter((pair): pair is [string, { count: number; label: string }] => pair[1].count >= 2 && !!pair[1].label)
            .map(([id, e]) => ({ id, label: e.label, count: e.count }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
            .slice(0, 60);
    } catch {
        return [];
    }
}

async function fetchFacetOptions(
    supabase: SupabaseClient,
    userId: string,
): Promise<StableFacetOptions> {
    const [{ data, error }, molds] = await Promise.all([
        supabase.rpc("get_stable_facets", { p_owner: userId }),
        fetchMoldFacet(supabase, userId),
    ]);
    if (!error && data) {
        const f = data as Partial<StableFacetOptions>;
        // Radix Select forbids empty-string item values — one "" here
        // (a catalog row with maker '' slipping through the RPC's
        // NULL-only guard) crashed /dashboard for the member who owned
        // a horse linked to it. Facet values are dropdown options; ""
        // is never one.
        const clean = (a?: string[]) =>
            (a ?? []).filter((s) => typeof s === "string" && s.trim() !== "");
        return {
            makers: clean(f.makers),
            scales: clean(f.scales),
            finishes: clean(f.finishes),
            categories: clean(f.categories),
            molds,
        };
    }

    // Migration 123 is applied — the RPC is canonical. An error here is
    // a real fault; degrade to empty facet lists (filters still work,
    // the dropdowns are just unpopulated) rather than an unbounded scan.
    return { makers: [], scales: [], finishes: [], categories: [], molds };
}

// ══════════════════════════════════════════════════════════════
// Reading the stable
// ══════════════════════════════════════════════════════════════

/**
 * The filtered, sorted first page of the owner's stable plus total
 * match count and whole-collection facet options.
 */
export async function getStablePage(
    input: z.input<typeof getStablePageSchema>,
): Promise<
    ActionResult<{
        cards: StableCard[];
        totalCount: number;
        hasMore: boolean;
        facetOptions: StableFacetOptions;
    }>
> {
    const parsed = getStablePageSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { offset, limit, ...filters } = parsed.data;

    try {
        const [{ rows, count }, facetOptions] = await Promise.all([
            queryStableHorses(supabase, user.id, filters, offset, limit),
            fetchFacetOptions(supabase, user.id),
        ]);
        const cards = await buildCards(supabase, user.id, rows);
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
 * offset past what's loaded (loadMoreShowRing pattern).
 */
export async function loadMoreStable(
    input: z.input<typeof getStablePageSchema>,
): Promise<ActionResult<{ cards: StableCard[]; hasMore: boolean }>> {
    const parsed = getStablePageSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { offset, limit, ...filters } = parsed.data;

    try {
        const { rows, count } = await queryStableHorses(supabase, user.id, filters, offset, limit);
        const cards = await buildCards(supabase, user.id, rows);
        return { success: true, cards, hasMore: count > offset + rows.length };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Query failed." };
    }
}

/**
 * "Select all N matching" — every horse id matching the current
 * filters, capped at SELECT_ALL_CAP (the UI shows an over-cap notice).
 */
export async function getMatchingHorseIds(
    input: z.input<typeof getMatchingHorseIdsSchema>,
): Promise<ActionResult<{ ids: string[]; totalMatching: number; capped: boolean }>> {
    const parsed = getMatchingHorseIdsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();

    try {
        const { rows, count } = await queryStableHorses(
            supabase,
            user.id,
            parsed.data,
            0,
            SELECT_ALL_CAP,
            true,
        );
        return {
            success: true,
            ids: rows.map((r) => r.id as string),
            totalMatching: count,
            capped: count > SELECT_ALL_CAP,
        };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Query failed." };
    }
}

/**
 * Sidebar aggregates in ONE round-trip via get_stable_summary —
 * replacing the dashboard's three unbounded owner-wide fetches
 * (all-horses summary + vault + junction) and their JS merge.
 * Falls back to that legacy merge until migration 123 is applied.
 */
export async function getStableSummary(): Promise<ActionResult<{ summary: StableSummary }>> {
    const { supabase, user } = await requireAuth();

    const { data, error } = await supabase.rpc("get_stable_summary", { p_owner: user.id });
    if (!error && data) {
        const row = (Array.isArray(data) ? data[0] : data) as StableSummaryRow | undefined;
        if (row) {
            return {
                success: true,
                summary: {
                    totalHorses: row.total_horses ?? 0,
                    vaultTotal: Number(row.vault_total ?? 0),
                    forSaleCount: row.for_sale_count ?? 0,
                    collections: row.collections ?? [],
                },
            };
        }
    }

    // Migration 123 is applied — the RPC is canonical; surface failures.
    return {
        success: false,
        error: error?.message ?? "Stable summary unavailable.",
    };
}

// ══════════════════════════════════════════════════════════════
// Saved views
// ══════════════════════════════════════════════════════════════

function toSavedView(row: StableSavedViewRow): SavedView {
    return { id: row.id, name: row.name, params: row.params ?? {}, createdAt: row.created_at };
}

export async function listStableViews(): Promise<ActionResult<{ views: SavedView[] }>> {
    const { supabase, user } = await requireAuth();
    const { data, error } = await supabase
        .from("stable_saved_views")
        .select("id, user_id, name, params, created_at")
        .eq("user_id", user.id)
        .order("name");
    if (error) return { success: false, error: error.message };
    return { success: true, views: ((data ?? []) as StableSavedViewRow[]).map(toSavedView) };
}

/** Save (or overwrite, by name) the current filter params as a view. */
export async function saveStableView(
    input: z.input<typeof saveStableViewSchema>,
): Promise<ActionResult<{ view: SavedView }>> {
    const parsed = saveStableViewSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { name, params } = parsed.data;

    const { data, error } = await supabase
        .from("stable_saved_views")
        .upsert(
            { user_id: user.id, name, params },
            { onConflict: "user_id,name" },
        )
        .select("id, user_id, name, params, created_at")
        .single();
    if (error || !data) return { success: false, error: error?.message ?? "Failed to save view." };

    revalidatePath("/dashboard");
    return { success: true, view: toSavedView(data as StableSavedViewRow) };
}

export async function deleteStableView(
    input: z.input<typeof deleteStableViewSchema>,
): Promise<ActionResult> {
    const parsed = deleteStableViewSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();

    const { error } = await supabase
        .from("stable_saved_views")
        .delete()
        .eq("id", parsed.data.id)
        .eq("user_id", user.id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true };
}
