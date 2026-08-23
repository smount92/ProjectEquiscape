"use server";

import { requireAuth } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { sanitizeText } from "@/lib/utils/validation";
import { sanitizeForOr } from "@/lib/utils/search";
import {
    SILVER_AUTO_FIELDS,
    buildCorrectionUpdate,
    correctionTouchesAttributes,
} from "@/lib/catalog/corrections";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import {
    deriveAttribution,
    isCatalogGender,
    isRunType,
    normalizeCatalogBreed,
    normalizeRunCount,
    normalizeScale,
    suggestionItemTypeToDb,
} from "@/lib/catalog/taxonomy";
import { REFERENCE_PAGES_CACHE_TAG } from "@/app/actions/reference-pages";
import type { Database } from "@/lib/types/database.generated";

type CatalogItemInsert = Database["public"]["Tables"]["catalog_items"]["Insert"];
type CatalogItemUpdate = Database["public"]["Tables"]["catalog_items"]["Update"];

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
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
}

interface SuggestionInput {
    catalogItemId?: string | null; // null = new entry
    suggestionType: "correction" | "addition" | "removal" | "photo";
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
    return (
        error.code === "42703" ||
        Boolean(error.message && error.message.includes(CATALOG_NAME_SORT_COLUMN))
    );
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
    let searchIds: string[] | null = null;
    if (filters.search) {
        const { data: fuzzyRows, error: fuzzyError } = await supabase.rpc("search_catalog_fuzzy", {
            search_term: filters.search,
            max_results: FUZZY_CANDIDATE_LIMIT,
        });
        if (!fuzzyError && Array.isArray(fuzzyRows)) {
            searchIds = (fuzzyRows as { id: string }[]).map((r) => r.id);
            if (searchIds.length === 0) {
                return { success: true as const, items: [], total: 0, page, pageSize };
            }
        }
        // RPC unavailable (fresh env, migration pending)? searchIds stays
        // null and the title/maker ILIKE fallback below keeps search alive.
    }

