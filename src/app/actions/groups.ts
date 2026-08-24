"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { requireAuth, AuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { GROUP_FILE_MAX_SIZE, GROUP_FILE_ALLOWED_EXTENSIONS } from "@/lib/groupFiles";
import { revalidatePath, revalidateTag } from "next/cache";
import { sanitizeText } from "@/lib/utils/validation";
import { sanitizeForOr } from "@/lib/utils/search";

// ============================================================
// BARNS — Server Actions
//
// The user-facing name for a group is a **Barn**. The tables keep
// their historic names (`groups`, `group_memberships`, …) and every
// existing row survives; only the copy changed. New code should say
// "barn" in anything a member reads.
//
// PRIVACY MODEL (migration 167) — `groups.is_private` is CANONICAL.
// The legacy three-state `groups.visibility` column is derived from
// it by a trigger and kept only for compatibility. Until 167 is
// applied, every read below falls back to `visibility === "private"`
// and every write degrades to writing `visibility`, so nothing 500s.
// ============================================================

// ── Types ──

export interface Group {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    groupType: string;
    region: string | null;
    visibility: string;
    /** Canonical privacy flag. Falls back to `visibility === "private"`
     *  when migration 167 has not been applied yet. */
    isPrivate: boolean;
    bannerUrl: string | null;
    iconUrl: string | null;
    /** Featured barns sort first and wear the Official stamp (194).
     *  Tolerant: false until the migration is pasted. */
    isFeatured: boolean;
    memberCount: number;
    createdBy: string;
    createdAt: string;
    creatorAlias: string;
    isMember: boolean;
    memberRole: string | null;
    /** For a private barn the viewer is not in: their pending/denied
     *  join request, if any. Null everywhere else. */
    joinRequestStatus: "pending" | "approved" | "denied" | null;
}

/**
 * Barn banners store a storage PATH in banner_url (the profile-banner
 * convention: path in the row, signed URL at read). Tolerant of legacy
 * full URLs and of the avatars bucket being unreachable — a card without
 * its banner beats a directory that will not load.
 */
async function signBarnBanner(
    supabase: Awaited<ReturnType<typeof createClient>>,
    stored: string | null,
): Promise<string | null> {
    if (!stored) return null;
    if (stored.startsWith("http")) return stored;
    try {
        const { data } = await supabase.storage.from("avatars").createSignedUrl(stored, 3600);
        return data?.signedUrl ?? null;
    } catch {
        return null;
    }
}

/** Postgres "column does not exist" — migration 167 not applied yet. */
const UNDEFINED_COLUMN = "42703";
/** Postgres "relation does not exist" — barn_join_requests missing. */
const UNDEFINED_TABLE = "42P01";

/**
 * Untyped view of the Supabase client for the schema migration 167
 * adds (`groups.is_private`, `barn_join_requests`). The generated
 * Database types are regenerated only after the owner pastes the
 * migration, so until then TypeScript does not know these exist.
 * Every call site behind this cast handles the missing-schema error
 * codes above, so a pre-167 database degrades instead of throwing.
 */
function barnDb(client: unknown): SupabaseClient {
    return client as SupabaseClient;
}

function isMissingSchema(error: { code?: string } | null | undefined): boolean {
    return error?.code === UNDEFINED_COLUMN || error?.code === UNDEFINED_TABLE;
}

/** Read privacy off a raw `groups` row, tolerating a pre-167 schema. */
function readIsPrivate(g: Record<string, unknown>): boolean {
    if (typeof g.is_private === "boolean") return g.is_private;
    return g.visibility === "private";
}

// ── CRUD ──

/** Create a barn and auto-add the creator as owner */
export async function createGroup(data: {
    name: string;
    slug: string;
    description?: string;
    groupType: string;
    region?: string;
    visibility?: string;
    isPrivate?: boolean;
    /** Storage path from uploadGroupBanner — stored, signed at read. */
    bannerPath?: string;
}): Promise<{ success: boolean; slug?: string; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (!data.name.trim()) return { success: false, error: "Barn name is required." };

    const slug = data.slug.trim().toLowerCase()
        .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    if (!slug) return { success: false, error: "Valid slug is required." };

    // Check slug uniqueness
    const { data: existing } = await supabase
        .from("groups")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
    if (existing) return { success: false, error: `Slug "${slug}" is already taken.` };

    // isPrivate is canonical; visibility is written too so a pre-167
    // database (no trigger, no column) still records the choice.
    const isPrivate = data.isPrivate ?? data.visibility === "private";
    const base = {
        name: sanitizeText(data.name),
        slug,
        description: data.description?.trim() || null,
        group_type: data.groupType,
        region: data.region?.trim() || null,
        visibility: isPrivate ? "private" : (data.visibility === "private" ? "public" : data.visibility || "public"),
        created_by: user.id,
        member_count: 1,
        // Only a path the uploader could actually write (their own folder)
        // is accepted — anything else is dropped rather than stored.
        banner_url:
            data.bannerPath && data.bannerPath.startsWith(`${user.id}/`)
                ? data.bannerPath
                : null,
    };

    let { data: group, error } = await barnDb(supabase)
        .from("groups")
        .insert({ ...base, is_private: isPrivate })
        .select("id")
        .single();

    // Pre-167 fallback: no is_private column — visibility carries it.
    if (error && isMissingSchema(error)) {
        ({ data: group, error } = await barnDb(supabase)
            .from("groups")
            .insert(base)
            .select("id")
            .single());
    }

    if (error || !group) return { success: false, error: error?.message ?? "Failed to create barn." };

    // Auto-add creator as owner
    await supabase.from("group_memberships").insert({
        group_id: (group as { id: string }).id,
        user_id: user.id,
        role: "owner",
    });

    revalidatePath("/community/groups");
    revalidateTag("groups", "max");
    return { success: true, slug };
}

