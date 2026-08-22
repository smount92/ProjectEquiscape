/**
 * Shows domain — the SHOW AUDIENCE.
 *
 * "Who should hear about this show?" used to have one answer: people
 * with a live entry. Migration 184 adds a second — people who followed
 * it — and the lifecycle fan-outs speak to the union of the two.
 *
 * The union is the whole point, and so is the DEDUPE. Entering a horse
 * implicitly follows the show (see enterClass), so the overwhelmingly
 * common case is a person who is in BOTH sets. They must receive
 * exactly ONE notification per event; a member who gets told twice that
 * judging began learns that this site's notifications are noise.
 *
 * Two layers, matching notifications.ts:
 *   1. `mergeAudience` — pure, no I/O, fully unit-tested. The dedupe
 *      lives here and nowhere else.
 *   2. `loadShowAudience` — the one read, feature-detected against 184.
 *      Pre-184 the follower half is simply empty, so every caller
 *      degrades to today's entrant-only behaviour with no branching of
 *      its own.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { followDb, isMissingSchema } from "./followSupport";

export interface ShowAudience {
    /** Distinct owners of LIVE entries, first-entry order. */
    entrantIds: string[];
    /** Distinct followers (includes entrants who follow implicitly). */
    followerIds: string[];
    /**
     * The deduped union — entrants first, then followers who did not
     * enter. This is the list a lifecycle fan-out sends to.
     */
    audienceIds: string[];
    /**
     * Followers with NO live entry. Used by the results fan-out, where
     * entrants already receive their own placing/card notices and must
     * not be told a second time that results exist.
     */
    followerOnlyIds: string[];
    /** False = migration 184 not pasted; followerIds is empty. */
    followSupported: boolean;
}

/**
 * Fold entrants + followers into the deduped audience.
 *
 * Order is deliberate and stable: entrants in arrival order first (the
 * people with something at stake), then follower-only ids. Stable order
 * makes the fan-out's batched insert reproducible and its tests
 * readable.
 */
export function mergeAudience(input: {
    /** Owner id per live entry — duplicates expected, one per entry. */
    entrantIds: string[];
    followerIds: string[];
}): Pick<ShowAudience, "entrantIds" | "followerIds" | "audienceIds" | "followerOnlyIds"> {
    const entrantIds: string[] = [];
    const entrantSet = new Set<string>();
    for (const id of input.entrantIds) {
        if (!id || entrantSet.has(id)) continue;
        entrantSet.add(id);
        entrantIds.push(id);
    }

    const followerIds: string[] = [];
    const followerSet = new Set<string>();
    for (const id of input.followerIds) {
        if (!id || followerSet.has(id)) continue;
        followerSet.add(id);
        followerIds.push(id);
    }

    // A follower who also entered is ALREADY in entrantIds — this is
    // the dedupe. It is a set membership test, not a "did we send
    // already?" query, so it cannot drift.
    const followerOnlyIds = followerIds.filter((id) => !entrantSet.has(id));

    return {
        entrantIds,
        followerIds,
        audienceIds: [...entrantIds, ...followerOnlyIds],
        followerOnlyIds,
    };
}

/**
 * Load the full audience for a show.
 *
 * `client` should be the ADMIN client for fan-out callers: the follower
 * rows are RLS-scoped to their own owner, so a user-scoped client would
 * see at most its own row. Reading the list here and never returning it
 * to a client payload is what keeps the follower list private (see the
 * privacy note in migration 184).
 *
 * Never throws. A failed read degrades to an empty audience and logs —
 * the caller is always a fire-and-forget fan-out, and a notification
 * failure must never break a status transition.
 */
export async function loadShowAudience(
    client: SupabaseClient,
    showId: string,
): Promise<ShowAudience> {
    const empty: ShowAudience = {
        entrantIds: [],
        followerIds: [],
        audienceIds: [],
        followerOnlyIds: [],
        followSupported: false,
    };

    try {
        const { data: entryRows, error: entriesError } = await client
            .from("show_class_entries")
            .select("owner_id, status")
            .eq("show_id", showId)
            .order("created_at", { ascending: true });
        if (entriesError) {
            logger.error(
                "ShowAudience",
                `Entrant load failed for ${showId}: ${entriesError.message}`,
            );
            return empty;
        }

        const entrantIds = (entryRows ?? [])
            .filter((e) => e.status !== "scratched")
            .map((e) => e.owner_id as string);

        // Feature-detected: pre-184 this is a 42P01 and the follower
        // half stays empty, which is exactly today's behaviour.
        let followerIds: string[] = [];
        let followSupported = false;
        const { data: followerRows, error: followersError } = await followDb(client)
            .from("show_followers")
            .select("user_id")
            .eq("show_id", showId);
        if (followersError) {
            if (!isMissingSchema(followersError)) {
                logger.error(
                    "ShowAudience",
                    `Follower load failed for ${showId}: ${followersError.message}`,
                );
            }
        } else {
            followSupported = true;
            followerIds = (followerRows ?? []).map((r) => r.user_id as string);
        }

        return {
            ...mergeAudience({ entrantIds, followerIds }),
            followSupported,
        };
    } catch (err) {
        logger.error("ShowAudience", "Audience load failed", err);
        return empty;
    }
}
