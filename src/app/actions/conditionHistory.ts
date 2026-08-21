"use server";

import * as Sentry from "@sentry/nextjs";

import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * The condition ledger.
 *
 * `condition_history` has been filling up since migration 026 — a Postgres
 * trigger (`log_condition_change`) writes a row every time
 * `user_horses.condition_grade` changes — and until now the only thing that
 * ever read it was `v_horse_hoofprint`, which folds each row into a generic
 * "Condition: Good" timeline entry, renders on model/other_model horses
 * only, and drops the `note` column entirely. The grade ladder is a record
 * of how a model has worn over the years; it deserves to be readable as
 * one, on every category.
 *
 * ── RLS reality (migration 092 §7d, still current) ──
 *   CREATE POLICY "View condition history" ON condition_history
 *     FOR SELECT TO authenticated USING (owner_id = auth.uid() OR is_public)
 *
 * `TO authenticated` — the anon role has no read at all. So this reads
 * with the user-scoped client and the owner branch does the work; there is
 * no way for this action to return another member's private ledger.
 */

export interface ConditionLedgerEntry {
    id: string;
    /** Null on the first grade a horse was ever given. */
    oldCondition: string | null;
    newCondition: string;
    /** The owner's word on what happened. Null for entries logged before
     *  the note was persisted, and for grade changes saved without one. */
    note: string | null;
    changedAt: string;
}

/**
 * Read a horse's condition ledger, newest first.
 *
 * Returns [] rather than throwing on a read failure — a passport section
 * is not worth a 500, and an empty ledger renders as nothing at all.
 *
 * @param horseId - UUID of the horse
 */
export async function getConditionHistory(horseId: string): Promise<ConditionLedgerEntry[]> {
    const { supabase } = await requireAuth();

    const { data, error } = await supabase
        .from("condition_history")
        .select("id, old_condition, new_condition, note, created_at")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        Sentry.captureException(error, { tags: { domain: "horse" } });
        logger.error("ConditionHistory", "Ledger read failed", error);
        return [];
    }

    return (data ?? []).map((row) => {
        const r = row as {
            id: string;
            old_condition: string | null;
            new_condition: string;
            note: string | null;
            created_at: string | null;
        };
        return {
            id: r.id,
            oldCondition: r.old_condition,
            newCondition: r.new_condition,
            note: r.note,
            changedAt: r.created_at ?? "",
        };
    });
}