/** Update a barn's settings (owner/admin only) */
export async function updateBarnSettings(
    groupId: string,
    data: { name?: string; description?: string | null; isPrivate?: boolean },
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { data: membership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

    const role = (membership as { role: string } | null)?.role;
    if (!role || !["owner", "admin"].includes(role)) {
        return { success: false, error: "Only the barn owner or an admin can change settings." };
    }

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) {
        if (!data.name.trim()) return { success: false, error: "Barn name is required." };
        update.name = sanitizeText(data.name);
    }
    if (data.description !== undefined) update.description = data.description?.trim() || null;
    if (data.isPrivate !== undefined) {
        update.is_private = data.isPrivate;
        update.visibility = data.isPrivate ? "private" : "public";
    }
    if (Object.keys(update).length === 0) return { success: true };

    let { error } = await barnDb(supabase).from("groups").update(update).eq("id", groupId);

    // Pre-167 fallback: drop is_private, keep the visibility write.
    if (error && isMissingSchema(error)) {
        delete update.is_private;
        ({ error } = await barnDb(supabase).from("groups").update(update).eq("id", groupId));
    }

    if (error) return { success: false, error: error.message };

    revalidatePath("/community/groups");
    revalidateTag("groups", "max");
    return { success: true };
}

/** Get a barn by slug */
export async function getGroup(slug: string): Promise<Group | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data } = await supabase
        .from("groups")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

    if (!data) return null;

    const g = data as Record<string, unknown>;

    // Get creator alias
    const { data: creator } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", g.created_by as string)
        .single();

    // Check membership
    let isMember = false;
    let memberRole: string | null = null;
    if (user) {
        const { data: membership } = await supabase
            .from("group_memberships")
            .select("role")
            .eq("group_id", g.id as string)
            .eq("user_id", user.id)
            .maybeSingle();
        if (membership) {
            isMember = true;
            memberRole = (membership as { role: string }).role;
        }
    }

    // Get actual member count from group_memberships. A private barn's
    // roster is members-only under 167, so a non-member's count query
    // comes back 0 — fall back to the denormalised member_count so the
    // directory card still shows a believable size.
    const { count: actualMemberCount } = await supabase
        .from("group_memberships")
        .select("*", { count: "exact", head: true })
        .eq("group_id", g.id as string);

    const isPrivate = readIsPrivate(g);

    // Pending/denied join request for a private barn the viewer is outside of.
    let joinRequestStatus: Group["joinRequestStatus"] = null;
    if (user && !isMember && isPrivate) {
        const { data: req } = await barnDb(supabase)
            .from("barn_join_requests")
            .select("status")
            .eq("group_id", g.id as string)
            .eq("user_id", user.id)
            .maybeSingle();
        joinRequestStatus = (req as { status: Group["joinRequestStatus"] } | null)?.status ?? null;
    }

    return {
        id: g.id as string,
        name: g.name as string,
        slug: g.slug as string,
        description: g.description as string | null,
        groupType: g.group_type as string,
        region: g.region as string | null,
        visibility: g.visibility as string,
        isPrivate,
        bannerUrl: await signBarnBanner(supabase, g.banner_url as string | null),
        isFeatured: (g as { is_featured?: boolean }).is_featured === true,
        iconUrl: g.icon_url as string | null,
        memberCount: actualMemberCount || (g.member_count as number) || 0,
        createdBy: g.created_by as string,
        createdAt: g.created_at as string,
        creatorAlias: (creator as { alias_name: string } | null)?.alias_name || "Unknown",
        isMember,
        memberRole,
        joinRequestStatus,
    };
}

