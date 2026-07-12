import "server-only";

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Internal server-only sink: create a notification via the Service Role.
 * Fire-and-forget — must NEVER throw into the parent action/cron.
 *
 * SECURITY: this is intentionally NOT a "use server" action. It is called only
 * by trusted server code — authenticated actions (which pass their own
 * auth.uid() as `actorId`), deferred `after()` tasks, and session-less crons
 * (e.g. achievements-cron). Exposing it as a directly-callable Server Action
 * let any client forge notifications from an arbitrary `actorId` with an
 * attacker-controlled body and deep-link (audit SEC-3). Because trusted crons
 * call it without a session, it must NOT gate on auth.uid() — keeping it
 * server-only (unreachable from the client) is what makes trusting `actorId`
 * safe. Keep `import "server-only"`; do NOT add a "use server" directive.
 */
export async function createNotification(data: {
    userId: string;
    type: string;
    actorId: string;
    content: string;
    horseId?: string;
    conversationId?: string;
    /** Deep-link URL for this notification (e.g. /shows/uuid). Falls back to horse/conversation/actor profile. */
    linkUrl?: string;
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
            link_url: data.linkUrl || null,
        });
    } catch (err) {
        // Fire-and-forget — never fail the parent action
        Sentry.captureException(err, { tags: { domain: "notifications" }, level: "warning" });
        logger.error("Notification", "Failed to create notification");
    }
}
