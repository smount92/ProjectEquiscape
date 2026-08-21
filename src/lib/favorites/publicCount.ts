/**
 * Favorites are PUBLIC LIKES on a horse (owner ruling, 2026-08) — the
 * count is a signal the owner watches climb, NOT a private list and
 * NOT purchase intent (that's the Want List, which lives elsewhere and
 * is untouched by this module).
 *
 * ── Anon read status (audited 2026-08-19) ─────────────────────────
 * `horse_favorites` has exactly one SELECT policy — "Anyone can view
 * favorites" ... TO authenticated (migration 010, re-affirmed in 022).
 * There is NO anon SELECT policy, no anon-granted aggregate RPC, and
 * `get_public_passport` (135) does not return a count. So a logged-out
 * count comes back as 0 under RLS — indistinguishable from "nobody has
 * favorited this horse yet". The public passport must therefore never
 * print "0 favorites" as if it were a fact.
 *
 * The contract: `null` means "nothing trustworthy to show" and the
 * chip renders nothing; a positive number means rows were genuinely
 * visible. No migration is added here — the day an anon read path
 * exists, this lights up on its own.
 */

import { createAnonClient } from "@/lib/supabase/anon";

/** "1 favorite" / "12 favorites" — never "0 favorites" (see above). */
export function favoriteCountLabel(count: number): string {
    return `${count} ${count === 1 ? "favorite" : "favorites"}`;
}

/**
 * Normalizes a raw count read into what the chip should show.
 * Pure — the network half lives in getPublicFavoriteCount.
 */
export function publicFavoriteCount(
    count: number | null | undefined,
    error: unknown,
): number | null {
    if (error) return null;
    if (typeof count !== "number" || !Number.isFinite(count)) return null;
    // 0 is ambiguous under RLS (see the module note) — say nothing.
    return count > 0 ? count : null;
}

/**
 * Aggregate favorite count for a PUBLIC horse, read anonymously.
 * Returns null whenever the number can't be trusted (no anon read
 * path today, network failure, or a genuine zero).
 */
export async function getPublicFavoriteCount(horseId: string): Promise<number | null> {
    try {
        const supabase = createAnonClient();
        const { count, error } = await supabase
            .from("horse_favorites")
            .select("id", { count: "exact", head: true })
            .eq("horse_id", horseId);
        return publicFavoriteCount(count, error);
    } catch {
        return null;
    }
}