/** Browse/search barns */
export async function getGroups(filters?: {
    groupType?: string;
    region?: string;
    search?: string;
}): Promise<Group[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
        .from("groups")
        .select("*, users!groups_created_by_fkey(alias_name)")
        .order("member_count", { ascending: false })
        .limit(50);

    if (filters?.groupType && filters.groupType !== "all") {
        query = query.eq("group_type", filters.groupType);
    }
    if (filters?.region) {
        query = query.ilike("region", `%${filters.region}%`);
    }
    if (filters?.search) {
        const s = sanitizeForOr(filters.search);
        if (s) query = query.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
    }

    const { data } = await query;
    if (!data || data.length === 0) return [];

    // Compute actual member counts from group_memberships
    const groupIds = (data as { id: string }[]).map(g => g.id);
    const memberCountMap = new Map<string, number>();
    if (groupIds.length > 0) {
        const { data: countRows } = await supabase
            .from("group_memberships")
            .select("group_id")
            .in("group_id", groupIds);
        for (const row of (countRows || []) as { group_id: string }[]) {
            memberCountMap.set(row.group_id, (memberCountMap.get(row.group_id) || 0) + 1);
        }
    }

    // Check memberships
    const membershipMap = new Map<string, string>();
    if (user) {
        const { data: memberships } = await supabase
            .from("group_memberships")
            .select("group_id, role")
            .in("group_id", groupIds)
            .eq("user_id", user.id);

        for (const m of (memberships || []) as { group_id: string; role: string }[]) {
            membershipMap.set(m.group_id, m.role);
        }
    }

    // Which private barns has the viewer already asked to join?
    const pendingRequests = new Set<string>();
    if (user) {
        const { data: requests } = await barnDb(supabase)
            .from("barn_join_requests")
            .select("group_id")
            .eq("user_id", user.id)
            .eq("status", "pending")
            .in("group_id", groupIds);
        for (const r of (requests || []) as { group_id: string }[]) pendingRequests.add(r.group_id);
    }

    return await Promise.all((data as Record<string, unknown>[]).map(async (g) => ({
        id: g.id as string,
        name: g.name as string,
        slug: g.slug as string,
        description: g.description as string | null,
        groupType: g.group_type as string,
        region: g.region as string | null,
        visibility: g.visibility as string,
        isPrivate: readIsPrivate(g),
        bannerUrl: await signBarnBanner(supabase, g.banner_url as string | null),
        isFeatured: (g as { is_featured?: boolean }).is_featured === true,
        iconUrl: g.icon_url as string | null,
        memberCount: memberCountMap.get(g.id as string) || (g.member_count as number) || 0,
        createdBy: g.created_by as string,
        createdAt: g.created_at as string,
        creatorAlias: (g as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        isMember: membershipMap.has(g.id as string),
        memberRole: membershipMap.get(g.id as string) || null,
        joinRequestStatus: pendingRequests.has(g.id as string) ? ("pending" as const) : null,
    }))).then((mapped) =>
        // Featured barns first (194), then the existing size order. On a
        // pre-194 database isFeatured is false everywhere, so this sorts
        // exactly as before.
        mapped.sort(
            (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.memberCount - a.memberCount,
        ),
    );
}

/**
 * Join a barn.
 *
 * Public barns join instantly. A **private** barn instead files a
 * request for the owner/admin/moderator to approve — the resolved
 * value carries `pending: true` so the UI can say so.
 */
export async function joinGroup(
    groupId: string,
): Promise<{ success: boolean; pending?: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { data: barn } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .maybeSingle();
    if (!barn) return { success: false, error: "Barn not found." };

    if (readIsPrivate(barn as Record<string, unknown>)) {
        return requestToJoinBarn(groupId);
    }

    const { error } = await supabase.from("group_memberships").insert({
        group_id: groupId,
        user_id: user.id,
        role: "member",
    });

    if (error) {
        if (error.code === "23505") return { success: false, error: "Already a member." };
        return { success: false, error: error.message };
    }

    // Increment member count (best effort)
    try {
        const { error: rpcErr } = await supabase.rpc("increment_count", { table_name: "groups", row_id: groupId, column_name: "member_count" });
        if (rpcErr) {
            // Fallback: manual increment
            const { data: g } = await supabase.from("groups").select("member_count").eq("id", groupId).single();
            if (g) await supabase.from("groups").update({ member_count: ((g as { member_count: number }).member_count || 0) + 1 }).eq("id", groupId);
        }
    } catch (err) { logger.error("Groups", "Background task failed", err); }

    revalidatePath("/community/groups");
    return { success: true };
}

/** Leave a group */
export async function leaveGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Can't leave if you're the owner
    const { data: membership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();

    if ((membership as { role: string } | null)?.role === "owner") {
        return { success: false, error: "Barn owners cannot leave. Transfer ownership first." };
    }

    const { error } = await supabase
        .from("group_memberships")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };

    // Decrement member count (best effort)
    try {
        const { data: g } = await supabase.from("groups").select("member_count").eq("id", groupId).single();
        if (g) await supabase.from("groups").update({ member_count: Math.max(0, ((g as { member_count: number }).member_count || 1) - 1) }).eq("id", groupId);
    } catch (err) { logger.error("Groups", "Background task failed", err); }

    revalidatePath("/community/groups");
    return { success: true };
}

/** Get barns the current user belongs to */
export async function getMyGroups(): Promise<Group[]> {
    const { supabase, user } = await requireAuth();

    const { data: memberships } = await supabase
        .from("group_memberships")
        .select("group_id, role")
        .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) return [];

    const groupIds = (memberships as { group_id: string; role: string }[]).map(m => m.group_id);
    const roleMap = new Map<string, string>();
    for (const m of memberships as { group_id: string; role: string }[]) {
        roleMap.set(m.group_id, m.role);
    }

    const { data: groups } = await supabase
        .from("groups")
        .select("*")
        .in("id", groupIds)
        .order("name");

    if (!groups || groups.length === 0) return [];

    // Compute actual member counts
    const memberCountMap2 = new Map<string, number>();
    if (groupIds.length > 0) {
        const { data: countRows } = await supabase
            .from("group_memberships")
            .select("group_id")
            .in("group_id", groupIds);
        for (const row of (countRows || []) as { group_id: string }[]) {
            memberCountMap2.set(row.group_id, (memberCountMap2.get(row.group_id) || 0) + 1);
        }
    }

    return await Promise.all((groups as Record<string, unknown>[]).map(async (g) => ({
        id: g.id as string,
        name: g.name as string,
        slug: g.slug as string,
        description: g.description as string | null,
        groupType: g.group_type as string,
        region: g.region as string | null,
        visibility: g.visibility as string,
        isPrivate: readIsPrivate(g),
        bannerUrl: await signBarnBanner(supabase, g.banner_url as string | null),
        isFeatured: (g as { is_featured?: boolean }).is_featured === true,
        iconUrl: g.icon_url as string | null,
        memberCount: memberCountMap2.get(g.id as string) || (g.member_count as number) || 0,
        createdBy: g.created_by as string,
        createdAt: g.created_at as string,
        creatorAlias: "",
        isMember: true,
        memberRole: roleMap.get(g.id as string) || "member",
        joinRequestStatus: null,
    })));
}

