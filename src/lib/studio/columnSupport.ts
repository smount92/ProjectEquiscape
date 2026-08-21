import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Feature detection for migration 170.
 *
 * Migrations here are hand-pasted by the owner, so every studio read
 * and write path has to work on BOTH shapes of the schema:
 *
 *   without 170 — v1 behaviour. Terms read as the researched defaults,
 *   services derive from the old flat price range, the quote stage
 *   still works (price lands in `price_quoted`), the receipts wall
 *   falls back to `finishing_artist` matching, and the vault hand-off
 *   is hidden rather than broken.
 *
 *   with 170 — the full thing.
 *
 * Selecting a column that does not exist is a PostgREST 42703, so a
 * handful of cheap probes per process answer it. Mirrors
 * src/lib/feed/columnSupport.ts, including the short TTL: after the
 * owner pastes 170 a running instance picks it up within a minute
 * rather than needing a redeploy.
 */

export interface StudioColumnSupport {
    /** artist_profiles.services + the structured terms columns. */
    studioTerms: boolean;
    /** commissions.agreed_price + terms_snapshot + the state timestamps. */
    commissionAgreement: boolean;
    /** customization_logs.artist_user_id + commission_id. */
    logProvenance: boolean;
    /** financial_vault.commission_cost. */
    vaultCommissionCost: boolean;
    /** The v_artist_finished_horses view. */
    receiptsView: boolean;
}

const TTL_MS = 60_000;
const NONE: StudioColumnSupport = {
    studioTerms: false,
    commissionAgreement: false,
    logProvenance: false,
    vaultCommissionCost: false,
    receiptsView: false,
};

let cached: StudioColumnSupport | null = null;
let cachedAt = 0;
let inflight: Promise<StudioColumnSupport> | null = null;

/** Test seam — resets the memo so a probe re-runs. */
export function resetStudioColumnSupport(): void {
    cached = null;
    cachedAt = 0;
    inflight = null;
}

export async function getStudioColumnSupport(
    supabase: SupabaseClient,
): Promise<StudioColumnSupport> {
    if (cached && Date.now() - cachedAt < TTL_MS) return cached;
    if (inflight) return inflight;

    inflight = (async () => {
        try {
            const [terms, agreement, provenance, vault, receipts] = await Promise.all([
                supabase.from("artist_profiles").select("services").limit(1),
                supabase.from("commissions").select("agreed_price").limit(1),
                supabase.from("customization_logs").select("artist_user_id").limit(1),
                supabase.from("financial_vault").select("commission_cost").limit(1),
                supabase.from("v_artist_finished_horses").select("horse_id").limit(1),
            ]);
            const result: StudioColumnSupport = {
                studioTerms: !terms.error,
                commissionAgreement: !agreement.error,
                logProvenance: !provenance.error,
                vaultCommissionCost: !vault.error,
                receiptsView: !receipts.error,
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
