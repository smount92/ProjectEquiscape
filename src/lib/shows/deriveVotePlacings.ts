/**
 * Shows domain — derive provisional placings from community
 * votes. Pure, no I/O. Called per class by the
 * finalizeCommunityVotes action when a community-vote show sits
 * in results_review.
 *
 * Rules (Phase E1):
 *   - Top 6 entries by vote count take places 1..6.
 *   - Ties break by earliest entry (created_at, then entry id so
 *     the result is total and deterministic).
 *   - A placing requires at least one vote: zero-vote entries are
 *     never placed, so an unvoted class yields NO placings rather
 *     than placing entries by arrival order.
 */

import { MAX_PLACE } from "./placings";
import type { Place } from "./types";

export interface VoteTally {
    entryId: string;
    voteCount: number;
    /** ISO timestamp — the tie-breaker (earliest entry wins). */
    createdAt: string;
}

export interface DerivedPlacing {
    entryId: string;
    place: Place;
}

export function deriveVotePlacings(tallies: VoteTally[]): DerivedPlacing[] {
    return [...tallies]
        .filter((t) => t.voteCount > 0)
        .sort(
            (a, b) =>
                b.voteCount - a.voteCount ||
                // ISO-8601 strings sort chronologically as strings.
                a.createdAt.localeCompare(b.createdAt) ||
                a.entryId.localeCompare(b.entryId),
        )
        .slice(0, MAX_PLACE)
        .map((t, i) => ({ entryId: t.entryId, place: (i + 1) as Place }));
}
