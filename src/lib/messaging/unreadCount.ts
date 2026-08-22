import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ONE unread-messages count, shared by every badge on the site.
 *
 * The three call sites (the dashboard sidebar, the client-side
 * NotificationProvider that mounts for every signed-in visitor, and the
 * messaging action) each ran the same two-step: fetch EVERY conversation
 * id the member has ever been part of, then `.in(conversation_id, ids)`.
 * That list only grows — and PostgREST puts `.in()` lists in the query
 * string, so a heavy user eventually builds a URL long enough to be
 * rejected. It was also two pooled round trips for a number.
 *
 * The embedded `conversations!inner` filter does it in one, and the
 * planner has an index for exactly this shape: idx_messages_unread
 * (conversation_id, sender_id) WHERE is_read = false (migration 173),
 * plus idx_conversations_buyer_id / _seller_id (009).
 *
 * `head: true` means no rows travel — only the Content-Range count.
 *
 * The client is passed in because the callers differ (server SSR client,
 * browser client); the query is identical and viewer-scoped either way,
 * so it is never cached.
 */
export async function countUnreadMessages(
    supabase: SupabaseClient,
    userId: string,
): Promise<number> {
    const { count } = await supabase
        .from("messages")
        .select("id, conversations!inner(id)", { count: "exact", head: true })
        .eq("is_read", false)
        .neq("sender_id", userId)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`, {
            referencedTable: "conversations",
        });

    return count ?? 0;
}