    // Explicit columns; count mode matches the path: the id-set path is
    // ≤FUZZY_CANDIDATE_LIMIT rows, so an exact count is cheap AND honest
    // there, while "estimated" (planner stats) stays for whole-catalog
    // browsing where exact counting is the expensive part.
    const build = (nameSortColumn: string) => {
        let query = supabase
            .from("catalog_items")
            .select("id, item_type, parent_id, title, maker, maker_slug, slug, scale, attributes, created_at", {
                count: searchIds ? "exact" : "estimated",
            })
            .range(from, from + pageSize - 1);

        if (filters.maker) query = query.eq("maker", filters.maker);
        // Attribution split (156): company / person facets.
        if (filters.manufacturer) query = query.eq("manufacturer", filters.manufacturer);
        if (filters.artist) query = query.eq("artist", filters.artist);
        if (filters.scale) query = query.eq("scale", filters.scale);
        if (filters.type) query = query.eq("item_type", filters.type);
        if (searchIds) {
            query = query.in("id", searchIds);
        } else if (filters.search) {
            const q = sanitizeForOr(filters.search);
            if (q) query = query.or(`title.ilike.%${q}%,maker.ilike.%${q}%`);
        }

        // Advanced filters live in the attributes JSONB. Year is stored as a
        // 4-digit value, so lexical text comparison on ->> matches numeric order
        // for the realistic range; rows lacking the key are naturally excluded.
        if (filters.yearFrom !== undefined)
            query = query.gte("attributes->>release_year_start", String(filters.yearFrom));
        if (filters.yearTo !== undefined)
            query = query.lte("attributes->>release_year_start", String(filters.yearTo));
        if (filters.color)
            query = query.ilike("attributes->>color_description", `%${filters.color}%`);
        if (filters.model)
            query = query.ilike("attributes->>model_number", `%${filters.model}%`);
        if (filters.medium)
            query = query.ilike("attributes->>cast_medium", `%${filters.medium}%`);
        if (filters.material)
            query = query.eq("attributes->>material", filters.material);
        // Run type is a closed vocabulary, so exact-match (not ilike): the
        // point of the fixed list is that every "Web Special" row matches.
        if (filters.runType)
            query = query.eq("attributes->>run_type", filters.runType);

        // A name sort files by sort_key (188), never by the raw title: a
        // leading quotation mark or an accented initial would otherwise
        // decide the order, which is what put 72 punctuation-led rows on
        // page one and left Éclair sorting after Z. Maker and date sorts
        // are unaffected.
        const sortBy = filters.sortBy === "title" ? nameSortColumn : filters.sortBy;
        if (sortBy)
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
    if (error)
        return { success: false as const, error: error.message };
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
    const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("id", id)
        .single();
    if (error)
        return { success: false as const, error: error.message };
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

    // ── Duplicate guard (additions only): before creating a new-entry
    // suggestion, look for existing catalog items with a matching
    // title. The caller renders the candidates and may resubmit with
    // confirmDuplicates — this is a speed bump, never a wall.
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
    const alias =
        (profile as { alias_name: string } | null)?.alias_name ?? "Unknown";

    let autoApprove = false;
    if (input.suggestionType === "correction" && input.fieldChanges) {
        const changedFields = Object.keys(input.fieldChanges);
        const isGoldCurator = approvedCount >= 200;
        const isSilverCurator = approvedCount >= 50;

        if (isGoldCurator) {
            autoApprove = true;
        } else if (isSilverCurator) {
            autoApprove = changedFields.every((f) =>
                SILVER_AUTO_FIELDS.has(f)
            );
        }
    }

    const status = autoApprove ? "auto_approved" : "pending";

    const { data, error } = await supabase
        .from("catalog_suggestions")
        .insert({
            user_id: user.id,
            catalog_item_id: input.catalogItemId || null,
            suggestion_type: input.suggestionType,
            field_changes: input.fieldChanges,
            reason,
            status,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

    // If auto-approved, apply immediately
    if (autoApprove && data) {
        await applyApprovedSuggestion(
            data.id as string,
            user.id,
            alias
        );
    }

    // Notify admins for non-auto-approved
    if (!autoApprove) {
        const userId = user.id;
        after(async () => {
            try {
                const { createNotification } = await import(
                    "@/lib/notifications/createNotification"
                );
                const adminClient = getAdminClient();
                const { data: admins } = await adminClient
                    .from("users")
                    .select("id")
                    .eq("role", "admin");
                for (const a of (admins ?? []) as { id: string }[]) {
                    await createNotification({
                        userId: a.id,
                        type: "system",
                        actorId: userId,
                        content: `📝 New catalog suggestion from @${alias}: "${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""}"`,
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

export async function getSuggestions(
    statusFilter?: string,
    page: number = 1
) {
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

    if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
    }

    const { data, count, error } = await query;
    if (error)
        return { success: false as const, error: error.message };

    // Enrich with user data from public.users
    const rows = (data ?? []) as CatalogSuggestion[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const userMap: Record<string, { alias_name: string; avatar_url: string | null; approved_suggestions_count: number }> = {};
    if (userIds.length > 0) {
        const { data: users } = await admin
            .from("users")
            .select("id, alias_name, avatar_url, approved_suggestions_count")
            .in("id", userIds);
        for (const u of (users ?? []) as { id: string; alias_name: string; avatar_url: string | null; approved_suggestions_count: number }[]) {
            userMap[u.id] = { alias_name: u.alias_name, avatar_url: u.avatar_url, approved_suggestions_count: u.approved_suggestions_count };
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
    const { data: suggestion, error } = await supabase
        .from("catalog_suggestions")
        .select("*")
        .eq("id", id)
        .single();

    if (error)
        return { success: false as const, error: error.message };

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
        const { data: item } = await supabase
            .from("catalog_items")
            .select("*")
            .eq("id", s.catalog_item_id!)
            .single();
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

export async function voteSuggestion(
    suggestionId: string,
    voteType: "up" | "down"
) {
    const { supabase, user } = await requireAuth();

    // Delete existing vote first (toggle/switch)
    await supabase
        .from("catalog_suggestion_votes")
        .delete()
        .eq("suggestion_id", suggestionId)
        .eq("user_id", user.id);

    const { error } = await supabase
        .from("catalog_suggestion_votes")
        .insert({
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

    await supabase
        .from("catalog_suggestion_votes")
        .delete()
        .eq("suggestion_id", suggestionId)
        .eq("user_id", user.id);

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

    const ups = (votes ?? []).filter(
        (v: { vote_type: string }) => v.vote_type === "up"
    ).length;
    const downs = (votes ?? []).filter(
        (v: { vote_type: string }) => v.vote_type === "down"
    ).length;

    await admin
        .from("catalog_suggestions")
        .update({ upvotes: ups, downvotes: downs })
        .eq("id", suggestionId);
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

    return data
        ? (data as { vote_type: string }).vote_type
        : null;
}

// ── COMMENTS ──

export async function addSuggestionComment(
    suggestionId: string,
    body: string
) {
    const { supabase, user } = await requireAuth();

    const sanitized = sanitizeText(body).trim();
    if (!sanitized)
        return { success: false, error: "Comment cannot be empty." };
    if (sanitized.length > 2000)
        return {
            success: false,
            error: "Comment must be under 2000 characters.",
        };

    const admin = getAdminClient();
    const { data: profile } = await admin
        .from("users")
        .select("alias_name")
        .eq("id", user.id)
        .single();
    const alias =
        (profile as { alias_name: string } | null)?.alias_name ??
        "Unknown";

    const { error } = await supabase
        .from("catalog_suggestion_comments")
        .insert({
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
    const { error } = await supabase
        .from("catalog_suggestion_comments")
        .delete()
        .eq("id", commentId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── ADMIN REVIEW ──

export async function reviewSuggestion(decision: ReviewDecision) {
    const { user } = await requireAuth();
    const admin = getAdminClient();

    // Verify admin — use ADMIN_EMAIL check (same as admin page)
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (!adminEmail || user.email?.toLowerCase() !== adminEmail) {
        return { success: false, error: "Admin access required." };
    }

    // Get suggestion with contributor info
    const { data: suggestion } = await admin
        .from("catalog_suggestions")
        .select("*")
        .eq("id", decision.suggestionId)
        .single();

    if (!suggestion)
        return { success: false, error: "Suggestion not found." };

    const s = suggestion as CatalogSuggestion;

    // Get contributor alias
    const { data: contributorProfile } = await admin
        .from("users")
        .select("alias_name")
        .eq("id", s.user_id)
        .single();
    const contributorAlias =
        (contributorProfile as { alias_name: string } | null)
            ?.alias_name ?? "Unknown";

    // Update status
    await admin
        .from("catalog_suggestions")
        .update({
            status: decision.decision,
            admin_notes: decision.adminNotes || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
        })
        .eq("id", decision.suggestionId);

    if (decision.decision === "approved") {
        await applyApprovedSuggestion(
            decision.suggestionId,
            s.user_id,
            contributorAlias
        );
    }

    // Notify the suggestion author
    const suggestionUserId = s.user_id;
    const adminUserId = user.id;
    after(async () => {
        try {
            const { createNotification } = await import(
                "@/lib/notifications/createNotification"
            );
            const emoji =
                decision.decision === "approved" ? "✅" : "❌";
            const verb =
                decision.decision === "approved"
                    ? "approved"
                    : "not approved";
            await createNotification({
                userId: suggestionUserId,
                type: "system",
                actorId: adminUserId,
                content: `${emoji} Your catalog suggestion was ${verb}.${decision.adminNotes ? ` Note: "${decision.adminNotes}"` : ""}`,
            });
        } catch {
            /* non-blocking */
        }
    });

    revalidatePath("/catalog/suggestions");
    revalidatePath("/admin");
    return { success: true };
}

// ── APPLY APPROVED SUGGESTION ──

async function applyApprovedSuggestion(
    suggestionId: string,
    userId: string,
    alias: string
) {
    const admin = getAdminClient();

    const { data: suggestion } = await admin
        .from("catalog_suggestions")
        .select("*")
        .eq("id", suggestionId)
        .single();

    if (!suggestion) return;

    const s = suggestion as CatalogSuggestion;

    let changeSummary = "";
    let catalogItemId = s.catalog_item_id;

    if (s.suggestion_type === "correction" && s.catalog_item_id) {
        const fieldChanges = s.field_changes as Record<string, unknown>;

        // catalog_items is polymorphic: attribute fields (color_description,
        // model_number, cast_medium, release_year_start, material, …) live in
        // the `attributes` JSONB, not as top-level columns. Read the current
        // attributes first (only when needed) so we merge rather than clobber.
        let existingAttributes: Record<string, unknown> | null = null;
        if (correctionTouchesAttributes(fieldChanges)) {
            const { data: current } = await admin
                .from("catalog_items")
                .select("attributes")
                .eq("id", s.catalog_item_id)
                .single();
            existingAttributes =
                (
                    current as {
                        attributes: Record<string, unknown> | null;
                    } | null
                )?.attributes ?? null;
        }

        const { columnUpdates, attributes } = buildCorrectionUpdate(
            fieldChanges,
            existingAttributes
        );

        const updates: CatalogItemUpdate = { ...columnUpdates };
        // Taxonomy v2: corrections are free-text — normalize scale so
        // an approved "traditional" lands as "Traditional (1:9)".
        if (typeof updates.scale === "string") {
            updates.scale = normalizeScale(updates.scale);
        }
        if (attributes) {
            (updates as Record<string, unknown>).attributes = JSON.parse(
                JSON.stringify(attributes)
            );
        }
        if (Object.keys(updates).length > 0) {
            await admin
                .from("catalog_items")
                .update(updates)
                .eq("id", s.catalog_item_id);
        }
        const changes = Object.entries(s.field_changes)
            .map(([k, v]) => {
                const val = v as { from: unknown; to: unknown };
                return `${k}: ${val.from} → ${val.to}`;
            })
            .join(", ");
        changeSummary = `🔧 Correction: ${changes}`;
    } else if (s.suggestion_type === "addition") {
        // Map field_changes to catalog_items columns. Taxonomy v2: the
        // translation lives in taxonomy.ts and accepts both the current
        // canonical values and the legacy release/mold/resin form values
        // still sitting in older pending suggestions. Unrecognized types
        // fall back to plastic_mold (the CHECK constraint would reject
        // the insert otherwise) — but loudly, not silently.
        const fc = s.field_changes as Record<string, unknown>;
        const mappedType = suggestionItemTypeToDb(fc.item_type as string | undefined);
        if (!mappedType) {
            console.error(
                `Catalog addition ${s.id}: unknown item_type "${String(fc.item_type)}" — filing as plastic_mold`,
            );
        }
        const itemType = mappedType ?? "plastic_mold";
        // Attribution split (156): artist/manufacturer stamped at insert.
        // No annotation on the literal — the columns enter generated
        // types after the owner applies 156 (cast at the insert call).
        const attribution = deriveAttribution({
            item_type: itemType,
            maker: (fc.maker ?? "Unknown") as string,
            sculptor: (fc.sculptor as string | undefined) ?? null,
            manufacturer: (fc.manufacturer as string | undefined) ?? null,
        });
        // Tier 1 attributes (2026-08-23) — validated BEFORE the literal so
        // each normalizer runs once. Every one of these returns undefined
        // for a value it doesn't recognize, and the spreads below drop
        // undefined: a bad value costs the field, never the whole approval.
        const runCount = normalizeRunCount(fc.run_count);
        const breed = normalizeCatalogBreed(fc.breed);
        const insertPayload = {
            item_type: itemType,
            title: (fc.title ?? fc.mold_name ?? "Untitled") as string,
            maker: (fc.maker ?? "Unknown") as string,
            artist: attribution.artist,
            manufacturer: attribution.manufacturer,
            // Scales enter in canonical vocabulary; normalize defensively
            // (older pending suggestions carry bare "Traditional" etc.).
            scale: normalizeScale(fc.scale as string | undefined),
            attributes: JSON.parse(JSON.stringify({
                ...(fc.year ? { release_year_start: fc.year } : {}),
                ...(fc.color ? { color_description: fc.color } : {}),
                ...(fc.model_number ? { model_number: fc.model_number } : {}),
                ...(fc.material ? { material: fc.material } : {}),
                // Original retail price (Amanda, 2026-08-23): what the maker
                // charged at release. Pairs with the Blue Book on reference
                // pages — original price beside today's market range.
                ...(fc.retail_price ? { retail_price: fc.retail_price } : {}),
                // Run type must be one of RUN_TYPES — free text here would
                // defeat the whole point (the browse filter groups on the
                // exact string). Anything else is dropped, not stored.
                ...(isRunType(fc.run_type) ? { run_type: fc.run_type } : {}),
                // Pieces made: a positive integer as a plain string, matching
                // the 74 imported rows. "~2500" / "2,500" / "0" are dropped.
                ...(runCount ? { run_count: runCount } : {}),
                // What the model depicts. Gender is closed (the horse forms'
                // GENDER_GROUPS); breed is open — see normalizeCatalogBreed.
                ...(breed ? { breed } : {}),
                ...(isCatalogGender(fc.gender) ? { gender: fc.gender } : {}),
                // Sculptor is credit, not maker — factory pieces have a
                // company maker AND a named sculpting artist (the North
                // Light lesson: conflating them misfiled 20 sculpts as
                // artist resins under "Guy Pocock/Anne Godfrey").
                ...(fc.sculptor ? { sculptor: fc.sculptor } : {}),
                // The form collects the parent mold's name for releases —
                // this used to be dropped on apply. Kept as an attribute so
                // admins can wire parent_id from it later.
                ...(fc.mold_name && fc.title ? { mold_name: fc.mold_name } : {}),
            })),
        };
        const { data: newItem, error: insertError } = await admin
            .from("catalog_items")
            .insert(insertPayload as CatalogItemInsert)
            .select("id")
            .single();
        if (insertError) {
            console.error("Failed to insert catalog addition:", insertError.message);
        }
        catalogItemId = newItem
            ? (newItem as { id: string }).id
            : null;
        changeSummary = `📗 New entry added: ${insertPayload.title}`;
    } else if (s.suggestion_type === "photo") {
        changeSummary = "📸 Reference photo added";
    } else if (s.suggestion_type === "removal") {
        changeSummary = "🗑 Entry marked for removal";
    }

    // Log to changelog
    await admin.from("catalog_changelog").insert({
        suggestion_id: suggestionId,
        catalog_item_id: catalogItemId,
        change_type: s.suggestion_type,
        change_summary: changeSummary,
        contributed_by: userId,
        contributor_alias: alias,
        approved_by: userId,
    });

    // Increment user's approved count atomically
    await admin.rpc("increment_approved_suggestions", {
        target_user_id: userId,
    });

    // Check curator thresholds
    const { data: profile } = await admin
        .from("users")
        .select("approved_suggestions_count")
        .eq("id", userId)
        .single();

    const count =
        (
            profile as {
                approved_suggestions_count: number;
            } | null
        )?.approved_suggestions_count ?? 0;

    // Award curator badges
    const badgesToCheck = [
        { threshold: 1, badgeId: "catalog_contributor" },
        { threshold: 10, badgeId: "bronze_curator" },
        { threshold: 50, badgeId: "silver_curator" },
        { threshold: 200, badgeId: "gold_curator" },
    ];

    for (const { threshold, badgeId } of badgesToCheck) {
        if (count >= threshold) {
            await admin.from("user_badges").upsert(
                { user_id: userId, badge_id: badgeId },
                { onConflict: "user_id,badge_id" }
            );
        }
    }

    // Update trusted curator flag
    if (count >= 50) {
        await admin
            .from("users")
            .update({ is_trusted_curator: true })
            .eq("id", userId);
    }

    // ── Revalidate what the change just made stale ──
    // Reference pages read through hour-long unstable_cache entries
    // (reference-pages.ts) — bust the tag so an approved correction shows
    // up now, not in ≤60 minutes. Also refresh the affected pages.
    revalidateTag(REFERENCE_PAGES_CACHE_TAG, "max");
    revalidatePath("/catalog");
    if (catalogItemId) {
        revalidatePath(`/catalog/${catalogItemId}`);
        const { data: refItem } = await admin
            .from("catalog_items")
            .select("maker, title, maker_slug, slug")
            .eq("id", catalogItemId)
            .single();
        if (refItem) {
            const r = refItem as {
                maker: string | null;
                title: string | null;
                maker_slug: string | null;
                slug: string | null;
            };
            revalidatePath(
                referenceHref({
                    id: catalogItemId,
                    maker: r.maker,
                    title: r.title,
                    maker_slug: r.maker_slug,
                    slug: r.slug,
                })
            );
        }
    }
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

    if (error)
        return { success: false as const, error: error.message };
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
        .select(
            "id, alias_name, avatar_url, approved_suggestions_count"
        )
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
