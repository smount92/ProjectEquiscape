"use server";

import { AuthError, requireAuth, requireRegistryModerator } from "@/lib/auth";
import { readRegistryTerm, searchRegistry } from "@/lib/catalog/registrySearch";
import { applyTitleNumberRule } from "@/lib/catalog/titleNumber";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sanitizeText } from "@/lib/utils/validation";
import { sanitizeForOr } from "@/lib/utils/search";
import { curatorAutoApprovable, vocabularyProblem } from "@/lib/catalog/corrections";
import { suggestionItemTypeToDb, ARTIST_ATTRIBUTED_CATEGORIES } from "@/lib/catalog/taxonomy";
import {
    DUPLICATE_MIGRATION_NOTICE,
    DUPLICATE_SUGGESTION_TYPE,
    duplicateReportRefusal,
    duplicateTarget,
    isMissingDuplicateType,
} from "@/lib/catalog/duplicates";
import {
    applySuggestion,
    decideSuggestion,
    findExistingMold,
    existingMoldMessage,
    withdrawApproval,
} from "@/lib/catalog/suggestionApply";
import { revertFields } from "@/lib/catalog/write";
import { alertOwner, anyActiveModerator } from "@/lib/registry/alerts";
import { actorOf } from "@/lib/registry/types";
import { statusFilterValues } from "@/lib/catalog/suggestionStatus";
import type { Json } from "@/lib/types/database.generated";

// ── Type definitions ──

interface CatalogFilters {
    search?: string;
    maker?: string;
    /** Attribution split (156). */
    manufacturer?: string;
    artist?: string;
    scale?: string;
    type?: string;
    category?: string;
    // Advanced (attributes JSONB) filters
    yearFrom?: number;
    yearTo?: number;
    color?: string;
    model?: string;
    medium?: string;
    material?: string;
    runType?: string;
    /** Only models carrying a live eBay asking-price signal. */
    priced?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
}

interface SuggestionInput {
    catalogItemId?: string | null; // null = new entry
    /** "duplicate": filed FROM the entry to remove; field_changes.duplicate_of
     *  names the entry to keep (lib/catalog/duplicates). */
    suggestionType: "correction" | "addition" | "removal" | "photo" | "duplicate";
    fieldChanges: Record<string, unknown>;
    reason: string;
    /** Addition flow: the submitter saw the duplicate candidates and
     * confirmed this really is a new entry (North Light lesson: the
     * same 20 sculpts were suggested twice under different makers). */
    confirmDuplicates?: boolean;
}

/** Candidate shown in the "did you mean…" duplicate warning. */
export interface DuplicateCandidate {
    id: string;
    title: string;
    maker: string | null;
    item_type: string;
}

interface ReviewDecision {
    suggestionId: string;
    decision: "approved" | "rejected";
    adminNotes?: string;
}

export interface CatalogSuggestion {
    id: string;
    user_id: string;
    catalog_item_id: string | null;
    suggestion_type: string;
    field_changes: Record<string, unknown>;
    reason: string;
    status: string;
    admin_notes: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    upvotes: number;
    downvotes: number;
    created_at: string;
    updated_at: string;
}

export interface CatalogChangelogEntry {
    id: string;
    suggestion_id: string | null;
    catalog_item_id: string | null;
    change_type: string;
    change_summary: string;
    contributed_by: string | null;
    contributor_alias: string;
    approved_by: string | null;
    created_at: string;
}

export interface SuggestionComment {
    id: string;
    suggestion_id: string;
    user_id: string;
    user_alias: string;
    body: string;
    created_at: string;
}

// ── BROWSING (public — no auth required) ──

/**
 * How many fuzzy candidates a text search feeds into the facet/sort
 * query. Similarity-ranked, so every realistic name/maker search fits;
 * ~200 UUIDs also keeps the PostgREST `.in()` URL well under limits.
 */
const FUZZY_CANDIDATE_LIMIT = 200;

/**
 * The column a name sort actually files by. `title` is what a member
 * reads; `sort_key` (migration 188) is where it belongs on the shelf —
 * leading punctuation dropped, accented initials folded to their base
 * letter, non-letter titles pushed to the back.
 */
const CATALOG_NAME_SORT_COLUMN = "sort_key";

/** True when the failure is only that migration 188 has not been pasted yet. */
function isMissingSortKey(error: { code?: string; message?: string }): boolean {
    return error.code === "42703" || Boolean(error.message && error.message.includes(CATALOG_NAME_SORT_COLUMN));
}

