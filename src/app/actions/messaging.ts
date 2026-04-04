"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendNewMessageNotification } from "@/lib/email";
import { sanitizeText } from "@/lib/utils/validation";
import type { Database } from "@/lib/types/database.generated";

type ConversationInsert = Database["public"]["Tables"]["conversations"]["Insert"];

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

    // Block guard — prevent messaging if either party blocked the other
    const { data: blockCheck } = await supabase
        .from("user_blocks")
        .select("blocker_id")
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${sellerId}),and(blocker_id.eq.${sellerId},blocked_id.eq.${user.id})`)
        .limit(1);
    if (blockCheck && blockCheck.length > 0) {
        return { success: false, error: "Unable to message this user." };
    }

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
    const insertData: ConversationInsert = {
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
 * Send a message in a conversation, optionally with image attachments.
 * Images should already be uploaded to `chat-attachments` bucket by the client.
 */
export async function sendMessage(
    conversationId: string,
    content: string,
    attachments?: { storagePath: string; caption?: string }[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (!content.trim() && (!attachments || attachments.length === 0)) {
        return { success: false, error: "Message cannot be empty." };
    }

    // Guard: max 5 attachments per message
    if (attachments && attachments.length > 5) {
        return { success: false, error: "Maximum 5 images per message." };
    }

    // Insert message
    const { data: message, error } = await supabase
        .from("messages")
        .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: sanitizeText(content || "📷 Sent a photo"),
        })
        .select("id")
        .single<{ id: string }>();

    if (error || !message) return { success: false, error: error?.message || "Failed to send." };

    // Insert media attachments if any
    if (attachments && attachments.length > 0) {
        const mediaInserts = attachments.map((att) => ({
            message_id: message.id,
            uploader_id: user.id,
            storage_path: att.storagePath,
            caption: att.caption || null,
        }));

        const { error: mediaError } = await supabase
            .from("media_attachments")
            .insert(mediaInserts);

        if (mediaError) {
            logger.error("Messaging", "Failed to insert media attachments", mediaError);
        }
    }

    // Update conversation's updated_at
    await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

    // --- Email notification (fire-and-forget) ---
    try {
        const supabaseAdmin = getAdminClient();

        const { data: convo } = await supabaseAdmin
            .from("conversations")
            .select("buyer_id, seller_id, horse_id")
            .eq("id", conversationId)
            .single();

        if (convo) {
            const recipientId =
                convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;

            const [recipientAuth, senderProfile, horseData] = await Promise.all([
                supabaseAdmin.auth.admin.getUserById(recipientId),
                supabaseAdmin
                    .from("users")
                    .select("alias_name")
                    .eq("id", user.id)
                    .single(),
                convo.horse_id
                    ? supabaseAdmin
                        .from("user_horses")
                        .select("custom_name")
                        .eq("id", convo.horse_id)
                        .single()
                    : Promise.resolve({ data: null }),
            ]);

            const recipientEmail = recipientAuth.data?.user?.email;
            const { data: recipientProfile } = await supabaseAdmin
                .from("users")
                .select("alias_name")
                .eq("id", recipientId)
                .single();

            if (recipientEmail) {
                await sendNewMessageNotification({
                    toEmail: recipientEmail,
                    recipientName: recipientProfile?.alias_name || "Collector",
                    senderName: senderProfile?.data?.alias_name || "Someone",
                    horseName: horseData?.data?.custom_name || null,
                    messageSnippet: content.trim() || "📷 Sent a photo",
                    conversationId,
                });
            }
        }
    } catch (emailErr) {
        logger.error("Messaging", "Email notification failed (non-blocking)", emailErr);
    }

    return { success: true, messageId: message.id };
}

/**
 * Fetch all media attachments for messages in a conversation.
 * Returns a record of messageId → attachment signed URLs.
 * Verifies the requesting user is a conversation participant.
 */
export async function getConversationAttachments(
    conversationId: string
): Promise<Record<string, { url: string; caption: string | null }[]>> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    // Verify participant
    const { data: convo } = await supabase
        .from("conversations")
        .select("buyer_id, seller_id")
        .eq("id", conversationId)
        .single();

    if (!convo) return {};
    const c = convo as { buyer_id: string; seller_id: string };
    if (c.buyer_id !== user.id && c.seller_id !== user.id) return {};

    // Get all message IDs
    const { data: msgs } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId);

    if (!msgs || msgs.length === 0) return {};
    const messageIds = msgs.map((m: { id: string }) => m.id);

    // Fetch attachments
    const { data: rawAttachments } = await supabase
        .from("media_attachments")
        .select("message_id, storage_path, caption")
        .in("message_id", messageIds);

    if (!rawAttachments || rawAttachments.length === 0) return {};

    // Batch-sign all attachment URLs
    const storagePaths = (rawAttachments as { storage_path: string }[]).map(a => a.storage_path);
    const { data: signedUrls } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrls(storagePaths, 3600);

    const signedUrlMap = new Map<string, string>();
    if (signedUrls) {
        for (const item of signedUrls) {
            if (item.signedUrl && item.path) {
                signedUrlMap.set(item.path, item.signedUrl);
            }
        }
    }

    // Build result grouped by message_id
    const result: Record<string, { url: string; caption: string | null }[]> = {};
    for (const att of rawAttachments as { message_id: string; storage_path: string; caption: string | null }[]) {
        const signedUrl = signedUrlMap.get(att.storage_path);
        if (signedUrl) {
            if (!result[att.message_id]) result[att.message_id] = [];
            result[att.message_id].push({ url: signedUrl, caption: att.caption });
        }
    }

    return result;
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

/**
 * Mark a conversation's transaction as completed.
 * Either buyer or seller can mark it.
 */
export async function markTransactionComplete(
    conversationId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };

    // Verify user is part of this conversation
    const { data: convo } = await supabase
        .from("conversations")
        .select("buyer_id, seller_id, horse_id")
        .eq("id", conversationId)
        .single();

    if (!convo) return { success: false, error: "Conversation not found." };
    const c = convo as { buyer_id: string; seller_id: string; horse_id: string | null };
    if (c.buyer_id !== user.id && c.seller_id !== user.id) {
        return { success: false, error: "Unauthorized." };
    }

    const { error } = await supabase
        .from("conversations")
        .update({ transaction_status: "completed" })
        .eq("id", conversationId);

    if (error) return { success: false, error: error.message };

    // Create a completed transaction for this marketplace sale (enables reviews)
    try {
        const { createTransaction } = await import("@/app/actions/transactions");
        await createTransaction({
            type: "marketplace_sale",
            partyAId: c.seller_id,
            partyBId: c.buyer_id,
            conversationId,
            horseId: c.horse_id || undefined,
            status: "completed",
        });
    } catch (err) { logger.error("Messaging", "Background task failed", err); }

    return { success: true };
}
