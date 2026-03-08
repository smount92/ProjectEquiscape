"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Get the count of unread notifications for the current user.
 */
export async function getUnreadNotificationCount(): Promise<number> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

    return count ?? 0;
}

interface NotificationDisplay {
    id: string;
    type: string;
    content: string | null;
    actorAlias: string | null;
    horseId: string | null;
    conversationId: string | null;
    isRead: boolean;
    createdAt: string;
}

/**
 * Get notifications for the current user, newest first.
 */
export async function getNotifications(
    limit: number = 50
): Promise<NotificationDisplay[]> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: rawNotifs } = await supabase
        .from("notifications")
        .select("id, type, content, actor_id, horse_id, conversation_id, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

    const notifs = (rawNotifs ?? []) as {
        id: string;
        type: string;
        content: string | null;
        actor_id: string | null;
        horse_id: string | null;
        conversation_id: string | null;
        is_read: boolean;
        created_at: string;
    }[];

    if (notifs.length === 0) return [];

    // Batch-fetch actor aliases
    const actorIds = [...new Set(notifs.map((n) => n.actor_id).filter(Boolean))] as string[];
    const aliasMap = new Map<string, string>();
    if (actorIds.length > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", actorIds);
        users?.forEach((u: { id: string; alias_name: string }) => {
            aliasMap.set(u.id, u.alias_name);
        });
    }

    return notifs.map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        actorAlias: n.actor_id ? aliasMap.get(n.actor_id) || null : null,
        horseId: n.horse_id,
        conversationId: n.conversation_id,
        isRead: n.is_read,
        createdAt: n.created_at,
    }));
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
    notificationId: string
): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
    return { success: !error };
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false };

    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

    return { success: !error };
}

/**
 * Delete all notifications for the current user.
 */
export async function clearNotifications(): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false };

    const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

    return { success: !error };
}

/**
 * Internal: Create a notification using Service Role (fire-and-forget).
 * Called from other server actions. Should NEVER cause the parent action to fail.
 */
export async function createNotification(data: {
    userId: string;
    type: string;
    actorId: string;
    content: string;
    horseId?: string;
    conversationId?: string;
}): Promise<void> {
    try {
        // Don't notify yourself
        if (data.userId === data.actorId) return;

        const supabaseAdmin = getAdminClient();

        await supabaseAdmin.from("notifications").insert({
            user_id: data.userId,
            type: data.type,
            actor_id: data.actorId,
            content: data.content,
            horse_id: data.horseId || null,
            conversation_id: data.conversationId || null,
        });
    } catch {
        // Fire-and-forget — never fail the parent action
        console.error("[Notification] Failed to create notification");
    }
}
