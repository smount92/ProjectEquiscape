import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Feature detection for migration 184 (show_followers).
 *
 * Migrations here are hand-pasted by the owner, so every follow read
 * and write path has to work on BOTH shapes of the schema:
 *
 *   without 184 — exactly today's behaviour. The follow button does
 *   not render, the host's console shows no follower line, entering a
 *   class does not try to write an implicit follow row, and every
 *   lifecycle fan-out treats the follower set as empty (so it reaches
 *   entrants only, which is the audience that exists today).
 *
 *   with 184 — follow a show.
 *
 * A missing table is a PostgREST 42P01, so one cheap probe per process
 * answers it. Mirrors src/lib/deals/columnSupport.ts and
 * src/lib/studio/columnSupport.ts, including the short TTL: after the
 * owner pastes 184 a running instance picks it up within a minute
 * rather than needing a redeploy.
 */

const TTL_MS = 60_000;

let cached: boolean | null = null;
let cachedAt = 0;
let inflight: Promise<boolean> | null = null;

/** Test seam — resets the memo so a probe re-runs. */
export function resetShowFollowSupport(): void {
    cached = null;
    cachedAt = 0;
    inflight = null;
}

/** Is `show_followers` present? False = pre-184, degrade silently. */
export async function getShowFollowSupport(
    supabase: SupabaseClient,
): Promise<boolean> {
    if (cached !== null && Date.now() - cachedAt < TTL_MS) return cached;
    if (inflight) return inflight;

    inflight = (async () => {
        try {
            const probe = await supabase.from("show_followers").select("show_id").limit(1);
            // A missing table errors; an EMPTY table does not. RLS
            // returning zero rows is also not an error — so "no error"
            // is the right signal, not "some data came back".
            const supported = !probe.error;
            cached = supported;
            cachedAt = Date.now();
            return supported;
        } catch {
            // Never let a probe failure break a show page — degrade to
            // "table absent", which is the always-safe shape.
            cached = false;
            cachedAt = Date.now();
            return false;
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

/** Postgres "relation does not exist" — migration 184 not applied yet. */
export const UNDEFINED_TABLE = "42P01";

/**
 * Is this error just "184 has not been pasted yet"? Call sites treat a
 * true here as "no followers exist" rather than as a failure.
 * Mirrors isMissingSchema in src/lib/deals/columnSupport.ts.
 */
export function isMissingSchema(
    error: { code?: string; message?: string } | null | undefined,
): boolean {
    if (!error) return false;
    return (
        error.code === UNDEFINED_TABLE ||
        error.code === "42703" ||
        /(column|relation) .* does not exist/i.test(error.message ?? "")
    );
}

/**
 * Untyped view of the Supabase client for the schema 184 adds. The
 * generated Database types are regenerated only after the owner pastes
 * the migration, so until then TypeScript does not know
 * `show_followers` exists. Every call site behind this cast handles the
 * missing-table error code above, so a pre-184 database degrades
 * instead of throwing. Mirrors `dealDb` in src/lib/deals/columnSupport.ts.
 */
export function followDb(client: unknown): SupabaseClient {
    return client as SupabaseClient;
}
