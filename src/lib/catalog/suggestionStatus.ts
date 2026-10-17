/**
 * The statuses of a member's catalog suggestion, in one place.
 *
 * Since Release 3 a Registry moderator who opens a suggestion claims it
 * for 30 minutes, and a claimed suggestion reads `under_review` (so the
 * member can't change it under them). It still waits for a decision:
 * every count and filter of waiting suggestions takes both statuses.
 */

export const OPEN_SUGGESTION_STATUSES = ["pending", "under_review"] as const;

/** Still waiting for a decision (pending, or being looked at). */
export function isOpenSuggestion(status: string | null | undefined): boolean {
    return status === "pending" || status === "under_review";
}

/** The statuses a list filter shows: "pending" means every waiting one; "all" or none means no filter. */
export function statusFilterValues(filter: string | null | undefined): string[] | null {
    if (!filter || filter === "all") return null;
    if (filter === "pending") return [...OPEN_SUGGESTION_STATUSES];
    return [filter];
}

/** Members' words for each status. */
export const SUGGESTION_STATUS_LABELS: Record<string, string> = {
    pending: "Waiting for review",
    under_review: "Being looked at",
    approved: "Approved",
    auto_approved: "Auto-approved",
    rejected: "Rejected",
};

/** "@Maple is looking at this for another 12 minutes." */
export function claimLine(alias: string, until: string, now: Date = new Date()): string {
    const minutes = Math.max(1, Math.ceil((Date.parse(until) - now.getTime()) / 60_000));
    return `@${alias} is looking at this for another ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** A moderator's claim that has not run out yet. */
export function liveClaim(
    row: { claimed_by?: string | null; claimed_until?: string | null },
    now: Date = new Date(),
): { by: string; until: string } | null {
    if (!row.claimed_by || !row.claimed_until) return null;
    if (Date.parse(row.claimed_until) <= now.getTime()) return null;
    return { by: row.claimed_by, until: row.claimed_until };
}
