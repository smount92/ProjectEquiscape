"use server";

import { requireAuth } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sanitizeText } from "@/lib/utils/validation";

// ── Type definitions ──

interface CatalogFilters {
    search?: string;
    maker?: string;
    scale?: string;
    category?: string;
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

// Fields Silver curators can auto-approve
const SILVER_AUTO_FIELDS = new Set([
    "color",
    "year",
    "production_run",
    "release_date",
]);

// ── BROWSING (public — no auth required) ──

export async function getCatalogItems(filters: CatalogFilters) {
    const supabase = await createClient();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const from = (page - 1) * pageSize;

    let query = supabase
        .from("catalog_items")
        .select("*", { count: "exact" })
        .range(from, from + pageSize - 1);

    if (filters.maker) query = query.eq("maker", filters.maker);
    if (filters.scale) query = query.eq("scale", filters.scale);
    if (filters.search) query = query.ilike("title", `%${filters.search}%`);
    if (filters.sortBy)
        query = query.order(filters.sortBy, {
            ascending: filters.sortDir === "asc",
        });
    else query = query.order("title", { ascending: true });

    const { data, count, error } = await query;
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
                    "@/app/actions/notifications"
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

    revalidatePath("/reference/suggestions");
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
    const pageSize = 20;
    const from = (page - 1) * pageSize;

    let query = supabase
        .from("catalog_suggestions")
        .select(
            "*, users!catalog_suggestions_user_id_fkey(alias_name, avatar_url, approved_suggestions_count)",
            { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

    if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
    }

    const { data, count, error } = await query;
    if (error)
        return { success: false as const, error: error.message };
    return {
        success: true as const,
        suggestions: data ?? [],
        total: count ?? 0,
    };
}

export async function getSuggestion(id: string) {
    const supabase = await createClient();

    const { data: suggestion, error } = await supabase
        .from("catalog_suggestions")
        .select(
            "*, users!catalog_suggestions_user_id_fkey(alias_name, avatar_url, approved_suggestions_count)"
        )
        .eq("id", id)
        .single();

    if (error)
        return { success: false as const, error: error.message };

    // Get comments
    const { data: comments } = await supabase
        .from("catalog_suggestion_comments")
        .select("*")
        .eq("suggestion_id", id)
        .order("created_at", { ascending: true });

    // Get catalog item if correction
    let catalogItem = null;
    if (
        suggestion &&
        (suggestion as CatalogSuggestion).catalog_item_id
    ) {
        const { data: item } = await supabase
            .from("catalog_items")
            .select("*")
            .eq(
                "id",
                (suggestion as CatalogSuggestion).catalog_item_id!
            )
            .single();
        catalogItem = item;
    }

    return {
        success: true as const,
        suggestion,
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

    revalidatePath(`/reference/suggestions/${suggestionId}`);
    revalidatePath("/reference/suggestions");
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
    revalidatePath(`/reference/suggestions/${suggestionId}`);
    revalidatePath("/reference/suggestions");
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
    revalidatePath(`/reference/suggestions/${suggestionId}`);
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
                "@/app/actions/notifications"
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

    revalidatePath("/reference/suggestions");
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
        // Apply field changes to catalog_items
        const updates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(
            s.field_changes
        )) {
            if (
                typeof value === "object" &&
                value !== null &&
                "to" in value
            ) {
                updates[key] = (value as { to: unknown }).to;
            }
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
        const { data: newItem } = await admin
            .from("catalog_items")
            .insert(s.field_changes)
            .select("id")
            .single();
        catalogItemId = newItem
            ? (newItem as { id: string }).id
            : null;
        changeSummary = `📗 New entry added: ${(s.field_changes as { title?: string }).title ?? "Untitled"}`;
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
    await admin.rpc("increment_approved_suggestions" as string, {
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
