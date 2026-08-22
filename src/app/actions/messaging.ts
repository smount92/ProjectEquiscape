"use server";

import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeText } from "@/lib/utils/validation";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import {
    dealDb,
    getDealColumnSupport,
    isMissingSchema,
} from "@/lib/deals/columnSupport";
import type { Database } from "@/lib/types/database.generated";

type ConversationInsert = Database["public"]["Tables"]["conversations"]["Insert"];

/**
 * MESSAGING — the conversational half of the deal room.
 *
 * Plain user-to-user DMs are a first-class thing here, not a degraded
 * deal: the owner talks to his users through them daily. Everything the
 * deal machinery added is additive, and the ordinary path — two people
 * typing at each other — is the one this file protects.
 *
 * What changed in the rebuild, each closing an audited defect:
 *
 *   · Blocking is enforced on SEND, not only on thread creation. The
 *     block dialog promises "They won't be able to message you"; that
 *     promise was false for every existing thread, which is the only
 *     case where blocking matters.
 *   · are_blocked() answers the question in BOTH directions.
 *     blocks_select_own hides the row where someone blocked YOU, so the
 *     old bidirectional .or() could only ever match its first arm.
 *   · Rate limits, using the limiter five other features already use.
 *     Nothing stopped a script opening a thread with every member and
 *     blasting them, each message costing an outbound email.
 *   · A server-side length cap. maxLength={2000} was browser-only.
 *   · The email and the bell moved OFF the write path. One chat message
 *     used to wait on ~9 database round trips and a Resend API call
 *     before the sender's UI could unblock.
 *   · Messages carry a kind, so a photo stops being stored as the
 *     literal string "📷 Sent a photo".
 */

/**
 * The composer's cap, now enforced where it counts. Not exported — a
 * "use server" file may only export async functions.
 */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Have these two blocked each other, in either direction?
 *
 * Prefers the DEFINER function from migration 173; falls back to the
 * one-directional query that is all RLS permits before it is pasted, so
 * behaviour is never worse than today.
 */
async function eitherBlocked(
    supabase: Awaited<ReturnType<typeof createClient>>,
    a: string,
    b: string,
): Promise<boolean> {
    // dealDb: are_blocked lands with migration 173, so it is not in the
    // generated types until the owner pastes it and regenerates.
    const { data, error } = await dealDb(supabase).rpc("are_blocked", {
        p_user_a: a,
        p_user_b: b,
    });
    if (!error && typeof data === "boolean") return data;

    const { data: rows } = await supabase
        .from("user_blocks")
        .select("blocker_id")
        .or(
            `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`,
        )
        .limit(1);
    return !!rows && rows.length > 0;
}

/**
 * Create or find an existing conversation between two members about a
 * specific horse (or about nothing, for a plain DM).
 * Returns the conversation ID to redirect to.
 */
export async function createOrFindConversation(
    sellerId: string,
    horseId: string | null,
    /** Optional opening line. A thread created empty renders as
     *  "No messages yet", which is a dead end for both people. */
    firstMessage?: string,
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (user.id === sellerId) return { success: false, error: "You cannot message yourself." };

    // Block guard — prevent messaging if either party blocked the other
    if (await eitherBlocked(supabase, user.id, sellerId)) {
        return { success: false, error: "Unable to message this user." };
    }

    // Check if a conversation already exists for this pair + horse
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
        if (firstMessage?.trim()) await sendMessage(existing.id, firstMessage);
        return { success: true, conversationId: existing.id };
    }

    // Also check reverse (the other side may have started this thread)
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
        if (firstMessage?.trim()) await sendMessage(reverseExisting.id, firstMessage);
        return { success: true, conversationId: reverseExisting.id };
    }

    // Opening a NEW thread is the expensive, spammable operation — a
    // script could otherwise open one with every member on the platform.
    // Replying inside an existing thread is limited separately, and more
    // generously, in sendMessage.
    const allowed = await checkRateLimit(`new_conversation:${user.id}`, 15, 60, user.id);
    if (!allowed) {
        return {
            success: false,
            error: "You've started a lot of new conversations. Try again in an hour.",
        };
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
            if (retry) {
                if (firstMessage?.trim()) await sendMessage(retry.id, firstMessage);
                return { success: true, conversationId: retry.id };
            }
        }
        return { success: false, error: error.message };
    }

    // Enrol both people. The backfill in 173 covers every historic
    // thread; this covers every new one. Best effort — a missing
    // participant row degrades to the legacy unread path, not a failure.
    await enrolParticipants(supabase, conversation.id, user.id, sellerId);

    if (firstMessage?.trim()) await sendMessage(conversation.id, firstMessage);

    return { success: true, conversationId: conversation.id };
}