export async function getCatalogItems(filters: CatalogFilters) {
    const supabase = await createClient();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const from = (page - 1) * pageSize;

    // ── Text search composition: fuzzy-FIRST, then filter the ids ──
    // search_catalog_fuzzy (migration 110: trigram title + maker ILIKE,
    // anon-granted — the same RPC the reference search uses) takes no
    // facet filters, no count, no pagination, so it cannot compose with
    // the facet query directly. Instead the RPC returns the best-matching
    // candidate ids (similarity-ranked, capped) and the regular query
    // below applies facets, sort, exact count, and pagination over that
    // id set — the whole existing filter/facet/pagination contract is
    // preserved. Trade-offs: results within a search sort by the chosen
    // catalog sort (not raw similarity), and a text query is capped at
    // FUZZY_CANDIDATE_LIMIT candidates — broad sweeps like a bare maker
    // name belong in the (uncapped) Maker facet.
    // "Breyer Adios" / "Stone ISH": a leading maker becomes the maker
    // facet (unless one is already chosen) and the initials are spelled
    // out, so the text search runs on the name alone.
    // "G1 Arabian Stallion" / "SM Arabian Stallion" search for the mold's
    // own name; a named mold brings its releases; sets that only list the
    // name come last. All of that is the shared Registry search
    // (lib/catalog/registrySearch), which the duplicate picker, the old
    // picker and the wishlist search use too (MHH-076).
    const read = filters.search?.trim() ? readRegistryTerm(filters.search) : null;
    const searchTerm = read?.term || undefined;
    const makerFacet = filters.maker ?? read?.maker ?? undefined;

    let searchIds: string[] | null = null;
    let rosterIds = new Set<string>();
    if (searchTerm && filters.search) {
        const found = await searchRegistry(supabase, filters.search, {
            scale: filters.scale,
            candidates: FUZZY_CANDIDATE_LIMIT,
        });
        if (found) {
            searchIds = found.rows.map((r) => r.id);
            rosterIds = found.rosterIds;
            if (searchIds.length === 0) {
                return { success: true as const, items: [], total: 0, page, pageSize };
            }
        }
        // RPC unavailable (fresh env, migration pending)? searchIds stays
        // null and the title/maker ILIKE fallback below keeps search alive.
    }

    // The eBay-priced filter takes two shapes on purpose:
    //  - ALONE it is an inner join to the signals table. The priced set
    //    is hundreds of rows, and shipping that many UUIDs through a
    //    .in() URL is exactly the silent-empty failure the first version
    //    had: PostgREST rejected the oversized URL, the tolerant catch
    //    swallowed it, and the filter reported zero with 567 signals live.
    //  - WITH a text search the candidate set is already capped at
    //    FUZZY_CANDIDATE_LIMIT ids, so intersecting id-sets stays cheap
    //    and inside URL limits.
    // Flag-aware both ways — a signal a member has reported as wrongly
    // matched does not count as "priced". Tolerant of migrations 189/196
    // being absent: the filter matches nothing rather than erroring.
    let pricedJoin = false;
    let flaggedIds: string[] = [];
    if (filters.priced) {
        const sigDb = supabase as unknown as {
            from: (t: string) => {
                select: (c: string) => {
                    eq: (k: string, v: string) => PromiseLike<{ data: Record<string, unknown>[] | null }>;
                    in: (
                        k: string,
                        v: string[],
                    ) => PromiseLike<{
                        data: Record<string, unknown>[] | null;
                        error: { message?: string } | null;
                    }>;
                };
            };
        };
        try {
            const { data: flags } = await sigDb
                .from("catalog_price_signal_flags")
                .select("catalog_item_id")
                .eq("status", "active");
            flaggedIds = (flags ?? []).map((f) => String(f.catalog_item_id));
        } catch {
            /* pre-196 — nothing is flagged */
        }
        if (searchIds) {
            try {
                const { data: sigs, error: sigError } = await sigDb
                    .from("catalog_price_signals")
                    .select("catalog_item_id")
                    .in("catalog_item_id", searchIds);
                if (sigError) throw new Error(sigError.message);
                const flagged = new Set(flaggedIds);
                const priced = new Set(
                    (sigs ?? []).map((r) => String(r.catalog_item_id)).filter((id) => !flagged.has(id)),
                );
                searchIds = searchIds.filter((id) => priced.has(id));
            } catch {
                searchIds = [];
            }
            if (searchIds.length === 0) {
                return { success: true as const, items: [], total: 0, page, pageSize };
            }
        } else {
            pricedJoin = true;
        }
    }

    // Explicit columns; count mode matches the path: the id-set and
    // priced paths are at most a few hundred rows, so an exact count is
    // cheap AND honest there, while "estimated" (planner stats) stays
    // for whole-catalog browsing where exact counting is the expensive
    // part.
    const CATALOG_BROWSE_COLUMNS =
        "id, item_type, parent_id, title, maker, maker_slug, slug, scale, attributes, created_at";
    // With a text search and no sort chosen, the order is the search's
    // relevance (the RPC's candidate order, 223), not the alphabet: the
    // Registry used to file "Smoky" among "Dun Smokin" and "Smoke 'N
    // Mirrors" and the name people typed sat mid-page. The candidate set
    // is capped, so it is fetched whole, ordered here, and paged here.
    const relevance = !!searchIds && !filters.sortBy;
    const build = (nameSortColumn: string) => {
        // Widened to string on the priced join: the embedded relation is
        // not in the generated types, and every caller casts rows anyway.
        const columns: string = pricedJoin
            ? `${CATALOG_BROWSE_COLUMNS}, catalog_price_signals!inner(catalog_item_id)`
            : CATALOG_BROWSE_COLUMNS;
        let query = supabase.from("catalog_items").select(columns, {
            count: searchIds || pricedJoin ? "exact" : "estimated",
        });
        if (relevance) query = query.limit(Math.max(FUZZY_CANDIDATE_LIMIT, searchIds?.length ?? 0));
        else query = query.range(from, from + pageSize - 1);
        if (pricedJoin && flaggedIds.length > 0) {
            query = query.not("id", "in", `(${flaggedIds.join(",")})`);
        }

        if (makerFacet) query = query.eq("maker", makerFacet);
        // Attribution split (156): company / person facets.
        if (filters.manufacturer) query = query.eq("manufacturer", filters.manufacturer);
        if (filters.artist) query = query.eq("artist", filters.artist);
        if (filters.scale) query = query.eq("scale", filters.scale);
        if (filters.type) query = query.eq("item_type", filters.type);
        if (searchIds) {
            query = query.in("id", searchIds);
        } else if (searchTerm) {
            const q = sanitizeForOr(searchTerm);
            if (q) query = query.or(`title.ilike.%${q}%,maker.ilike.%${q}%`);
        }

        // Advanced filters live in the attributes JSONB. Year is stored as a
        // 4-digit value, so lexical text comparison on ->> matches numeric order
        // for the realistic range; rows lacking the key are naturally excluded.
        if (filters.yearFrom !== undefined)
            query = query.gte("attributes->>release_year_start", String(filters.yearFrom));
        if (filters.yearTo !== undefined) query = query.lte("attributes->>release_year_start", String(filters.yearTo));
        if (filters.color) query = query.ilike("attributes->>color_description", `%${filters.color}%`);
        if (filters.model) query = query.ilike("attributes->>model_number", `%${filters.model}%`);
        if (filters.medium) query = query.ilike("attributes->>cast_medium", `%${filters.medium}%`);
        if (filters.material) query = query.eq("attributes->>material", filters.material);
        // Run type is a closed vocabulary, so exact-match (not ilike): the
        // point of the fixed list is that every "Web Special" row matches.
        if (filters.runType) query = query.eq("attributes->>run_type", filters.runType);

        // A name sort files by sort_key (188), never by the raw title: a
        // leading quotation mark or an accented initial would otherwise
        // decide the order, which is what put 72 punctuation-led rows on
        // page one and left Éclair sorting after Z. Maker and date sorts
        // are unaffected.
        const sortBy = filters.sortBy === "title" ? nameSortColumn : filters.sortBy;
        if (relevance) {
            // ordered by candidate rank below
        } else if (sortBy)
            query = query.order(sortBy, {
                ascending: filters.sortDir === "asc",
            });
        else query = query.order(nameSortColumn, { ascending: true });

        return query;
    };

    let { data, count, error } = await build(CATALOG_NAME_SORT_COLUMN);
    // Migration 188 pending (fresh env, un-pasted)? Browsing must not go
    // down over a sort refinement, so fall back to the raw title.
    if (error && isMissingSortKey(error)) {
        ({ data, count, error } = await build("title"));
    }
    // Pre-189 env with the priced toggle on: the signals relation does
    // not exist, and "no priced entries yet" is the truthful answer.
    if (error && pricedJoin && /catalog_price_signals/i.test(error.message ?? "")) {
        return { success: true as const, items: [], total: 0, page, pageSize };
    }
    if (error) return { success: false as const, error: error.message };
    if (relevance && searchIds) {
        const rank = new Map(searchIds.map((id, i) => [id, i]));
        const ordered = [...((data ?? []) as unknown as { id: string }[])].sort(
            (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );
        // Where the sets that only list the name begin, as an index into the
        // whole ordered result; the page draws a "Sets that include it" heading there.
        const rosterFrom = rosterIds.size ? ordered.findIndex((r) => rosterIds.has(r.id)) : -1;
        return {
            success: true as const,
            items: ordered.slice(from, from + pageSize) as unknown as typeof data,
            total: ordered.length,
            page,
            pageSize,
            ...(rosterFrom >= 0 ? { rosterFrom } : {}),
        };
    }
    return {
        success: true as const,
        items: data ?? [],
        total: count ?? 0,
        page,
        pageSize,
    };
}

export async function getCatalogItem(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("catalog_items").select("*").eq("id", id).single();
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, item: data };
}

