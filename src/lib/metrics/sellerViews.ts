/**
 * "👁 12 views this week" — the owner's own read of their own horse.
 *
 * The one number in this subsystem a member ever sees, and it is
 * deliberately private. Public view counts turn a collection into a
 * scoreboard: the horse with 400 views becomes the desirable one and the
 * horse with 3 becomes an embarrassment, which is exactly the dynamic this
 * community does not need. So the count renders on the owner's stable page
 * and nowhere else — not on the market card, not on the public passport.
 * (Noted as a future decision, not a permanent one.)
 *
 * Enforcement is in the database, not here: get_horse_view_stats checks
 * `owner_id = auth.uid()` and returns no rows otherwise, so calling this
 * for someone else's horse yields null rather than a number.
 */

import { isMissingMetricsSchema, metricsDb } from "@/lib/metrics/db";

export interface HorseViewStats {
    /** Views over the last 7 UTC days, today included. */
    weekViews: number;
    /** Distinct viewers over the same window — best effort for anon. */
    weekViewers: number;
    /** Every view ever recorded. Zero until migration 175 has been live a day. */
    allTimeViews: number;
}

/**
 * Null means "show nothing": no rows, not the owner, migration not pasted,
 * or the read failed. All four are the same outcome for the page — a line
 * that simply is not there — so they collapse to one return value.
 */
export async function getHorseViewStats(
    client: unknown,
    horseId: string,
): Promise<HorseViewStats | null> {
    try {
        const { data, error } = await metricsDb(client)
            .rpc("get_horse_view_stats", { p_horse_id: horseId })
            .maybeSingle();

        if (error) {
            if (!isMissingMetricsSchema(error)) {
                console.error("[ViewStats] get_horse_view_stats failed:", error.message);
            }
            return null;
        }
        if (!data) return null;

        const row = data as {
            week_views?: number | null;
            week_viewers?: number | null;
            all_time_views?: number | null;
        };

        return {
            weekViews: row.week_views ?? 0,
            weekViewers: row.week_viewers ?? 0,
            allTimeViews: row.all_time_views ?? 0,
        };
    } catch {
        return null;
    }
}

/**
 * The sentence itself, kept out of the JSX so it can be unit-tested and so
 * the phrasing lives in one place if it ever changes.
 *
 * Silence beats a zero: a brand-new horse showing "0 views this week" reads
 * as a verdict on the horse. Returns null until there is something to say.
 */
export function viewStatsLabel(stats: HorseViewStats | null): string | null {
    if (!stats) return null;
    if (stats.allTimeViews <= 0) return null;

    const week = stats.weekViews === 1 ? "1 view this week" : `${stats.weekViews} views this week`;
    return `${week} (${stats.allTimeViews.toLocaleString()} all-time)`;
}
