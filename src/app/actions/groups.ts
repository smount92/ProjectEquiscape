"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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
            name: data.name.trim(),
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
        memberCount: g.member_count as number,
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



    // Check memberships
    let membershipMap = new Map<string, string>();
    if (user) {
        const groupIds = (data as { id: string }[]).map(g => g.id);
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
        memberCount: g.member_count as number,
        createdBy: g.created_by as string,
        createdAt: g.created_at as string,
        creatorAlias: (g as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        isMember: membershipMap.has(g.id as string),
        memberRole: membershipMap.get(g.id as string) || null,
    }));
}

/** Join a group */
export async function joinGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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
    } catch { /* best effort */ }

    revalidatePath("/community/groups");
    return { success: true };
}

/** Leave a group */
export async function leaveGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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
    } catch { /* best effort */ }

    revalidatePath("/community/groups");
    return { success: true };
}

/** Get groups the current user belongs to */
export async function getMyGroups(): Promise<Group[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

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
        memberCount: g.member_count as number,
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    if (!content.trim()) return { success: false, error: "Content is required." };

    const { error } = await supabase.from("group_posts").insert({
        group_id: groupId,
        user_id: user.id,
        content: content.trim(),
        horse_id: horseId || null,
    });

    if (error) return { success: false, error: error.message };

    // Fire-and-forget: notify mentions
    const { data: profile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const actorAlias = (profile as { alias_name: string } | null)?.alias_name || "Someone";
    import("@/app/actions/mentions").then((m) => {
        m.parseAndNotifyMentions(content.trim(), user.id, actorAlias, `/community/groups`);
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    if (!content.trim()) return { success: false, error: "Content is required." };

    const { error } = await supabase.from("group_post_replies").insert({
        post_id: postId,
        user_id: user.id,
        content: content.trim(),
    });

    if (error) return { success: false, error: error.message };

    // Increment reply count (best effort)
    try {
        const { data: p } = await supabase.from("group_posts").select("reply_count").eq("id", postId).single();
        if (p) await supabase.from("group_posts").update({ reply_count: ((p as { reply_count: number }).reply_count || 0) + 1 }).eq("id", postId);
    } catch { /* best effort */ }

    revalidatePath("/community/groups");
    return { success: true };
}

// Re-export type labels for UI

/** Delete a group post (owner only) */
export async function deleteGroupPost(postId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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
