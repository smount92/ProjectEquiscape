/**
 * The presence touch — one date per member per day (migration 176).
 *
 * WHY IT LIVES ON THE VIEW BEACON, and not somewhere with wider reach.
 * Three candidates were considered:
 *
 *   · middleware — runs on literally every request, including static
 *     assets and prefetches. A database write on that path to record
 *     something we already know once a day is the wrong trade, and the
 *     middleware runs on the edge where this write does not belong.
 *   · the root layout — a write on the critical render path of every
 *     page, for a number nobody reads in real time.
 *   · /api/beacon/view — ALREADY resolves the session (it needs to
 *     know whether the viewer is a member so site_activity_daily can
 *     split member from anonymous DAU). It is fire-and-forget, already
 *     off the render path, and already rate-limited per IP.
 *
 * The beacon wins on cost, and it wins on something better than cost:
 * it makes MAU and DAU the same measurement. site_activity_daily's
 * member_dau counts a member who looked at a tracked object today;
 * last_seen_on now records the same event with a one-day memory. So
 * the DAU/MAU stickiness ratio the business model wants divides two
 * numbers with the same definition, which is the only way that ratio
 * means anything.
 *
 * THE HONEST CAVEAT, which belongs next to the number and not in a
 * footnote: "active" here means "viewed at least one tracked object" —
 * a horse, listing, show, barn, studio, reference page or profile. A
 * member who signs in, reads their dashboard and leaves is not counted.
 * That is a narrower and more useful definition of active than "loaded
 * any page", but it is not the same one, and the admin card says so.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { metricsDb } from "./db";
import { isMissingRevenueSchema } from "./revenue";

/**
 * Stamp today's UTC date on the signed-in caller's own users row.
 *
 * Takes the caller's OWN client, not the service role: touch_last_seen
 * reads auth.uid() and can only ever write the session's own row, so
 * there is no path here that could touch anyone else's. Pass a client
 * with no session and the function returns without writing.
 *
 * Never throws and never reports. A presence date must not be the
 * reason a beacon request fails.
 */
export async function touchLastSeen(client: unknown): Promise<void> {
    try {
        const { error } = await metricsDb(client as SupabaseClient).rpc("touch_last_seen");
        if (error && !isMissingRevenueSchema(error)) {
            console.error("[LastSeen] touch_last_seen failed:", error.message);
        }
    } catch {
        // Same contract as the counter it rides along with.
    }
}
