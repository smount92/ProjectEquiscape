/**
 * Untyped client + missing-schema detection for migration 175.
 *
 * Migrations here are hand-pasted by the owner and `npm run gen-types`
 * reads the live database, so until 175 lands TypeScript has never heard
 * of `object_view_daily`, `record_object_view` or the rest. Every call
 * site behind `metricsDb` handles the absent-schema codes below, so a
 * pre-175 database degrades quietly rather than throwing:
 *
 *   beacon route  → 204, wrote nothing, page never notices
 *   admin Insights → the cards render "—"
 *   seller line   → renders nothing at all
 *
 * Mirrors `dealDb` in src/lib/deals/columnSupport.ts and `barnDb` in
 * src/app/actions/groups.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export function metricsDb(client: unknown): SupabaseClient {
    return client as SupabaseClient;
}

/** Postgres "relation does not exist". */
export const UNDEFINED_TABLE = "42P01";
/** Postgres "function does not exist". */
export const UNDEFINED_FUNCTION = "42883";
/** PostgREST "function not found in schema cache". */
export const MISSING_RPC = "PGRST202";
/** PostgREST "table not found in schema cache". */
export const MISSING_RELATION = "PGRST205";

/** True when the error means "175 has not been pasted yet", not "it broke". */
export function isMissingMetricsSchema(
    error: { code?: string; message?: string } | null | undefined,
): boolean {
    if (!error) return false;
    if (
        error.code === UNDEFINED_TABLE ||
        error.code === UNDEFINED_FUNCTION ||
        error.code === MISSING_RPC ||
        error.code === MISSING_RELATION
    ) {
        return true;
    }
    return /(relation|function) .* does not exist|schema cache/i.test(error.message ?? "");
}