// ── SUGGESTIONS ──

export async function createSuggestion(input: SuggestionInput) {
    const { supabase, user } = await requireAuth();

    // Validate
    const reason = sanitizeText(input.reason).trim();
    if (!reason || reason.length < 10) {
        return {
            success: false,
            error: "Please provide a reason (at least 10 characters).",
        };
    }

    // Check for trusted curator auto-approve
    const admin = getAdminClient();

    // A model number typed in front of a title moves to its own field, or must
    // agree with it (STANDARDS: titles hold the name only). The forms ask the
    // member first; this is the guard for every path that sets a title (MHH-079).
    if (
        (input.suggestionType === "addition" || input.suggestionType === "correction") &&
        input.fieldChanges &&
        "title" in input.fieldChanges
    ) {
        let entry: { hasModelNumber: boolean; currentModel?: string | null };
        if (input.suggestionType === "addition") {
            const type = suggestionItemTypeToDb(input.fieldChanges.item_type as string | undefined);
            entry = { hasModelNumber: !!type && type !== "plastic_mold" && !ARTIST_ATTRIBUTED_CATEGORIES.has(type) };
        } else {
            const { data: row } = input.catalogItemId
                ? await admin
                      .from("catalog_items")
                      .select("item_type, attributes")
                      .eq("id", input.catalogItemId)
                      .maybeSingle()
                : { data: null };
            const r = row as { item_type: string; attributes: Record<string, unknown> | null } | null;
            const current = r?.attributes?.model_number;
            entry = {
                hasModelNumber: !!r && r.item_type !== "plastic_mold" && !ARTIST_ATTRIBUTED_CATEGORIES.has(r.item_type),
                currentModel: typeof current === "string" ? current : current == null ? null : String(current),
            };
        }
        const numbered = applyTitleNumberRule(input.fieldChanges, entry);
        if (!numbered.ok) return { success: false, error: numbered.error };
        input.fieldChanges = numbered.fieldChanges;
    }

    // ── Duplicate guard (additions only): before creating a new-entry
    // suggestion, look for existing catalog items with a matching
    // title. The caller renders the candidates and may resubmit with
    // confirmDuplicates — this is a speed bump, never a wall.
    if (input.suggestionType === "addition") {
        const existing = await findExistingMold(input.fieldChanges ?? {});
        if (existing) return { success: false, error: existingMoldMessage(existing) };
    }
    if (
        input.suggestionType === "addition" &&
        !input.confirmDuplicates &&
        typeof input.fieldChanges?.title === "string" &&
        input.fieldChanges.title.trim().length >= 3
    ) {
        const needle = input.fieldChanges.title.trim();
        const { data: dupRows } = await admin
            .from("catalog_items")
            .select("id, title, maker, item_type")
            .ilike("title", `%${needle.replace(/[%_]/g, "")}%`)
            .limit(5);
        if (dupRows && dupRows.length > 0) {
            return {
                success: false as const,
                error: "possible-duplicates",
                duplicates: dupRows as DuplicateCandidate[],
            };
        }
    }
    const { data: profile } = await admin
        .from("users")
        .select("approved_suggestions_count, alias_name")
        .eq("id", user.id)
        .single();

    const approvedCount =
        (
            profile as {
                approved_suggestions_count: number;
            } | null
        )?.approved_suggestions_count ?? 0;
    const alias = (profile as { alias_name: string } | null)?.alias_name ?? "Unknown";

    let autoApprove = false;
    if (input.suggestionType === "correction" && input.fieldChanges) {
        // Field AND value, at every rank: the correction apply path does no
        // vocabulary validation of its own, so the fast path demands
        // well-formed values. A miss is not a rejection; the suggestion
        // files for human review like anyone else's.
        autoApprove = curatorAutoApprovable(approvedCount, input.fieldChanges);
    }

    // ── Duplicate reports: a merge is irreversible, so no rank
    // auto-approves one. Both entries must exist and differ.
    if (input.suggestionType === DUPLICATE_SUGGESTION_TYPE) {
        const refusal = duplicateReportRefusal({
            catalogItemId: input.catalogItemId,
            fieldChanges: input.fieldChanges,
        });
        if (refusal) return { success: false, error: refusal };
        const target = duplicateTarget(input.fieldChanges)!;
        const { data: both } = await admin
            .from("catalog_items")
            .select("id, title")
            .in("id", [input.catalogItemId as string, target.duplicate_of]);
        const rows = (both ?? []) as { id: string; title: string }[];
        if (rows.length !== 2) return { success: false, error: "One of those entries no longer exists." };
        const keep = rows.find((r) => r.id === target.duplicate_of);
        input.fieldChanges = { duplicate_of: target.duplicate_of, duplicate_of_title: keep?.title ?? "" };
        autoApprove = false;
    }

    // A scale, run type or material the Registry's lists don't know would be
    // refused by the database when applied (233); say so now, in words.
    if ((input.suggestionType === "correction" || input.suggestionType === "addition") && input.fieldChanges) {
        const problem = vocabularyProblem(input.fieldChanges);
        if (problem) return { success: false, error: problem };
    }

    const status = autoApprove ? "auto_approved" : "pending";

    const { data, error } = await supabase
        .from("catalog_suggestions")
        .insert({
            user_id: user.id,
            catalog_item_id: input.catalogItemId || null,
            suggestion_type: input.suggestionType,
            field_changes: input.fieldChanges as Json,
            reason,
            status,
        })
        .select("id")
        .single();

    if (error) {
        if (isMissingDuplicateType(error)) return { success: false, error: DUPLICATE_MIGRATION_NOTICE };
        return { success: false, error: error.message };
    }

    // If auto-approved, apply immediately: the contributor's rank is the
    // approver (no reviewer), through the Registry's one writer.
    if (autoApprove && data) {
        const applied = await applySuggestion(data.id as string, { reviewer: null });
        // Could not be written: it is back in the queue for a person.
        if (!applied.ok) autoApprove = false;
    }

    // Notify admins on EVERY suggestion — auto-approved ones loudest.
    // This block used to fire only for the pending path, which meant a
    // Silver curator's changes applied in complete silence: exactly the
    // opening for a patient troll who farms ten approvals being helpful
    // and then vandalises instantly. Auto-applied changes are already live
    // when this notification lands, so it links straight to the suggestion
    // page, where the admin has a one-click revert.
    //
    // Once any Registry moderator is active, these per-suggestion pings
    // stop: the moderators work the queue and the owner reads the daily
    // digest instead (owner answer 4, 2026-10-16).
    if (!(await anyActiveModerator())) {
        const userId = user.id;
        const wasAutoApproved = autoApprove;
        const suggestionId = data?.id as string | undefined;
        const changedKeys = input.fieldChanges ? Object.keys(input.fieldChanges).join(", ") : "";
        after(async () => {
            try {
                const { createNotification } = await import("@/lib/notifications/createNotification");
                const { adminNotificationTargets } = await import("@/lib/notifications/adminTargets");
                const adminIds = await adminNotificationTargets(getAdminClient());
                const content = wasAutoApproved
                    ? `⚡ Auto-applied: @${alias} changed ${changedKeys || "an entry"} — already live. Review or revert.`
                    : `📝 New catalog suggestion from @${alias}: "${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""}"`;
                for (const id of adminIds) {
                    await createNotification({
                        userId: id,
                        type: "system",
                        actorId: userId,
                        content,
                        ...(suggestionId ? { linkUrl: `/catalog/suggestions/${suggestionId}` } : {}),
                    });
                }
            } catch {
                /* non-blocking */
            }
        });
    }

    revalidatePath("/catalog/suggestions");
    return {
        success: true,
        id: data?.id as string,
        autoApproved: autoApprove,
    };
}

