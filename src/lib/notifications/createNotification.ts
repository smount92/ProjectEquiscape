import "server-only";

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { getAdminClient } from "@/lib/supabase/admin";
import { isNotificationTypeEnabled, type NotificationPrefs } from "./prefs";

/**
 * Internal server-only sink: create notifications via the Service Role.
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
export interface NotificationInput {
    userId: string;
    type: string;
    /**
     * The user whose ACTION caused this notification — or null/omitted for
     * system-generated events (results publishes, card mints, crons).
     * Self-guard: a row whose actorId equals its userId is suppressed (your
     * own like never pings you); system events (no actor) always deliver.
     * The old signature required an actorId, so system call sites passed the
     * RECIPIENT as actor and every one of those rows was silently dropped.
     */
    actorId?: string | null;
    content: string;
    horseId?: string;
    conversationId?: string;
    /** Deep-link URL for this notification (e.g. /shows/uuid). Falls back to horse/conversation/actor profile. */
    linkUrl?: string;
}

/** Rows per bulk insert — fan-outs beyond this are truncated (and logged). */
export const BULK_NOTIFICATION_CAP = 500;

/** A user action never notifies its own actor; system rows (no actor) pass. */
function isSelfNotification(row: { userId: string; actorId?: string | null }): boolean {
    return !!row.actorId && row.actorId === row.userId;
}

function toInsertRow(row: NotificationInput) {
    return {
        user_id: row.userId,
        type: row.type,
        actor_id: row.actorId ?? null,
        content: row.content,
        horse_id: row.horseId || null,
        conversation_id: row.conversationId || null,
        link_url: row.linkUrl || null,
    };
}

/** Load notification_prefs for a set of users in one query. */
async function loadPrefs(userIds: string[]): Promise<Map<string, NotificationPrefs>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, notification_prefs")
        .in("id", unique);
    if (error) throw new Error(error.message);
    return new Map(
        (data ?? []).map((r: { id: string; notification_prefs: unknown }) => [
            r.id,
            (r.notification_prefs as NotificationPrefs) ?? null,
        ]),
    );
}

export async function createNotification(data: NotificationInput): Promise<void> {
    try {
        if (isSelfNotification(data)) return;

        // Honor the recipient's notification_prefs — an explicit false on
        // the mapped key mutes the type; anything else (missing key, no
        // prefs, unmapped type) delivers.
        const prefs = await loadPrefs([data.userId]);
        if (!isNotificationTypeEnabled(data.type, prefs.get(data.userId) ?? null)) return;

        const supabaseAdmin = getAdminClient();
        await supabaseAdmin.from("notifications").insert(toInsertRow(data));
    } catch (err) {
        // Fire-and-forget — never fail the parent action
        Sentry.captureException(err, { tags: { domain: "notifications" }, level: "warning" });
        logger.error("Notification", "Failed to create notification");
    }
}

/**
 * Bulk variant for fan-outs (show results, announcements, deadline
 * nudges): ONE prefs query over all recipients and ONE insert, instead
 * of a per-recipient round-trip storm. Same per-row semantics as
 * createNotification (self-guard, prefs gate); capped at
 * BULK_NOTIFICATION_CAP rows. Returns the number of rows inserted —
 * 0 on failure (fire-and-forget, never throws).
 */
export async function createNotificationsBulk(
    rows: NotificationInput[],
): Promise<number> {
    try {
        let candidates = rows.filter((row) => !isSelfNotification(row));
        if (candidates.length === 0) return 0;
        if (candidates.length > BULK_NOTIFICATION_CAP) {
            logger.warn(
                "Notification",
                `Bulk fan-out of ${candidates.length} rows truncated to ${BULK_NOTIFICATION_CAP}`,
            );
            candidates = candidates.slice(0, BULK_NOTIFICATION_CAP);
        }

        const prefs = await loadPrefs(candidates.map((row) => row.userId));
        const deliverable = candidates.filter((row) =>
            isNotificationTypeEnabled(row.type, prefs.get(row.userId) ?? null),
        );
        if (deliverable.length === 0) return 0;

        const supabaseAdmin = getAdminClient();
        const { error } = await supabaseAdmin
            .from("notifications")
            .insert(deliverable.map(toInsertRow));
        if (error) throw new Error(error.message);
        return deliverable.length;
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "notifications" }, level: "warning" });
        logger.error("Notification", "Failed to create bulk notifications");
        return 0;
    }
}
