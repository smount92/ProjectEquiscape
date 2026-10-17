import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { getAdminClient } from "@/lib/supabase/admin";
import type { CountableVoters } from "@/lib/registry/rules";
import { seatIsActive } from "@/lib/registry/types";

/**
 * Telling the owner about Registry work (owner answers 4 and 5,
 * 2026-10-16). Everyday work goes into the daily digest; these go at
 * once: merges requested and applied, removals, a moderator hitting a
 * daily limit or the speed alarm, and one moderator undoing another.
 */
export type AlertKind = "merge_requested" | "merge_applied" | "removal" | "limit_hit" | "speed" | "undo_other";

/** A bell notification to the owner (and any role = 'admin' account). Never throws. */
export async function alertOwner(kind: AlertKind, text: string, link: string): Promise<void> {
    try {
        const { adminNotificationTargets } = await import("@/lib/notifications/adminTargets");
        const { createNotification } = await import("@/lib/notifications/createNotification");
        const ids = await adminNotificationTargets(getAdminClient());
        for (const userId of ids) {
            await createNotification({ userId, type: "system", content: text, linkUrl: link });
        }
    } catch (err) {
        logger.error("RegistryAlerts", `Owner alert (${kind}) failed (continuing)`, err);
    }
}

/**
 * Is any Registry moderator active? Once one is, the owner's
 * per-suggestion pings stop and the suggestions move into the digest
 * (owner answer 4). Before migration 242 there are none, so the pings
 * carry on as before. Never throws.
 */
export async function anyActiveModerator(): Promise<boolean> {
    try {
        const db = getAdminClient() as unknown as SupabaseClient;
        const { data, error } = await db
            .from("registry_moderators")
            .select("user_id")
            .eq("status", "active")
            .gt("term_ends_at", new Date().toISOString())
            .limit(1);
        if (error) return false;
        return Array.isArray(data) && data.length > 0;
    } catch {
        return false;
    }
}

/**
 * Whose votes count toward a style rule's agreements today: moderators
 * with an active seat whose term has not run out, plus the owner (always).
 * On a read error the active list is empty, so only the owner's vote
 * counts until it can be read again: a rule never takes effect on votes
 * that may not count.
 */
export async function countableRuleVoters(): Promise<CountableVoters> {
    const admin = getAdminClient();
    const owners = new Set<string>();
    const active = new Set<string>();
    try {
        const { adminNotificationTargets } = await import("@/lib/notifications/adminTargets");
        for (const id of await adminNotificationTargets(admin)) owners.add(id);
    } catch (err) {
        logger.error("RegistryAlerts", "Reading the owner for rule votes failed", err);
    }
    try {
        const db = admin as unknown as SupabaseClient;
        const { data, error } = await db
            .from("registry_moderators")
            .select("user_id, status, term_ends_at")
            .eq("status", "active");
        if (!error)
            for (const s of (data ?? []) as { user_id: string; status: string; term_ends_at: string | null }[])
                if (seatIsActive(s)) active.add(s.user_id);
    } catch (err) {
        logger.error("RegistryAlerts", "Reading moderator seats for rule votes failed", err);
    }
    return { active, owners };
}