// ── Private barns: request / approve ──

export interface BarnJoinRequest {
    userId: string;
    alias: string;
    message: string | null;
    createdAt: string;
}

const BARN_STAFF_ROLES = ["owner", "admin", "moderator"];

/** The caller's role in a barn, or null when not a member. */
async function callerRole(
    supabase: Awaited<ReturnType<typeof createClient>>,
    groupId: string,
    userId: string,
): Promise<string | null> {
    const { data } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();
    return (data as { role: string } | null)?.role ?? null;
}

/**
 * Ask the barn's staff to let you in. Idempotent — asking twice
 * leaves one pending row.
 */
export async function requestToJoinBarn(
    groupId: string,
    message?: string,
): Promise<{ success: boolean; pending?: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (await callerRole(supabase, groupId, user.id)) {
        return { success: false, error: "You are already in this barn." };
    }

    const { error } = await barnDb(supabase)
        .from("barn_join_requests")
        .upsert(
            {
                group_id: groupId,
                user_id: user.id,
                message: message?.trim() ? sanitizeText(message) : null,
                status: "pending",
                decided_at: null,
                decided_by: null,
            },
            { onConflict: "group_id,user_id" },
        );

    // Pre-167 database: no requests table. Private barns cannot be
    // joined at all yet rather than silently letting anyone in.
    if (error && isMissingSchema(error)) {
        return { success: false, error: "Private barns aren't open for requests yet. Check back soon." };
    }
    if (error) return { success: false, error: error.message };

    // Best effort: tell the barn's staff someone is at the gate.
    try {
        const [{ data: staff }, { data: actor }, { data: barn }] = await Promise.all([
            supabase.from("group_memberships").select("user_id").eq("group_id", groupId).in("role", BARN_STAFF_ROLES),
            supabase.from("users").select("alias_name").eq("id", user.id).maybeSingle(),
            supabase.from("groups").select("slug, name").eq("id", groupId).maybeSingle(),
        ]);
        const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
        const b = barn as { slug: string; name: string } | null;
        const { createNotification } = await import("@/lib/notifications/createNotification");
        for (const s of ((staff || []) as { user_id: string }[]).slice(0, 25)) {
            await createNotification({
                userId: s.user_id,
                type: "system",
                actorId: user.id,
                content: `@${alias} asked to join ${b?.name ?? "your barn"}`,
                linkUrl: b?.slug ? `/community/groups/${b.slug}` : "/community/groups",
            });
        }
    } catch (err) {
        logger.error("Barns", "Join-request notification failed", err);
    }

    revalidatePath("/community/groups");
    return { success: true, pending: true };
}

