import "server-only";
import { unstable_cache } from "next/cache";

import { createAnonClient } from "@/lib/supabase/anon";
import { NO_PUBLIC_STATS, type PublicStats } from "@/lib/stats/publicStatsShape";

export { statIsPresentable, type PublicStats } from "@/lib/stats/publicStatsShape";

/**
 * Public, anon-legal counts for the logged-out landing page.
 *
 * RULE OF THIS FILE: every number here is a real read, or it is `null` and
 * the caller renders nothing. There are no fallback constants and no
 * "approximately" figures — a stat the database cannot confirm is a stat the
 * front door does not claim.
 *
 * Cookie-less anon client on purpose (see lib/supabase/anon.ts): the landing
 * page must stay statically renderable, so it cannot touch the SSR client.
 * Each read is anon-legal under an existing RLS policy — no new policy, no
 * service role:
 *
 *   catalog_items         migration 124 — SELECT to anon, USING (true)
 *   user_horses           migration 150 — SELECT to anon where visibility is
 *                         'public' or 'unlisted'. We narrow to 'public'
 *                         explicitly; 'unlisted' must never be enumerated.
 *   shows                 migration 118 — SELECT to anon for non-draft shows
 *   listings total        migration 169 — get_market_listings_total(), granted
 *                         to anon; falls back to the same predicate inline if
 *                         that migration has not been applied yet.
 *
 * Deliberately absent: a member count. `users` is authenticated-only
 * (migration 022) and the only way to it is the service role, which would
 * force this page dynamic. Better no number than a dishonest one.
 */

const REVALIDATE = 3600;

type AnonClient = ReturnType<typeof createAnonClient>;

/** A failed read is not a zero — it is an absent stat. */
async function safeCount(run: () => Promise<number | null>): Promise<number | null> {
    try {
        return await run();
    } catch {
        return null;
    }
}

async function countCatalogItems(supabase: AnonClient): Promise<number | null> {
    const { count, error } = await supabase
        .from("catalog_items")
        .select("id", { count: "exact", head: true });
    return error ? null : (count ?? null);
}

async function countPublicHorses(supabase: AnonClient): Promise<number | null> {
    const { count, error } = await supabase
        .from("user_horses")
        .select("id", { count: "exact", head: true })
        .eq("visibility", "public")
        .is("deleted_at", null);
    return error ? null : (count ?? null);
}

async function countCompletedShows(supabase: AnonClient): Promise<number | null> {
    const { count, error } = await supabase
        .from("shows")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed");
    return error ? null : (count ?? null);
}

async function countLiveListings(supabase: AnonClient): Promise<number | null> {
    // get_market_listings_total ships in migration 169 and is not in the
    // generated types yet — same bind-and-cast idiom as market/listings.ts.
    const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;

    const { data, error } = await rpc("get_market_listings_total", {});
    if (!error) {
        const total = typeof data === "string" ? Number(data) : data;
        if (typeof total === "number" && Number.isFinite(total)) return total;
    }

    // 169 not applied (or the RPC moved): same predicate, inline.
    const { count, error: countError } = await supabase
        .from("user_horses")
        .select("id", { count: "exact", head: true })
        .eq("visibility", "public")
        .is("deleted_at", null)
        .in("trade_status", ["For Sale", "Open to Offers"]);
    return countError ? null : (count ?? null);
}

/**
 * Four head counts in parallel, cached for an hour. Nothing here is
 * session-bound, so the landing page stays static/ISR.
 */
export const getPublicStats = unstable_cache(
    async (): Promise<PublicStats> => {
        // Client construction is inside the guard on purpose: a build box
        // without Supabase env vars must produce an empty strap, never a
        // failed prerender of the site's front door.
        try {
            const supabase = createAnonClient();

            const [catalogItems, publicHorses, showsCompleted, listingsForSale] = await Promise.all([
                safeCount(() => countCatalogItems(supabase)),
                safeCount(() => countPublicHorses(supabase)),
                safeCount(() => countCompletedShows(supabase)),
                safeCount(() => countLiveListings(supabase)),
            ]);

            return { catalogItems, publicHorses, showsCompleted, listingsForSale };
        } catch {
            return NO_PUBLIC_STATS;
        }
    },
    ["public-stats:landing"],
    { revalidate: REVALIDATE, tags: ["public-stats"] },
);
