"use server";

/**
 * Show announcements (Batch 2, v1): a host/co-host broadcast to
 * every current entrant as an in-app notification. No table, no
 * email — the message lives in the notification row itself.
 *
 * Same conventions as shows-v2.ts: zod → requireAuth → explicit
 * role check → typed result. The fan-out itself runs through
 * createNotificationsBulk (admin sink), which also applies each
 * recipient's `show_announcements` pref and the self-guard (the
 * announcing host never pings themself about their own entries).
 */

import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import {
    announceToEntrantsSchema,
    firstZodError,
} from "@/lib/shows/schemas";
import { getAliases, getShowRole } from "@/lib/shows/queries";
import {
    buildAnnouncementPlans,
    deriveAnnouncementRecipients,
} from "@/lib/shows/notifications";
import { createNotificationsBulk } from "@/lib/notifications/createNotification";
import type { StaffRole } from "@/lib/shows/types";

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

const ANNOUNCER_ROLES: StaffRole[] = ["host", "co_host"];

/**
 * Broadcast `message` to the distinct owners of this show's live
 * entries. Returns how many entrants were addressed (the sender's
 * own entries don't count — you don't announce to yourself).
 */
export async function announceToEntrants(
    input: z.input<typeof announceToEntrantsSchema>,
): Promise<ActionResult<{ recipientCount: number }>> {
    const parsed = announceToEntrantsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const { showId, message } = parsed.data;

    const ctx = await getShowRole(supabase, showId, user.id);
    if ("error" in ctx) return { success: false, error: ctx.error };
    if (!ctx.role || !ANNOUNCER_ROLES.includes(ctx.role)) {
        return { success: false, error: "Only the host or a co-host can announce to entrants." };
    }

    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, title")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { success: false, error: showError.message };
    if (!show) return { success: false, error: "Show not found." };

    const { data: entryRows, error: entriesError } = await supabase
        .from("show_class_entries")
        .select("owner_id, status")
        .eq("show_id", showId)
        .order("created_at", { ascending: true });
    if (entriesError) return { success: false, error: entriesError.message };

    const recipients = deriveAnnouncementRecipients(
        (entryRows ?? []).map((e) => ({
            ownerId: e.owner_id as string,
            status: e.status as string,
        })),
    ).filter((ownerId) => ownerId !== user.id);
    if (recipients.length === 0) {
        return { success: true, recipientCount: 0 };
    }

    const aliases = await getAliases(supabase, [user.id]);
    const hostAlias =
        aliases instanceof Map ? (aliases.get(user.id) ?? "unknown") : "unknown";

    await createNotificationsBulk(
        buildAnnouncementPlans({
            showId,
            showTitle: show.title as string,
            hostUserId: user.id,
            hostAlias,
            message,
            recipientIds: recipients,
        }),
    );

    return { success: true, recipientCount: recipients.length };
}