/** Withdraw your own pending request. */
export async function cancelBarnJoinRequest(
    groupId: string,
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { error } = await barnDb(supabase)
        .from("barn_join_requests")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", user.id);

    if (error && isMissingSchema(error)) return { success: true };
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/groups");
    return { success: true };
}

/** Pending requests for a barn (staff only). Empty pre-167. */
export async function getBarnJoinRequests(groupId: string): Promise<BarnJoinRequest[]> {
    const { supabase, user } = await requireAuth();

    const role = await callerRole(supabase, groupId, user.id);
    if (!role || !BARN_STAFF_ROLES.includes(role)) return [];

    const { data, error } = await barnDb(supabase)
        .from("barn_join_requests")
        .select("user_id, message, created_at, users!barn_join_requests_user_id_fkey(alias_name)")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

    if (error || !data) return [];

    return (data as Record<string, unknown>[]).map(r => ({
        userId: r.user_id as string,
        alias: (r as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        message: (r.message as string | null) ?? null,
        createdAt: r.created_at as string,
    }));
}

/** Approve or deny a pending request (owner/admin/moderator). */
export async function decideBarnJoinRequest(
    groupId: string,
    targetUserId: string,
    decision: "approved" | "denied",
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const role = await callerRole(supabase, groupId, user.id);
    if (!role || !BARN_STAFF_ROLES.includes(role)) {
        return { success: false, error: "Only barn staff can answer join requests." };
    }

    const { error: updateError } = await barnDb(supabase)
        .from("barn_join_requests")
        .update({ status: decision, decided_at: new Date().toISOString(), decided_by: user.id })
        .eq("group_id", groupId)
        .eq("user_id", targetUserId)
        .eq("status", "pending");

    if (updateError && isMissingSchema(updateError)) {
        return { success: false, error: "Join requests aren't available yet." };
    }
    if (updateError) return { success: false, error: updateError.message };

    if (decision === "approved") {
        const { error: memberError } = await supabase.from("group_memberships").insert({
            group_id: groupId,
            user_id: targetUserId,
            role: "member",
        });
        // 23505 = already a member; treat the approval as done.
        if (memberError && memberError.code !== "23505") {
            return { success: false, error: memberError.message };
        }

        try {
            const { data: g } = await supabase.from("groups").select("member_count").eq("id", groupId).single();
            if (g) await supabase.from("groups").update({ member_count: ((g as { member_count: number }).member_count || 0) + 1 }).eq("id", groupId);
        } catch (err) { logger.error("Barns", "Member count update failed", err); }
    }

    // Best effort: tell the requester either way.
    try {
        const { data: barn } = await supabase.from("groups").select("slug, name").eq("id", groupId).maybeSingle();
        const b = barn as { slug: string; name: string } | null;
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({
            userId: targetUserId,
            type: "system",
            actorId: user.id,
            content: decision === "approved"
                ? `You're in — welcome to ${b?.name ?? "the barn"}!`
                : `Your request to join ${b?.name ?? "that barn"} wasn't accepted.`,
            linkUrl: b?.slug && decision === "approved" ? `/community/groups/${b.slug}` : "/community/groups",
        });
    } catch (err) {
        logger.error("Barns", "Join-decision notification failed", err);
    }

    revalidatePath("/community/groups");
    return { success: true };
}

// ── Group Registry ──

export interface RegistryEntry {
    horseId: string;
    horseName: string;
    ownerAlias: string;
    finishType: string;
    addedAt: string;
}

/** Get the shared horse registry for a barn */
export async function getGroupRegistry(groupId: string): Promise<RegistryEntry[]> {
    const supabase = await createClient();

    // Get group members
    const { data: members } = await supabase
        .from("group_memberships")
        .select("user_id")
        .eq("group_id", groupId);

    if (!members || members.length === 0) return [];

    const memberIds = (members as { user_id: string }[]).map(m => m.user_id);

    // Get public horses owned by group members
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name, finish_type, owner_id, created_at")
        .in("owner_id", memberIds)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(100);

    if (!horses || horses.length === 0) return [];

    // Batch fetch owner aliases
    const ownerIds = [...new Set((horses as { owner_id: string }[]).map(h => h.owner_id))];
    const { data: users } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", ownerIds);

    const aliasMap = new Map<string, string>();
    (users ?? []).forEach((u: { id: string; alias_name: string }) => aliasMap.set(u.id, u.alias_name));

    return (horses as { id: string; custom_name: string; finish_type: string; owner_id: string; created_at: string }[]).map(h => ({
        horseId: h.id,
        horseName: h.custom_name,
        ownerAlias: aliasMap.get(h.owner_id) || "Unknown",
        finishType: h.finish_type,
        addedAt: h.created_at,
    }));
}

// ── Group Files ──

export interface GroupFile {
    id: string;
    fileName: string;
    fileUrl: string;
    /** Fresh signed URL for download, or null if the storage object is missing (legacy rows) */
    downloadUrl: string | null;
    fileSize: number | null;
    fileType: string;
    description: string | null;
    uploadedBy: string;
    uploaderAlias: string;
    createdAt: string;
}

/** Get files uploaded to a barn */
export async function getGroupFiles(groupId: string): Promise<GroupFile[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("group_files")
        .select("*, users!group_files_uploaded_by_fkey(alias_name)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

    if (!data || data.length === 0) return [];

    // Batch-sign download URLs with the admin client (bucket is private and
    // storage RLS only lets uploaders read their own folder — safe here
    // because group_files table RLS already restricted rows to members).
    // Legacy rows whose path has no object in storage simply fail to sign
    // and surface as downloadUrl: null (rendered as unavailable).
    const paths = (data as { file_url: string }[])
        .map(f => f.file_url)
        .filter(url => url.includes("/") && !url.startsWith("http"));

    const signedUrlMap = new Map<string, string>();
    if (paths.length > 0) {
        try {
            const { data: signed } = await getAdminClient().storage
                .from("group-files")
                .createSignedUrls(paths, 3600);
            for (const item of signed ?? []) {
                if (item.signedUrl && item.path) signedUrlMap.set(item.path, item.signedUrl);
            }
        } catch (err) {
            logger.error("Groups", "Failed to sign group file URLs", err);
        }
    }

    return (data as Record<string, unknown>[]).map(f => ({
        id: f.id as string,
        fileName: f.file_name as string,
        fileUrl: f.file_url as string,
        downloadUrl: signedUrlMap.get(f.file_url as string) || null,
        fileSize: f.file_size as number | null,
        fileType: f.file_type as string,
        description: f.description as string | null,
        uploadedBy: f.uploaded_by as string,
        uploaderAlias: (f as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        createdAt: f.created_at as string,
    }));
}

/** Link an uploaded storage object to a group (admin/owner/mod only).
 *  The file bytes must already be in the group-files bucket (client uploads
 *  directly, mirroring the chat-attachments flow in ChatThread). */
export async function uploadGroupFile(
    groupId: string,
    filePath: string,
    fileName: string,
    fileSize: number,
    description?: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify admin/owner/mod role
    const { data: membership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

    const role = (membership as { role: string } | null)?.role;
    if (!role || !["owner", "admin", "moderator"].includes(role)) {
        return { success: false, error: "Only barn admins and moderators can upload files." };
    }

    // The path must point into the caller's own folder for this group —
    // prevents linking a row to someone else's storage object.
    if (!filePath.startsWith(`${user.id}/${groupId}/`)) {
        return { success: false, error: "Invalid file path." };
    }

    if (fileSize > GROUP_FILE_MAX_SIZE) {
        return { success: false, error: "File is too large (max 10MB)." };
    }

    const ext = fileName.split(".").pop()?.toLowerCase() || "file";
    if (!GROUP_FILE_ALLOWED_EXTENSIONS.includes(ext)) {
        return { success: false, error: "File type not allowed. Use PDF, Word, or image files." };
    }
    const fileType = ["pdf"].includes(ext) ? "pdf"
        : ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? "image"
            : ["doc", "docx"].includes(ext) ? "doc"
                : "other";

    const { error } = await supabase.from("group_files").insert({
        group_id: groupId,
        uploaded_by: user.id,
        file_name: fileName,
        file_url: filePath,
        file_size: fileSize,
        file_type: fileType,
        description: description?.trim() || null,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/community/groups");
    return { success: true };
}

/** Delete a barn file */
export async function deleteGroupFile(
    fileId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase } = await requireAuth();

    // Fetch the storage path before deleting the row (RLS limits this to
    // rows the caller can see, and the delete below to uploader/admin/owner)
    const { data: file } = await supabase
        .from("group_files")
        .select("file_url")
        .eq("id", fileId)
        .maybeSingle();

    const { error } = await supabase.from("group_files").delete().eq("id", fileId);
    if (error) return { success: false, error: error.message };

    // Remove the storage object with the admin client — storage RLS only
    // lets the original uploader delete their own folder, but group
    // admins/owners may delete any file (the row delete above already
    // enforced that permission). Legacy rows (bare filenames) have no object.
    const path = (file as { file_url: string } | null)?.file_url;
    if (path && path.includes("/") && !path.startsWith("http")) {
        try {
            await getAdminClient().storage.from("group-files").remove([path]);
        } catch (err) {
            logger.error("Groups", "Failed to remove group file from storage", err);
        }
    }

    revalidatePath("/community/groups");
    return { success: true };
}

// ── Admin Moderation ──

export interface GroupMember {
    userId: string;
    alias: string;
    role: string;
    joinedAt: string;
}

/** Get all members of a barn with roles */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("group_memberships")
        .select("user_id, role, joined_at, users!group_memberships_user_id_fkey(alias_name)")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true });

    if (!data || data.length === 0) return [];

    const rolePriority: Record<string, number> = { owner: 0, admin: 1, moderator: 2, judge: 3, member: 4 };

    return (data as Record<string, unknown>[])
        .map(m => ({
            userId: m.user_id as string,
            alias: (m as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
            role: m.role as string,
            joinedAt: m.joined_at as string,
        }))
        .sort((a, b) => (rolePriority[a.role] ?? 9) - (rolePriority[b.role] ?? 9));
}

/** Update a member's role (owner-only) */
export async function updateMemberRole(
    groupId: string,
    targetUserId: string,
    newRole: "admin" | "moderator" | "member"
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (user.id === targetUserId) return { success: false, error: "Cannot change your own role." };

    // Only owner can promote/demote
    const { data: callerMembership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

    if ((callerMembership as { role: string } | null)?.role !== "owner") {
        return { success: false, error: "Only the barn owner can change roles." };
    }

    const { error } = await supabase
        .from("group_memberships")
        .update({ role: newRole })
        .eq("group_id", groupId)
        .eq("user_id", targetUserId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/community/groups");
    return { success: true };
}

/** Remove a member from a barn (admin/owner) */
export async function removeMember(
    groupId: string,
    targetUserId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (user.id === targetUserId) return { success: false, error: "Use leaveGroup to remove yourself." };

    // Verify caller is owner or admin
    const { data: callerMembership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

    const callerRole = (callerMembership as { role: string } | null)?.role;
    if (!callerRole || !["owner", "admin"].includes(callerRole)) {
        return { success: false, error: "Insufficient permissions." };
    }

    // Cannot remove someone of equal or higher role
    const { data: targetMembership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", targetUserId)
        .maybeSingle();

    const targetRole = (targetMembership as { role: string } | null)?.role;
    if (targetRole === "owner") return { success: false, error: "Cannot remove the owner." };
    if (targetRole === "admin" && callerRole !== "owner") return { success: false, error: "Only the owner can remove admins." };

    const { error } = await supabase
        .from("group_memberships")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", targetUserId);

    if (error) return { success: false, error: error.message };

    // Decrement member count
    try {
        const { data: g } = await supabase.from("groups").select("member_count").eq("id", groupId).single();
        if (g) await supabase.from("groups").update({ member_count: Math.max(0, ((g as { member_count: number }).member_count || 1) - 1) }).eq("id", groupId);
    } catch (err) { logger.error("Groups", "Background task failed", err); }

    revalidatePath("/community/groups");
    return { success: true };
}

/** Toggle pin on a barn post */
export async function togglePinPost(
    postId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Get the post's group_id and current pin state
    const { data: post } = await supabase
        .from("posts")
        .select("group_id, is_pinned")
        .eq("id", postId)
        .maybeSingle();

    if (!post) return { success: false, error: "Post not found." };
    const p = post as { group_id: string | null; is_pinned: boolean };
    if (!p.group_id) return { success: false, error: "Not a barn post." };

    // Verify admin/owner/mod role
    const { data: membership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", p.group_id)
        .eq("user_id", user.id)
        .maybeSingle();

    const role = (membership as { role: string } | null)?.role;
    if (!role || !["owner", "admin", "moderator"].includes(role)) {
        return { success: false, error: "Only barn admins can pin posts." };
    }

    const { error } = await supabase
        .from("posts")
        .update({ is_pinned: !p.is_pinned })
        .eq("id", postId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/community/groups");
    return { success: true };
}

// ── Sub-Channels ──

export interface GroupChannel {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sortOrder: number;
}

/** Get channels for a barn */
export async function getGroupChannels(groupId: string): Promise<GroupChannel[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("group_channels")
        .select("id, name, slug, description, sort_order")
        .eq("group_id", groupId)
        .order("sort_order")
        .order("name");

    if (!data || data.length === 0) return [];

    return (data as { id: string; name: string; slug: string; description: string | null; sort_order: number }[]).map(ch => ({
        id: ch.id,
        name: ch.name,
        slug: ch.slug,
        description: ch.description,
        sortOrder: ch.sort_order,
    }));
}

/** Create a channel in a barn (admin/owner only) */
export async function createGroupChannel(
    groupId: string,
    name: string,
    description?: string
): Promise<{ success: boolean; channelId?: string; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (!name.trim()) return { success: false, error: "Channel name is required." };

    // Verify admin/owner
    const { data: membership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

    const role = (membership as { role: string } | null)?.role;
    if (!role || !["owner", "admin"].includes(role)) {
        return { success: false, error: "Only barn admins can create channels." };
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    const { data: channel, error } = await supabase
        .from("group_channels")
        .insert({
            group_id: groupId,
            name: name.trim(),
            slug: slug || "channel",
            description: description?.trim() || null,
        })
        .select("id")
        .single();

    if (error) {
        if (error.code === "23505") return { success: false, error: "A channel with that name already exists." };
        return { success: false, error: error.message };
    }

    revalidatePath("/community/groups");
    return { success: true, channelId: (channel as { id: string }).id };
}

/** Delete a channel (admin/owner only) */
export async function deleteGroupChannel(
    channelId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Get channel's group and check how many channels exist
    const { data: channel } = await supabase
        .from("group_channels")
        .select("group_id")
        .eq("id", channelId)
        .maybeSingle();

    if (!channel) return { success: false, error: "Channel not found." };
    const groupId = (channel as { group_id: string }).group_id;

    // The doc comment always claimed "admin/owner only" but nothing
    // enforced it — `user` was destructured and never read.
    const role = await callerRole(supabase, groupId, user.id);
    if (!role || !["owner", "admin"].includes(role)) {
        return { success: false, error: "Only barn admins can delete channels." };
    }

    const { count } = await supabase
        .from("group_channels")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId);

    if ((count ?? 0) <= 1) return { success: false, error: "Cannot delete the last channel." };

    const { error } = await supabase.from("group_channels").delete().eq("id", channelId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/groups");
    return { success: true };
}

/**
 * Upload a barn banner image. Mirrors uploadProfileBanner: the file goes
 * to the avatars bucket under the member's own folder (which is what the
 * bucket's RLS permits), and the PATH comes back for createGroup to
 * store — the row holds paths, reads sign them.
 */
export async function uploadGroupBanner(
    formData: FormData,
): Promise<{ success: boolean; path?: string; url?: string; error?: string }> {
    try {
        const { supabase, user } = await requireAuth();
        const file = formData.get("banner");
        if (!(file instanceof File) || file.size === 0) {
            return { success: false, error: "No image selected." };
        }
        if (file.size > 3 * 1024 * 1024) {
            return { success: false, error: "Banner must be under 3MB." };
        }
        if (!file.type.startsWith("image/")) {
            return { success: false, error: "That file isn't an image." };
        }

        const ext = (file.name.split(".").pop() || "webp").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${user.id}/barn_banner_${Date.now()}.${ext || "webp"}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) return { success: false, error: uploadError.message };

        const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrl(path, 3600);

        return { success: true, path, url: signed?.signedUrl };
    } catch (err) {
        if (err instanceof AuthError) return { success: false, error: (err as Error).message };
        return { success: false, error: "Could not upload that image." };
    }
}

/**
 * Set or clear a barn's banner (owner/admin only). The retroactive path —
 * the create form covers new barns, but the two official barns existed
 * before banners did, and "recreate your barn to change its picture" is
 * not an answer anyone should be given.
 */
export async function setGroupBanner(
    groupId: string,
    bannerPath: string | null,
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { data: membership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();
    const role = (membership as { role: string } | null)?.role;
    if (!role || !["owner", "admin"].includes(role)) {
        return { success: false, error: "Only the barn's owner or admins can change the banner." };
    }

    // Same rule as createGroup: only a path the uploader could actually
    // write (their own storage folder) is accepted.
    if (bannerPath !== null && !bannerPath.startsWith(`${user.id}/`)) {
        return { success: false, error: "That image path isn't yours." };
    }

    // Best-effort cleanup of the file being replaced, only when it lives
    // in this member's own folder — never delete another admin's upload.
    const { data: current } = await supabase
        .from("groups")
        .select("banner_url")
        .eq("id", groupId)
        .maybeSingle();
    const oldPath = (current as { banner_url: string | null } | null)?.banner_url;
    if (oldPath && !oldPath.startsWith("http") && oldPath.startsWith(`${user.id}/`) && oldPath !== bannerPath) {
        await supabase.storage.from("avatars").remove([oldPath]);
    }

    const { error } = await supabase
        .from("groups")
        .update({ banner_url: bannerPath })
        .eq("id", groupId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/groups");
    revalidateTag("groups", "max");
    return { success: true };
}
