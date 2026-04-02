"use server";

import { logger } from "@/lib/logger";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { sanitizeText } from "@/lib/utils/validation";

// ============================================================
// GROUPS — Server Actions
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
    bannerUrl: string | null;
    iconUrl: string | null;
    memberCount: number;
    createdBy: string;
    createdAt: string;
    creatorAlias: string;
    isMember: boolean;
    memberRole: string | null;
}

export interface GroupPost {
    id: string;
    groupId: string;
    userId: string;
    userAlias: string;
    content: string;
    horseId: string | null;
    horseName: string | null;
    imageUrls: string[];
    isPinned: boolean;
    likesCount: number;
    replyCount: number;
    createdAt: string;
    replies: GroupPostReply[];
}

export interface GroupPostReply {
    id: string;
    postId: string;
    userId: string;
    userAlias: string;
    content: string;
    createdAt: string;
}



// ── CRUD ──

/** Create a group and auto-add creator as owner */
export async function createGroup(data: {
    name: string;
    slug: string;
    description?: string;
    groupType: string;
    region?: string;
    visibility?: string;
}): Promise<{ success: boolean; slug?: string; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (!data.name.trim()) return { success: false, error: "Group name is required." };

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

    // Create group
    const { data: group, error } = await supabase
        .from("groups")
        .insert({
            name: sanitizeText(data.name),
            slug,
            description: data.description?.trim() || null,
            group_type: data.groupType,
            region: data.region?.trim() || null,
            visibility: data.visibility || "public",
            created_by: user.id,
            member_count: 1,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

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

/** Get group by slug */
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

    // Get actual member count from group_memberships
    const { count: actualMemberCount } = await supabase
        .from("group_memberships")
        .select("*", { count: "exact", head: true })
        .eq("group_id", g.id as string);

    return {
        id: g.id as string,
        name: g.name as string,
        slug: g.slug as string,
        description: g.description as string | null,
        groupType: g.group_type as string,
        region: g.region as string | null,
        visibility: g.visibility as string,
        bannerUrl: g.banner_url as string | null,
        iconUrl: g.icon_url as string | null,
        memberCount: actualMemberCount ?? (g.member_count as number) ?? 0,
        createdBy: g.created_by as string,
        createdAt: g.created_at as string,
        creatorAlias: (creator as { alias_name: string } | null)?.alias_name || "Unknown",
        isMember,
        memberRole,
    };
}

/** Browse/search groups */
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
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
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
    let membershipMap = new Map<string, string>();
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

    return (data as Record<string, unknown>[]).map(g => ({
        id: g.id as string,
        name: g.name as string,
        slug: g.slug as string,
        description: g.description as string | null,
        groupType: g.group_type as string,
        region: g.region as string | null,
        visibility: g.visibility as string,
        bannerUrl: g.banner_url as string | null,
        iconUrl: g.icon_url as string | null,
        memberCount: memberCountMap.get(g.id as string) || (g.member_count as number) || 0,
        createdBy: g.created_by as string,
        createdAt: g.created_at as string,
        creatorAlias: (g as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        isMember: membershipMap.has(g.id as string),
        memberRole: membershipMap.get(g.id as string) || null,
    }));
}

/** Join a group */
export async function joinGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

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
        return { success: false, error: "Owners cannot leave. Transfer ownership first." };
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

/** Get groups the current user belongs to */
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

    return (groups as Record<string, unknown>[]).map(g => ({
        id: g.id as string,
        name: g.name as string,
        slug: g.slug as string,
        description: g.description as string | null,
        groupType: g.group_type as string,
        region: g.region as string | null,
        visibility: g.visibility as string,
        bannerUrl: g.banner_url as string | null,
        iconUrl: g.icon_url as string | null,
        memberCount: memberCountMap2.get(g.id as string) || (g.member_count as number) || 0,
        createdBy: g.created_by as string,
        createdAt: g.created_at as string,
        creatorAlias: "",
        isMember: true,
        memberRole: roleMap.get(g.id as string) || "member",
    }));
}

// ── Group Posts ──

/** Post in a group */
export async function createGroupPost(
    groupId: string,
    content: string,
    horseId?: string,
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (!content.trim()) return { success: false, error: "Content is required." };

    const { error } = await supabase.from("group_posts").insert({
        group_id: groupId,
        user_id: user.id,
        content: sanitizeText(content),
        horse_id: horseId || null,
    });

    if (error) return { success: false, error: error.message };

    // Deferred: notify mentions after response is sent
    const { data: profile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const actorAlias = (profile as { alias_name: string } | null)?.alias_name || "Someone";
    const userId = user.id;
    const trimmed = content.trim();
    after(async () => {
        try {
            const { parseAndNotifyMentions } = await import("@/app/actions/mentions");
            await parseAndNotifyMentions(trimmed, userId, actorAlias, `/community/groups`);
        } catch (err) { logger.error("Groups", "Background task failed", err); }
    });

    revalidatePath(`/community/groups`);
    return { success: true };
}

/** Get group feed */
export async function getGroupPosts(groupId: string): Promise<GroupPost[]> {
    const supabase = await createClient();

    const { data: posts } = await supabase
        .from("group_posts")
        .select("*, users!group_posts_user_id_fkey(alias_name)")
        .eq("group_id", groupId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

    if (!posts || posts.length === 0) return [];



    // Fetch horse names if any
    const horseIds = (posts as { horse_id: string | null }[])
        .map(p => p.horse_id)
        .filter(Boolean) as string[];
    const horseNameMap = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: horses } = await supabase
            .from("user_horses")
            .select("id, custom_name")
            .in("id", horseIds);
        (horses || []).forEach((h: { id: string; custom_name: string }) => horseNameMap.set(h.id, h.custom_name));
    }

    // Fetch replies
    const postIds = (posts as { id: string }[]).map(p => p.id);
    const { data: replies } = await supabase
        .from("group_post_replies")
        .select("*, users!group_post_replies_user_id_fkey(alias_name)")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });



    const repliesByPost = new Map<string, GroupPostReply[]>();
    for (const r of (replies || []) as Record<string, unknown>[]) {
        const postId = r.post_id as string;
        if (!repliesByPost.has(postId)) repliesByPost.set(postId, []);
        repliesByPost.get(postId)!.push({
            id: r.id as string,
            postId,
            userId: r.user_id as string,
            userAlias: (r as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
            content: r.content as string,
            createdAt: r.created_at as string,
        });
    }

    return (posts as Record<string, unknown>[]).map(p => ({
        id: p.id as string,
        groupId: p.group_id as string,
        userId: p.user_id as string,
        userAlias: (p as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        content: p.content as string,
        horseId: p.horse_id as string | null,
        horseName: p.horse_id ? (horseNameMap.get(p.horse_id as string) || null) : null,
        imageUrls: (p.image_urls as string[]) || [],
        isPinned: p.is_pinned as boolean,
        likesCount: p.likes_count as number,
        replyCount: p.reply_count as number,
        createdAt: p.created_at as string,
        replies: repliesByPost.get(p.id as string) || [],
    }));
}

/** Reply to a group post */
export async function replyToPost(postId: string, content: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (!content.trim()) return { success: false, error: "Content is required." };

    const { error } = await supabase.from("group_post_replies").insert({
        post_id: postId,
        user_id: user.id,
        content: sanitizeText(content),
    });

    if (error) return { success: false, error: error.message };

    // Increment reply count (best effort)
    try {
        const { data: p } = await supabase.from("group_posts").select("reply_count").eq("id", postId).single();
        if (p) await supabase.from("group_posts").update({ reply_count: ((p as { reply_count: number }).reply_count || 0) + 1 }).eq("id", postId);
    } catch (err) { logger.error("Groups", "Background task failed", err); }

    revalidatePath("/community/groups");
    return { success: true };
}

// Re-export type labels for UI

/** Delete a group post (owner only) */
export async function deleteGroupPost(postId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { data: post } = await supabase
        .from("group_posts")
        .select("id")
        .eq("id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (!post) return { success: false, error: "Post not found or not yours." };

    // Delete replies first
    await supabase.from("group_post_replies").delete().eq("post_id", postId);
    const { error } = await supabase.from("group_posts").delete().eq("id", postId);
    if (error) return { success: false, error: error.message };

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

/** Get the shared horse registry for a group */
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
    fileSize: number | null;
    fileType: string;
    description: string | null;
    uploadedBy: string;
    uploaderAlias: string;
    createdAt: string;
}

/** Get files uploaded to a group */
export async function getGroupFiles(groupId: string): Promise<GroupFile[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("group_files")
        .select("*, users!group_files_uploaded_by_fkey(alias_name)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

    if (!data || data.length === 0) return [];

    return (data as Record<string, unknown>[]).map(f => ({
        id: f.id as string,
        fileName: f.file_name as string,
        fileUrl: f.file_url as string,
        fileSize: f.file_size as number | null,
        fileType: f.file_type as string,
        description: f.description as string | null,
        uploadedBy: f.uploaded_by as string,
        uploaderAlias: (f as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        createdAt: f.created_at as string,
    }));
}

/** Upload a file to a group (admin/owner/mod only) */
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
        return { success: false, error: "Only admins and moderators can upload files." };
    }

    const ext = fileName.split(".").pop()?.toLowerCase() || "file";
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

/** Delete a group file */
export async function deleteGroupFile(
    fileId: string
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Fetch the file URL before deleting the row
    try {
        const { data: file } = await supabase
            .from("group_files")
            .select("file_url")
            .eq("id", fileId)
            .maybeSingle();

        if (file) {
            const url = (file as { file_url: string }).file_url;
            const match = url.match(/horse-images\/(.+?)(\?|$)/);
            if (match) {
                await supabase.storage.from("horse-images").remove([match[1]]);
            }
        }
    } catch (err) { logger.error("Groups", "Background task failed", err); }

    const { error } = await supabase.from("group_files").delete().eq("id", fileId);
    if (error) return { success: false, error: error.message };

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

/** Get all members of a group with roles */
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
        return { success: false, error: "Only the group owner can change roles." };
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

/** Remove a member from a group (admin/owner) */
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

/** Toggle pin on a group post */
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
    if (!p.group_id) return { success: false, error: "Not a group post." };

    // Verify admin/owner/mod role
    const { data: membership } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", p.group_id)
        .eq("user_id", user.id)
        .maybeSingle();

    const role = (membership as { role: string } | null)?.role;
    if (!role || !["owner", "admin", "moderator"].includes(role)) {
        return { success: false, error: "Only admins can pin posts." };
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

/** Get channels for a group */
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

/** Create a channel in a group (admin/owner only) */
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
        return { success: false, error: "Only admins can create channels." };
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