/**
 * Revert an applied correction — the admin's answer to the patient troll.
 *
 * Silver auto-approval means a member who farmed ten approvals being
 * helpful can vandalise instantly. The counterweight is visibility (every
 * auto-apply now notifies the admins) plus this: one action that puts the
 * old values back, takes the approval credit back, and tells the author.
 *
 * EXPECT-GUARD, like every repair script in this repo: a field is only
 * reverted while the entry STILL HOLDS the suggestion's `to` value. If
 * someone corrected it again since, that later value wins and the field
 * is reported as drifted rather than clobbered.
 *
 * The owner or any active Registry moderator may revert; the history and
 * the author's notice carry their real alias and role. The field work is
 * revertFields in lib/catalog/write (the Registry's one writer).
 */
export async function revertSuggestion(input: {
    suggestionId: string;
    reason: string;
}): Promise<{ success: boolean; error?: string; reverted?: string[]; drifted?: string[] }> {
    let seat: Awaited<ReturnType<typeof requireRegistryModerator>>;
    try {
        seat = await requireRegistryModerator();
    } catch (err) {
        return { success: false, error: err instanceof AuthError ? err.message : "Please log in to do that." };
    }
    const actor = actorOf(seat);
    const admin = getAdminClient();

    const reason = sanitizeText(input.reason ?? "").slice(0, 500);
    if (reason.length < 5) {
        return { success: false, error: "Give a short reason — the author sees it." };
    }

    const { data: suggestion } = await admin
        .from("catalog_suggestions")
        .select("*")
        .eq("id", input.suggestionId)
        .single();
    if (!suggestion) return { success: false, error: "Suggestion not found." };
    const s = suggestion as CatalogSuggestion & { decided_role?: string | null };

    if (s.suggestion_type !== "correction" || !s.catalog_item_id) {
        return {
            success: false,
            error: "Only applied corrections can be reverted here. For an addition, use removal.",
        };
    }
    if (s.status !== "approved" && s.status !== "auto_approved") {
        return { success: false, error: "This suggestion was never applied." };
    }

    const result = await revertFields(actor, {
        itemId: s.catalog_item_id,
        fieldChanges: (s.field_changes ?? {}) as Record<string, unknown>,
        suggestionId: s.id,
        reason,
    });
    if (!result.success) return { success: false, error: result.error, drifted: result.drifted };

    // Status, the approval credit back, and the author's notice.
    await withdrawApproval(s.id, actor, reason, result.drifted);

    // One moderator undoing another's approval goes to the owner at once.
    if (
        actor.role === "moderator" &&
        s.decided_role === "moderator" &&
        s.reviewed_by &&
        s.reviewed_by !== actor.userId
    ) {
        await alertOwner(
            "undo_other",
            `@${actor.alias} reverted a correction another moderator approved. Why: ${reason.slice(0, 200)}`,
            `/catalog/suggestions/${s.id}`,
        );
    }

    revalidatePath(`/catalog/${s.catalog_item_id}`);
    return { success: true, reverted: result.reverted, drifted: result.drifted };
}

