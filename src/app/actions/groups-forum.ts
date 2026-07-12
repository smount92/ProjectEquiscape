"use server";

/**
 * Groups forum ("Notice Board") server actions.
 *
 * RLS-first: every query runs on the user's client; there is no
 * admin-client use in this file. Each action:
 *   1. zod-parses its input (src/lib/groups/schemas.ts),
 *   2. requireAuth(),
 *   3. explicit group-membership check,
 *   4. returns { success, error? } — never throws for domain errors.
 *
 * NOTE: these actions read posts.title / posts.bumped_at and the
 * group_last_read table from migration 122, which the owner applies
 * manually. Nothing here runs against the DB until then; the whole
 * feature ships behind NEXT_PUBLIC_GROUPS_FORUM.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth";
import { sanitizeText } from "@/lib/utils/validation";
import { resolveAvatarUrls } from "@/lib/utils/avatars.server";
import {
    createThreadSchema,
    firstZodError,
    getGroupBoardSchema,
    getThreadSchema,
    markGroupReadSchema,
    replyToThreadSchema,
} from "@/lib/groups/schemas";
import { compareBoardThreads, deriveThreadTitle, isThreadUnread } from "@/lib/groups/threads";
import type { BoardThread, ThreadPost, ThreadViewData } from "@/lib/groups/types";

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

const BOARD_PAGE_SIZE = 25;
const THREAD_REPLIES_PAGE_SIZE = 100;

/**
 * Reply notifications fan out to the parent author plus every distinct
 * prior replier in the thread ("thread participants"). Capped so one
 * reply in a monster thread can't queue unbounded notification writes.
 */
const PARTICIPANT_NOTIFY_CAP = 25;