/**
 * Enrol both people in a new thread.
 *
 * Roles are deliberately NOT claimed here. A fresh thread is a
 * conversation; if it becomes a deal, the deal names the roles. This is
 * the fix for buyer_id meaning "whoever clicked first" — we stop
 * asserting a role we cannot know.
 */
async function enrolParticipants(
    supabase: Awaited<ReturnType<typeof createClient>>,
    conversationId: string,
    starterId: string,
    otherId: string,
): Promise<void> {
    const { error } = await dealDb(supabase)
        .from("conversation_participants")
        .upsert(
            [
                { conversation_id: conversationId, user_id: starterId, role: "member", party: "b" },
                { conversation_id: conversationId, user_id: otherId, role: "member", party: "a" },
            ],
            { onConflict: "conversation_id,user_id" },
        );
    if (error && !isMissingSchema(error)) {
        logger.warn("Messaging", `Participant enrolment failed: ${error.message}`);
    }
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

    // Server-side length cap. The composer's maxLength is a courtesy;
    // this is the rule.
    if (content.length > MAX_MESSAGE_LENGTH) {
        return {
            success: false,
            error: `Message is too long (max ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters).`,
        };
    }

    // Guard: max 5 attachments per message
    if (attachments && attachments.length > 5) {
        return { success: false, error: "Maximum 5 images per message." };
    }

    // Generous enough that no real conversation notices, tight enough
    // that a script blasting every member costs us nothing.
    const allowed = await checkRateLimit(`send_message:${user.id}`, 60, 5, user.id);
    if (!allowed) {
        return { success: false, error: "You're sending messages very fast. Take a breath." };
    }

    // Who else is in this thread — needed for the block check and for the
    // deferred notification.
    const { data: convoRow } = await supabase
        .from("conversations")
        .select("buyer_id, seller_id, horse_id")
        .eq("id", conversationId)
        .maybeSingle();
    const convo = convoRow as {
        buyer_id: string;
        seller_id: string;
        horse_id: string | null;
    } | null;
    if (!convo) return { success: false, error: "Conversation not found." };

    const recipientId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;

    // ENFORCED ON SEND, not just on thread creation. Migration 173 also
    // enforces this at the database, so a caller bypassing this action
    // still cannot get through.
    if (await eitherBlocked(supabase, user.id, recipientId)) {
        return { success: false, error: "You can no longer message this person." };
    }

    const hasPhotos = !!attachments && attachments.length > 0;
    const body = sanitizeText(content || "📷 Sent a photo");

    // Typed insert first; fall back to the pre-173 shape on a database
    // where the columns don't exist yet.
    let messageId: string | null = null;
    {
        const { data, error } = await dealDb(supabase)
            .from("messages")
            .insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: body,
                kind: hasPhotos ? "photo" : "chat",
            })
            .select("id")
            .single();

        if (!error && data) {
            messageId = (data as { id: string }).id;
        } else if (error && isMissingSchema(error)) {
            const { data: legacy, error: legacyError } = await supabase
                .from("messages")
                .insert({
                    conversation_id: conversationId,
                    sender_id: user.id,
                    content: body,
                })
                .select("id")
                .single<{ id: string }>();
            if (legacyError || !legacy) {
                return { success: false, error: legacyError?.message || "Failed to send." };
            }
            messageId = legacy.id;
        } else {
            // The block guard trigger surfaces here as a raised exception.
            return { success: false, error: error?.message || "Failed to send." };
        }
    }

    // Insert media attachments if any
    if (attachments && attachments.length > 0) {
        const mediaInserts = attachments.map((att) => ({
            message_id: messageId,
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

    // Keep the thread's ordering column fresh on a pre-173 database. With
    // 173 pasted, trg_messages_touch_conversation has already done it —
    // and does it for every write path, including the ones this file
    // doesn't know about.
    const support = await getDealColumnSupport(supabase);
    if (!support.conversationDeal) {
        await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
    }

    // ── Notifications, OFF the write path ──
    // A chat message used to wait on ~9 database round trips and a Resend
    // API call before the composer unblocked. Everything below now runs
    // after the response is sent.
    const senderId = user.id;
    const snippet = content.trim() || "📷 Sent a photo";
    const horseId = convo.horse_id;

    after(async () => {
        try {
            const supabaseAdmin = getAdminClient();

            const [recipientAuth, senderProfile, recipientProfile, horseData] = await Promise.all([
                supabaseAdmin.auth.admin.getUserById(recipientId),
                supabaseAdmin.from("users").select("alias_name").eq("id", senderId).single(),
                supabaseAdmin.from("users").select("alias_name").eq("id", recipientId).single(),
                horseId
                    ? supabaseAdmin
                          .from("user_horses")
                          .select("custom_name")
                          .eq("id", horseId)
                          .single()
                    : Promise.resolve({ data: null }),
            ]);

            const senderAlias =
                (senderProfile?.data as { alias_name?: string } | null)?.alias_name || "Someone";

            // In-app bell. Prefs-gated, self-guarded, deep-links the thread.
            // createNotification is server-only — dynamic import inside the
            // try/catch, never a static one.
            const { createNotification } = await import(
                "@/lib/notifications/createNotification"
            );
            await createNotification({
                userId: recipientId,
                type: "message",
                actorId: senderId,
                content: `@${senderAlias} sent you a message`,
                conversationId,
                linkUrl: `/inbox/${conversationId}`,
            });

            // Email, only if they haven't muted the thread.
            if (await isThreadMuted(supabaseAdmin, conversationId, recipientId)) return;

            const recipientEmail = recipientAuth.data?.user?.email;
            if (!recipientEmail) return;

            const { sendNewMessageNotification } = await import("@/lib/email");
            await sendNewMessageNotification({
                toEmail: recipientEmail,
                recipientName:
                    (recipientProfile?.data as { alias_name?: string } | null)?.alias_name ||
                    "Collector",
                senderName: senderAlias,
                horseName:
                    (horseData?.data as { custom_name?: string } | null)?.custom_name || null,
                messageSnippet: snippet,
                conversationId,
            });
        } catch (err) {
            Sentry.captureException(err, { tags: { domain: "messaging" }, level: "warning" });
            logger.error("Messaging", "Deferred notification failed (non-blocking)", err);
        }
    });

    return { success: true, messageId: messageId ?? undefined };
}

/** Has this person muted the thread? Absent table ⇒ not muted. */
async function isThreadMuted(
    admin: ReturnType<typeof getAdminClient>,
    conversationId: string,
    userId: string,
): Promise<boolean> {
    const { data, error } = await dealDb(admin)
        .from("conversation_participants")
        .select("muted")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
    if (error || !data) return false;
    return (data as { muted: boolean }).muted === true;
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

    // Batch-sign all attachment URLs using admin client
    // (user-scoped client can only read own folder; admin bypasses storage RLS
    //  — safe because we already verified conversation membership above)
    const storagePaths = (rawAttachments as { storage_path: string }[]).map(a => a.storage_path);
    const supabaseAdmin = getAdminClient();
    const { data: signedUrls } = await supabaseAdmin.storage
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
 * Mark a conversation read for the current user.
 *
 * Now a real action with a real caller, rather than dead code sitting
 * next to a page that marked messages read as a side effect of
 * rendering. Writes the participant row (the single source of unread
 * truth) and keeps the legacy boolean in step.
 */
export async function markConversationRead(
    conversationId: string
): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false };

    const now = new Date().toISOString();
    const { error } = await dealDb(supabase)
        .from("conversation_participants")
        .upsert(
            { conversation_id: conversationId, user_id: user.id, last_read_at: now },
            { onConflict: "conversation_id,user_id" },
        );
    if (error && !isMissingSchema(error)) {
        logger.warn("Messaging", `Read-mark failed: ${error.message}`);
    }

    await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .eq("is_read", false);

    return { success: true };
}

// getUnreadCount() lived here: a per-conversation COUNT fan-out with a
// "fetch all conversation ids, then .in()" fallback — and ZERO callers.
// Every badge on the site now goes through countUnreadMessages()
// (src/lib/messaging/unreadCount.ts), one index-backed embedded count.
// Deleted rather than fixed so nothing adopts the slow shape by accident.

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
