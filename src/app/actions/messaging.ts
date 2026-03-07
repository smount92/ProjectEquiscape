"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Create or find an existing conversation between buyer and seller for a specific horse.
 * Returns the conversation ID to redirect to.
 */
export async function createOrFindConversation(
    sellerId: string,
    horseId: string | null
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (user.id === sellerId) return { success: false, error: "You cannot message yourself." };

    // Check if a conversation already exists for this buyer+seller+horse
    let query = supabase
        .from("conversations")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("seller_id", sellerId);

    if (horseId) {
        query = query.eq("horse_id", horseId);
    } else {
        query = query.is("horse_id", null);
    }

    const { data: existing } = await query.maybeSingle<{ id: string }>();

    if (existing) {
        return { success: true, conversationId: existing.id };
    }

    // Also check reverse (seller might have started conversation with us about same horse)
    let reverseQuery = supabase
        .from("conversations")
        .select("id")
        .eq("buyer_id", sellerId)
        .eq("seller_id", user.id);

    if (horseId) {
        reverseQuery = reverseQuery.eq("horse_id", horseId);
    } else {
        reverseQuery = reverseQuery.is("horse_id", null);
    }

    const { data: reverseExisting } = await reverseQuery.maybeSingle<{ id: string }>();

    if (reverseExisting) {
        return { success: true, conversationId: reverseExisting.id };
    }

    // Create new conversation
    const insertData: Record<string, unknown> = {
        buyer_id: user.id,
        seller_id: sellerId,
    };
    if (horseId) insertData.horse_id = horseId;

    const { data: conversation, error } = await supabase
        .from("conversations")
        .insert(insertData)
        .select("id")
        .single<{ id: string }>();

    if (error) {
        // Handle unique constraint violation (race condition)
        if (error.code === "23505") {
            const { data: retry } = await query.single<{ id: string }>();
            if (retry) return { success: true, conversationId: retry.id };
        }
        return { success: false, error: error.message };
    }

    return { success: true, conversationId: conversation.id };
}

/**
 * Send a message in a conversation.
 */
export async function sendMessage(
    conversationId: string,
    content: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (!content.trim()) return { success: false, error: "Message cannot be empty." };

    // Insert message
    const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim(),
    });

    if (error) return { success: false, error: error.message };

    // Update conversation's updated_at
    await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

    return { success: true };
}

/**
 * Mark all unread messages in a conversation as read (for the current user).
 */
export async function markConversationRead(
    conversationId: string
): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false };

    await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .eq("is_read", false);

    return { success: true };
}

/**
 * Get unread message count for the current user.
 */
export async function getUnreadCount(): Promise<number> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return 0;

    // Get all conversation IDs where user is a participant
    const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    if (!convos || convos.length === 0) return 0;

    const convoIds = convos.map((c: { id: string }) => c.id);

    const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .neq("sender_id", user.id)
        .eq("is_read", false);

    return count ?? 0;
}