/** The viewer's role in a group, or null when not a member. */
async function getMemberRole(
    supabase: SupabaseClient,
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

// ══════════════════════════════════════════════════════════════
// The board
// ══════════════════════════════════════════════════════════════

export async function getGroupBoard(
    input: z.input<typeof getGroupBoardSchema>,
): Promise<ActionResult<{ threads: BoardThread[]; hasMore: boolean }>> {
    const parsed = getGroupBoardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { groupId, channelId, offset } = parsed.data;

    const role = await getMemberRole(supabase, groupId, user.id);
    if (!role) return { success: false, error: "Join this group to see its board." };

    let query = supabase
        .from("posts")
        .select(
            "id, author_id, content, title, channel_id, replies_count, is_pinned, created_at, bumped_at, users!posts_author_id_fkey(alias_name, avatar_url)",
        )
        .eq("group_id", groupId)
        .is("parent_id", null)
        .order("is_pinned", { ascending: false })
        .order("bumped_at", { ascending: false })
        .range(offset, offset + BOARD_PAGE_SIZE); // one extra row → hasMore

    if (channelId) query = query.eq("channel_id", channelId);

    const { data: rows, error } = await query;
    if (error) return { success: false, error: error.message };

    const page = (rows ?? []).slice(0, BOARD_PAGE_SIZE) as Record<string, unknown>[];
    const hasMore = (rows ?? []).length > BOARD_PAGE_SIZE;
    if (page.length === 0) return { success: true, threads: [], hasMore: false };

    // Viewer's last board visit — null row = everything unread.
    const { data: lastReadRow } = await supabase
        .from("group_last_read")
        .select("last_read_at")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();
    const lastReadAt = (lastReadRow as { last_read_at: string } | null)?.last_read_at ?? null;

    // Latest replier per thread, best effort in one query: newest 200
    // replies across the page. A thread whose last reply falls outside
    // that window just shows no "last reply" alias — the bump time on
    // the row still tells the story.
    const withReplies = page.filter((p) => ((p.replies_count as number) || 0) > 0).map((p) => p.id as string);
    const lastReplyAliasByThread = new Map<string, string>();
    if (withReplies.length > 0) {
        const { data: recentReplies } = await supabase
            .from("posts")
            .select("parent_id, created_at, users!posts_author_id_fkey(alias_name)")
            .in("parent_id", withReplies)
            .order("created_at", { ascending: false })
            .limit(200);
        for (const r of (recentReplies ?? []) as Record<string, unknown>[]) {
            const parentId = r.parent_id as string;
            if (!lastReplyAliasByThread.has(parentId)) {
                const u = r.users as { alias_name: string } | null;
                lastReplyAliasByThread.set(parentId, u?.alias_name ?? "Unknown");
            }
        }
    }

    const threads: BoardThread[] = page.map((p) => {
        const author = p.users as { alias_name: string; avatar_url: string | null } | null;
        const bumpedAt = p.bumped_at as string;
        return {
            id: p.id as string,
            displayTitle: deriveThreadTitle(p.title as string | null, p.content as string),
            authorId: p.author_id as string,
            authorAlias: author?.alias_name ?? "Unknown",
            authorAvatarUrl: author?.avatar_url ?? null,
            repliesCount: (p.replies_count as number) || 0,
            lastReplyAlias: lastReplyAliasByThread.get(p.id as string) ?? null,
            lastActivity: bumpedAt,
            isPinned: (p.is_pinned as boolean) || false,
            channelId: (p.channel_id as string | null) ?? null,
            unread: isThreadUnread(bumpedAt, lastReadAt),
            createdAt: p.created_at as string,
        };
    });
    threads.sort(compareBoardThreads);

    // Resolve avatar storage paths → URLs
    const avatarMap = await resolveAvatarUrls(threads.map((t) => t.authorAvatarUrl));
    for (const t of threads) {
        if (t.authorAvatarUrl) t.authorAvatarUrl = avatarMap.get(t.authorAvatarUrl) || t.authorAvatarUrl;
    }

    return { success: true, threads, hasMore };
}

/**
 * Record that the viewer has seen the board as of now. Called on
 * board visit AFTER the unread dots were computed — dots reflect
 * state at load; the next visit sees them cleared.
 */
export async function markGroupRead(
    input: z.input<typeof markGroupReadSchema>,
): Promise<ActionResult> {
    const parsed = markGroupReadSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { groupId } = parsed.data;

    const role = await getMemberRole(supabase, groupId, user.id);
    if (!role) return { success: false, error: "Not a member of this group." };

    const { error } = await supabase
        .from("group_last_read")
        .upsert(
            { group_id: groupId, user_id: user.id, last_read_at: new Date().toISOString() },
            { onConflict: "group_id,user_id" },
        );
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// Thread view
// ══════════════════════════════════════════════════════════════

export async function getThread(
    input: z.input<typeof getThreadSchema>,
): Promise<ActionResult<{ thread: ThreadViewData }>> {
    const parsed = getThreadSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { postId, repliesOffset } = parsed.data;

    const { data: root, error } = await supabase
        .from("posts")
        .select(
            "id, author_id, content, title, parent_id, group_id, channel_id, likes_count, replies_count, is_pinned, created_at, users!posts_author_id_fkey(alias_name, avatar_url)",
        )
        .eq("id", postId)
        .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!root) return { success: false, error: "Thread not found." };

    const r = root as Record<string, unknown>;
    if (r.parent_id || !r.group_id) return { success: false, error: "Thread not found." };

    const role = await getMemberRole(supabase, r.group_id as string, user.id);
    if (!role) return { success: false, error: "Join this group to read its threads." };

    // ALL replies, paginated per-thread — this view is not subject to
    // the global 100-reply cap the flat feed uses across posts.
    const { data: replyRows, error: repliesError } = await supabase
        .from("posts")
        .select("id, author_id, content, likes_count, created_at, users!posts_author_id_fkey(alias_name, avatar_url)")
        .eq("parent_id", postId)
        .order("created_at", { ascending: true })
        .range(repliesOffset, repliesOffset + THREAD_REPLIES_PAGE_SIZE); // one extra → hasMore
    if (repliesError) return { success: false, error: repliesError.message };

    const replyPage = (replyRows ?? []).slice(0, THREAD_REPLIES_PAGE_SIZE) as Record<string, unknown>[];
    const hasMoreReplies = (replyRows ?? []).length > THREAD_REPLIES_PAGE_SIZE;

    // Like state for OP + visible replies in one query
    const likeIds = [postId, ...replyPage.map((p) => p.id as string)];
    const { data: likedRows } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", likeIds);
    const likedSet = new Set(((likedRows ?? []) as { post_id: string }[]).map((l) => l.post_id));

    // Channel name for the breadcrumb
    let channelName: string | null = null;
    if (r.channel_id) {
        const { data: channel } = await supabase
            .from("group_channels")
            .select("name")
            .eq("id", r.channel_id as string)
            .maybeSingle();
        channelName = (channel as { name: string } | null)?.name ?? null;
    }

    const toThreadPost = (p: Record<string, unknown>): ThreadPost => {
        const u = p.users as { alias_name: string; avatar_url: string | null } | null;
        return {
            id: p.id as string,
            authorId: p.author_id as string,
            authorAlias: u?.alias_name ?? "Unknown",
            authorAvatarUrl: u?.avatar_url ?? null,
            content: p.content as string,
            likesCount: (p.likes_count as number) || 0,
            isLikedByMe: likedSet.has(p.id as string),
            createdAt: p.created_at as string,
        };
    };

    const op = toThreadPost(r);
    const replies = replyPage.map(toThreadPost);

    // Resolve avatar storage paths → URLs
    const avatarMap = await resolveAvatarUrls([op.authorAvatarUrl, ...replies.map((x) => x.authorAvatarUrl)]);
    for (const p of [op, ...replies]) {
        if (p.authorAvatarUrl) p.authorAvatarUrl = avatarMap.get(p.authorAvatarUrl) || p.authorAvatarUrl;
    }

    return {
        success: true,
        thread: {
            id: r.id as string,
            groupId: r.group_id as string,
            channelId: (r.channel_id as string | null) ?? null,
            channelName,
            displayTitle: deriveThreadTitle(r.title as string | null, r.content as string),
            isPinned: (r.is_pinned as boolean) || false,
            repliesCount: (r.replies_count as number) || 0,
            op,
            replies,
            hasMoreReplies,
        },
    };
}

// ══════════════════════════════════════════════════════════════
// Writing
// ══════════════════════════════════════════════════════════════

export async function createThread(
    input: z.input<typeof createThreadSchema>,
): Promise<ActionResult<{ threadId: string }>> {
    const parsed = createThreadSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { groupId, channelId, title, content } = parsed.data;

    const role = await getMemberRole(supabase, groupId, user.id);
    if (!role) return { success: false, error: "Join this group to start a thread." };

    // A channel, if given, must belong to this group.
    if (channelId) {
        const { data: channel } = await supabase
            .from("group_channels")
            .select("group_id")
            .eq("id", channelId)
            .maybeSingle();
        if (!channel || (channel as { group_id: string }).group_id !== groupId) {
            return { success: false, error: "Channel not found in this group." };
        }
    }

    const { data: post, error } = await supabase
        .from("posts")
        .insert({
            author_id: user.id,
            content: sanitizeText(content),
            title: sanitizeText(title),
            group_id: groupId,
            channel_id: channelId ?? null,
        })
        .select("id")
        .single();
    if (error || !post) return { success: false, error: error?.message ?? "Failed to create thread." };

    const threadId = (post as { id: string }).id;
    revalidatePath("/community/groups");

    // Deferred: @mentions after the response is sent
    const userId = user.id;
    const trimmed = content.trim();
    after(async () => {
        try {
            const supabaseDeferred = await (await import("@/lib/supabase/server")).createClient();
            const { data: actor } = await supabaseDeferred.from("users").select("alias_name").eq("id", userId).single();
            const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
            const { parseAndNotifyMentions } = await import("@/app/actions/mentions");
            await parseAndNotifyMentions(trimmed, userId, alias, `/community/groups`);
        } catch (err) {
            logger.error("GroupsForum", "Background task failed", err);
        }
    });

    return { success: true, threadId };
}

export async function replyToThread(
    input: z.input<typeof replyToThreadSchema>,
): Promise<ActionResult<{ replyId: string }>> {
    const parsed = replyToThreadSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { postId, content } = parsed.data;

    const { data: parent } = await supabase
        .from("posts")
        .select("id, author_id, parent_id, group_id, title, content")
        .eq("id", postId)
        .maybeSingle();
    if (!parent) return { success: false, error: "Thread not found." };
    const p = parent as { id: string; author_id: string; parent_id: string | null; group_id: string | null; title: string | null; content: string };
    if (p.parent_id || !p.group_id) return { success: false, error: "Thread not found." };

    const role = await getMemberRole(supabase, p.group_id, user.id);
    if (!role) return { success: false, error: "Join this group to reply." };

    // The RPC also bumps the parent's bumped_at (migration 122).
    const { data: replyId, error } = await supabase.rpc("add_post_reply", {
        p_parent_id: postId,
        p_author_id: user.id,
        p_content: sanitizeText(content),
    });
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/groups");

    // Deferred: notify the thread — parent author (existing behavior)
    // PLUS all distinct prior repliers except the actor, forum-standard
    // "thread participants", capped at PARTICIPANT_NOTIFY_CAP.
    const userId = user.id;
    const trimmedContent = content.trim();
    const parentAuthorId = p.author_id;
    const groupId = p.group_id;
    const threadTitle = deriveThreadTitle(p.title, p.content);
    after(async () => {
        try {
            const supabaseDeferred = await (await import("@/lib/supabase/server")).createClient();
            const { data: actor } = await supabaseDeferred.from("users").select("alias_name").eq("id", userId).single();
            const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
            const { createNotification } = await import("@/lib/notifications/createNotification");

            const { data: groupRow } = await supabaseDeferred.from("groups").select("slug").eq("id", groupId).single();
            const slug = (groupRow as { slug: string } | null)?.slug;
            const linkUrl = slug ? `/community/groups/${slug}/thread/${postId}` : "/community/groups";

            // Prior repliers (distinct, excluding the actor and the
            // parent author who gets their own notification below).
            const { data: priorReplies } = await supabaseDeferred
                .from("posts")
                .select("author_id")
                .eq("parent_id", postId)
                .neq("author_id", userId)
                .order("created_at", { ascending: false })
                .limit(200);
            const participantIds = [
                ...new Set(((priorReplies ?? []) as { author_id: string }[]).map((row) => row.author_id)),
            ]
                .filter((id) => id !== parentAuthorId)
                .slice(0, PARTICIPANT_NOTIFY_CAP);

            if (parentAuthorId !== userId) {
                await createNotification({
                    userId: parentAuthorId,
                    type: "reply",
                    actorId: userId,
                    content: `@${alias} replied to your thread "${threadTitle}"`,
                    linkUrl,
                });
            }
            for (const participantId of participantIds) {
                await createNotification({
                    userId: participantId,
                    type: "reply",
                    actorId: userId,
                    content: `@${alias} replied in "${threadTitle}"`,
                    linkUrl,
                });
            }

            const { parseAndNotifyMentions } = await import("@/app/actions/mentions");
            await parseAndNotifyMentions(trimmedContent, userId, alias, linkUrl);
        } catch (err) {
            logger.error("GroupsForum", "Background task failed", err);
        }
    });

    return { success: true, replyId: replyId as string };
}
