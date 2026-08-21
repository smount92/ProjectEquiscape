import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Feature detection for migration 166's two new `posts` columns.
 *
 * Migrations here are hand-pasted by the owner, so every read and
 * write path has to work on BOTH shapes of the table: without `kind`
 * and `visibility` (feed still works, audience control silently
 * absent, show-results posts still emitted as plain posts) and with
 * them (the full behaviour). Selecting a non-existent column is a
 * PostgREST 42703, so one cheap probe per process answers it.
 *
 * Cached with a short TTL rather than forever: after the owner pastes
 * 166 the running instance picks the columns up within a minute
 * instead of needing a redeploy.
 */

export interface PostColumnSupport {
    kind: boolean;
    visibility: boolean;
}

const TTL_MS = 60_000;
const NONE: PostColumnSupport = { kind: false, visibility: false };

let cached: PostColumnSupport | null = null;
let cachedAt = 0;
let inflight: Promise<PostColumnSupport> | null = null;

/** Test seam — resets the memo so a probe re-runs. */
export function resetPostColumnSupport(): void {
    cached = null;
    cachedAt = 0;
    inflight = null;
}

export async function getPostColumnSupport(
    supabase: SupabaseClient,
): Promise<PostColumnSupport> {
    if (cached && Date.now() - cachedAt < TTL_MS) return cached;
    if (inflight) return inflight;

    inflight = (async () => {
        try {
            const [kindProbe, visibilityProbe] = await Promise.all([
                supabase.from("posts").select("kind").limit(1),
                supabase.from("posts").select("visibility").limit(1),
            ]);
            const result: PostColumnSupport = {
                kind: !kindProbe.error,
                visibility: !visibilityProbe.error,
            };
            cached = result;
            cachedAt = Date.now();
            return result;
        } catch {
            // Never let a probe failure take a page down — degrade to
            // "columns absent", which is the always-safe shape.
            cached = NONE;
            cachedAt = Date.now();
            return NONE;
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}