export async function getSuggestions(statusFilter?: string, page: number = 1) {
    const supabase = await createClient();
    const admin = getAdminClient();
    const pageSize = 20;
    const from = (page - 1) * pageSize;

    // Two-step fetch: FK goes to auth.users, PostgREST can't join
    let query = supabase
        .from("catalog_suggestions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

    // "pending" means every waiting one, including those a moderator is looking at.
    const statuses = statusFilterValues(statusFilter);
    if (statuses) {
        query = query.in("status", statuses);
    }

    const { data, count, error } = await query;
    if (error) return { success: false as const, error: error.message };

    // Enrich with user data from public.users
    const rows = (data ?? []) as CatalogSuggestion[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const userMap: Record<
        string,
        { alias_name: string; avatar_url: string | null; approved_suggestions_count: number }
    > = {};
    if (userIds.length > 0) {
        const { data: users } = await admin
            .from("users")
            .select("id, alias_name, avatar_url, approved_suggestions_count")
            .in("id", userIds);
        for (const u of (users ?? []) as {
            id: string;
            alias_name: string;
            avatar_url: string | null;
            approved_suggestions_count: number;
        }[]) {
            userMap[u.id] = {
                alias_name: u.alias_name,
                avatar_url: u.avatar_url,
                approved_suggestions_count: u.approved_suggestions_count,
            };
        }
    }

    const enriched = rows.map((r) => ({
        ...r,
        users: userMap[r.user_id] ?? null,
    }));

    return {
        success: true as const,
        suggestions: enriched,
        total: count ?? 0,
    };
}

export async function getSuggestion(id: string) {
    const supabase = await createClient();
    const admin = getAdminClient();

    // Two-step fetch: FK goes to auth.users, PostgREST can't join
    const { data: suggestion, error } = await supabase.from("catalog_suggestions").select("*").eq("id", id).single();

    if (error) return { success: false as const, error: error.message };

    // Enrich with user data
    const s = suggestion as CatalogSuggestion;
    let userData = null;
    if (s) {
        const { data: user } = await admin
            .from("users")
            .select("alias_name, avatar_url, approved_suggestions_count")
            .eq("id", s.user_id)
            .single();
        userData = user;
    }

    // Get comments
    const { data: comments } = await supabase
        .from("catalog_suggestion_comments")
        .select("*")
        .eq("suggestion_id", id)
        .order("created_at", { ascending: true });

    // Get catalog item if correction
    let catalogItem = null;
    if (s && s.catalog_item_id) {
        const { data: item } = await supabase.from("catalog_items").select("*").eq("id", s.catalog_item_id!).single();
        catalogItem = item;
    }

    return {
        success: true as const,
        suggestion: s ? { ...s, users: userData } : suggestion,
        comments: comments ?? [],
        catalogItem,
    };
}

// ── VOTING ──

export async function voteSuggestion(suggestionId: string, voteType: "up" | "down") {
    const { supabase, user } = await requireAuth();

    // Delete existing vote first (toggle/switch)
    await supabase.from("catalog_suggestion_votes").delete().eq("suggestion_id", suggestionId).eq("user_id", user.id);

    const { error } = await supabase.from("catalog_suggestion_votes").insert({
        suggestion_id: suggestionId,
        user_id: user.id,
        vote_type: voteType,
    });

    if (error) return { success: false, error: error.message };

    await updateVoteCounts(suggestionId);

    revalidatePath(`/catalog/suggestions/${suggestionId}`);
    revalidatePath("/catalog/suggestions");
    return { success: true };
}

export async function removeVote(suggestionId: string) {
    const { supabase, user } = await requireAuth();

    await supabase.from("catalog_suggestion_votes").delete().eq("suggestion_id", suggestionId).eq("user_id", user.id);

    await updateVoteCounts(suggestionId);
    revalidatePath(`/catalog/suggestions/${suggestionId}`);
    revalidatePath("/catalog/suggestions");
    return { success: true };
}

async function updateVoteCounts(suggestionId: string) {
    const admin = getAdminClient();
    const { data: votes } = await admin
        .from("catalog_suggestion_votes")
        .select("vote_type")
        .eq("suggestion_id", suggestionId);

    const ups = (votes ?? []).filter((v: { vote_type: string }) => v.vote_type === "up").length;
    const downs = (votes ?? []).filter((v: { vote_type: string }) => v.vote_type === "down").length;

    await admin.from("catalog_suggestions").update({ upvotes: ups, downvotes: downs }).eq("id", suggestionId);
}

export async function getUserVote(suggestionId: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from("catalog_suggestion_votes")
        .select("vote_type")
        .eq("suggestion_id", suggestionId)
        .eq("user_id", user.id)
        .maybeSingle();

    return data ? (data as { vote_type: string }).vote_type : null;
}

// ── COMMENTS ──

export async function addSuggestionComment(suggestionId: string, body: string) {
    const { supabase, user } = await requireAuth();

    const sanitized = sanitizeText(body).trim();
    if (!sanitized) return { success: false, error: "Comment cannot be empty." };
    if (sanitized.length > 2000)
        return {
            success: false,
            error: "Comment must be under 2000 characters.",
        };

    const admin = getAdminClient();
    const { data: profile } = await admin.from("users").select("alias_name").eq("id", user.id).single();
    const alias = (profile as { alias_name: string } | null)?.alias_name ?? "Unknown";

    const { error } = await supabase.from("catalog_suggestion_comments").insert({
        suggestion_id: suggestionId,
        user_id: user.id,
        user_alias: alias,
        body: sanitized,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/catalog/suggestions/${suggestionId}`);
    return { success: true };
}

export async function deleteSuggestionComment(commentId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("catalog_suggestion_comments").delete().eq("id", commentId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── ADMIN REVIEW ──

/**
 * The owner's admin queue. The decision itself (refusals, the apply
 * through the Registry's one writer, status, credit, the member's notice
 * naming who approved it) is decideSuggestion in lib/catalog/suggestionApply,
 * the same one the Registry Desk uses.
 */
export async function reviewSuggestion(decision: ReviewDecision) {
    const { user } = await requireAuth();

    // Verify admin — use ADMIN_EMAIL check (same as admin page)
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (!adminEmail || user.email?.toLowerCase() !== adminEmail) {
        return { success: false, error: "Admin access required." };
    }

    const { data: me } = await getAdminClient().from("users").select("alias_name").eq("id", user.id).maybeSingle();
    const reviewer = {
        userId: user.id,
        alias: (me as { alias_name: string | null } | null)?.alias_name ?? "Owner",
        role: "owner" as const,
    };

    const result = await decideSuggestion(decision.suggestionId, {
        reviewer,
        verdict: decision.decision,
        note: decision.adminNotes,
    });
    revalidatePath("/admin");
    if (!result.success) {
        if (!result.requeued) return { success: false, error: result.error };
        return { success: false, error: `It could not be applied, so it is back in the queue: ${result.error}` };
    }
    return { success: true };
}

// ── CHANGELOG ──

export async function getChangelog(page: number = 1) {
    const supabase = await createClient();
    const pageSize = 20;
    const from = (page - 1) * pageSize;

    const { data, count, error } = await supabase
        .from("catalog_changelog")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

    if (error) return { success: false as const, error: error.message };
    return {
        success: true as const,
        entries: data ?? [],
        total: count ?? 0,
    };
}

// ── TOP CURATORS ──

export async function getTopCurators(limit: number = 5) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("users")
        .select("id, alias_name, avatar_url, approved_suggestions_count")
        .gt("approved_suggestions_count", 0)
        .order("approved_suggestions_count", { ascending: false })
        .limit(limit);

    if (error) return [];
    return (data ?? []) as {
        id: string;
        alias_name: string;
        avatar_url: string | null;
        approved_suggestions_count: number;
    }[];
}

// ── Artist notes suggestions (200) ───────────────────────────────

/**
 * Suggest (or improve) an artist's Registry Notes. Rides the existing
 * suggestion pipeline: same review queue, admin notifications, and
 * audit trail — the only difference is that approval writes to the
 * artists table instead of a catalog row. Pre-200 the artist_name
 * column is missing and the member gets an honest "not yet" error.
 */
export async function suggestArtistNotes(input: {
    artistName: string;
    notes: string;
    reason: string;
}): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const artistName = sanitizeText(input.artistName ?? "").trim();
    const notes = sanitizeText(input.notes ?? "").trim();
    const reason = sanitizeText(input.reason ?? "").trim();
    if (!artistName || artistName.length > 120) return { success: false, error: "Unknown artist." };
    if (!notes || notes.length < 20) return { success: false, error: "Notes need at least a couple of sentences." };
    if (notes.length > 4000) return { success: false, error: "Notes are capped at 4,000 characters." };
    if (!reason || reason.length < 5)
        return { success: false, error: "Add a short line on where this knowledge comes from." };

    // The artist must exist as a maker in the catalog — notes hang off
    // real bodies of work, not arbitrary names.
    const admin = getAdminClient();
    const { count } = await admin
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .eq("maker", artistName);
    if (!count) return { success: false, error: "No catalogued works found for that artist." };

    // Current notes become the "from" so the review diff reads honestly.
    let from = "";
    try {
        const { data: existing } = await (
            admin as unknown as {
                from: (t: string) => {
                    select: (c: string) => {
                        eq: (
                            k: string,
                            v: string,
                        ) => { maybeSingle: () => Promise<{ data: { registry_notes: string | null } | null }> };
                    };
                };
            }
        )
            .from("artists")
            .select("registry_notes")
            .eq("name", artistName)
            .maybeSingle();
        from = existing?.registry_notes ?? "";
    } catch {
        /* pre-200: the insert below will fail with the honest error */
    }

    const { data, error } = await (
        supabase as unknown as {
            from: (t: string) => {
                insert: (row: Record<string, unknown>) => {
                    select: (c: string) => {
                        single: () => Promise<{
                            data: { id: string } | null;
                            error: { code?: string; message?: string } | null;
                        }>;
                    };
                };
            };
        }
    )
        .from("catalog_suggestions")
        .insert({
            user_id: user.id,
            catalog_item_id: null,
            suggestion_type: "correction",
            field_changes: { registry_notes: { from, to: notes } },
            reason: `Artist notes — ${artistName}: ${reason}`,
            status: "pending",
            artist_name: artistName,
        })
        .select("id")
        .single();
    if (error || !data) {
        if (error?.code === "PGRST204" || /artist_name/.test(error?.message ?? "")) {
            return { success: false, error: "Artist notes aren't switched on yet — migration 200 pending." };
        }
        return { success: false, error: "Could not file the suggestion." };
    }

    const suggestionId = data.id;
    const authorId = user.id;
    // Moderators active: the owner reads these in the digest (answer 4).
    if (!(await anyActiveModerator()))
        after(async () => {
            try {
                const { createNotification } = await import("@/lib/notifications/createNotification");
                const { adminNotificationTargets } = await import("@/lib/notifications/adminTargets");
                const ids = await adminNotificationTargets(getAdminClient());
                for (const id of ids) {
                    await createNotification({
                        userId: id,
                        type: "system",
                        actorId: authorId,
                        content: `📝 Artist notes suggested for ${artistName}.`,
                        linkUrl: `/catalog/suggestions/${suggestionId}`,
                    });
                }
            } catch {
                /* non-blocking */
            }
        });

    revalidatePath("/catalog/suggestions");
    return { success: true };
}
