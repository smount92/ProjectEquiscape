/**
 * Shows domain — the /shows/[id] ROUTE RESOLVER (Phase E2 cutover).
 *
 * One route, two systems: /shows/[id] serves the v2 public show
 * page when the id belongs to a v2 show, and falls through to the
 * legacy events-based page otherwise. Legacy shows keep working
 * identically; v2 shows own the canonical URL.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Both systems key on uuids; junk ids skip the DB entirely. */
export function looksLikeUuid(id: string): boolean {
    return UUID_RE.test(id);
}

export type ShowRouteTarget = "v2" | "legacy";

/**
 * Decide which page /shows/[id] renders. ONE indexed primary-key
 * lookup against shows; anything that isn't a v2 show (flag off,
 * junk id, legacy event id, DB hiccup) falls through to legacy —
 * the legacy page still notFound()s ids it doesn't know.
 */
export async function resolveShowRoute(
    supabase: SupabaseClient,
    id: string,
    v2Enabled: boolean,
): Promise<ShowRouteTarget> {
    if (!v2Enabled || !looksLikeUuid(id)) return "legacy";
    const { data, error } = await supabase
        .from("shows")
        .select("id")
        .eq("id", id)
        .maybeSingle();
    if (error || !data) return "legacy";
    return "v2";
}
