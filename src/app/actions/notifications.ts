"use server";

import { createClient } from "@/lib/supabase/server";

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
    linkUrl: string | null;
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
        .select("id, type, content, actor_id, horse_id, conversation_id, link_url, is_read, created_at, users!actor_id(alias_name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

    const notifs = rawNotifs ?? [];

    if (notifs.length === 0) return [];

    return notifs.map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        actorAlias: n.users?.alias_name || null,
        horseId: n.horse_id,
        conversationId: n.conversation_id,
        linkUrl: n.link_url,
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
