/**
 * A horse made private by a moderator (migration 235): the one place that
 * knows what the hold blocks and what the member is told.
 *
 * The take-down (reportTargets.ts) stamps user_horses.moderation_hidden_at.
 * While it is set the owner can't make the horse public or unlisted, or put
 * it up for sale; trg_user_horses_moderation_guard refuses it in the
 * database with these same words, and the actions check first so the
 * member reads them in the form instead of a failed save.
 *
 * Pure apart from heldHorseIds, which takes the caller's client. Safe to
 * import from client components.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { REPORT_CONTACT_URL } from "@/lib/moderation/reports";

export const MODERATION_HOLD_MESSAGE = "This horse was made private by a moderator. Contact us to ask about it.";

/** Where the member writes to ask about it. */
export const MODERATION_HOLD_CONTACT_URL = REPORT_CONTACT_URL;

/** The trade statuses that put a horse on the Market. */
const LISTING_STATUSES = ["For Sale", "Open to Offers"];

/**
 * Would this update make a horse visible or list it? Only those changes are
 * held; everything else on a held horse (its name, photos, notes) can still
 * be edited, and saving the form with the horse still private and not for
 * sale is fine.
 */
export function liftsModerationHold(update: Record<string, unknown> | null | undefined): boolean {
    if (!update) return false;
    if (typeof update.visibility === "string" && update.visibility !== "private") return true;
    if (update.is_public === true) return true;
    if (typeof update.trade_status === "string" && LISTING_STATUSES.includes(update.trade_status)) return true;
    return false;
}

/** The database guard's refusal, recognised so it reads as the same plain words. */
export function isModerationHoldError(message: string | null | undefined): boolean {
    return !!message && message.includes(MODERATION_HOLD_MESSAGE);
}

/**
 * Which of these horses are held. Empty (never an error) before migration
 * 235, when there is no stamp to read, so nothing is held.
 */
export async function heldHorseIds(supabase: SupabaseClient, horseIds: string[]): Promise<Set<string>> {
    if (horseIds.length === 0) return new Set();
    const { data, error } = await supabase
        .from("user_horses")
        .select("id, moderation_hidden_at")
        .in("id", horseIds)
        .not("moderation_hidden_at", "is", null);
    if (error || !Array.isArray(data)) return new Set();
    return new Set((data as { id: string }[]).map((r) => r.id));
}
