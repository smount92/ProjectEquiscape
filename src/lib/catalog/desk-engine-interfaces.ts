// TEMP: replaced by r3-engine-fixes at merge. Point the imports in
// src/app/actions/registry-desk.ts at @/lib/catalog/write and
// @/lib/catalog/suggestionApply, then delete this file.
import "server-only";

/**
 * The four engine interfaces the Desk codes against while the engine
 * branch (r3-engine-fixes) is in flight. Each name re-exports the engine's
 * own function when it exists; until then a small stand-in keeps the Desk
 * working on its own branch.
 *
 * (i)   undoReady(): true when update 243 is in.
 * (ii)  decideSuggestion / applySuggestion take `expected` (what the
 *       moderator saw) and refuse with code "changed" if the member edited
 *       the suggestion since; a decision may report `dropped` values.
 * (iii) claimSuggestion / releaseSuggestionClaim hold a suggestion for 30 minutes.
 * (iv)  requestMerge merges mold into mold; the releases follow the kept mold's scale.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import * as apply from "@/lib/catalog/suggestionApply";
import * as write from "@/lib/catalog/write";
import { getAdminClient } from "@/lib/supabase/admin";
import type { RegistryActor } from "@/lib/registry/types";

export interface SuggestionExpectation {
    fieldChanges: unknown;
    catalogItemId: string | null;
}

export type DecideResultWithDropped =
    | { success: true; status: "approved" | "rejected" | "awaiting_second_look"; dropped?: Dropped[] }
    | { success: false; error: string; code?: string; requeued?: boolean; dropped?: Dropped[] };

export interface Dropped {
    key: string;
    error: string;
    value?: unknown;
}

interface Engine {
    undoReady(): Promise<boolean>;
    claimSuggestion(actor: RegistryActor, id: string): Promise<write.WriteResult<{ claimedUntil: string }>>;
    releaseSuggestionClaim(actor: RegistryActor, id: string): Promise<write.WriteResult>;
}

const engine = write as unknown as Partial<Engine>;
const db = () => getAdminClient() as unknown as SupabaseClient;
const CLAIM_MS = 30 * 60 * 1000;

/** (i) Is update 243 in? */
export const undoReady: Engine["undoReady"] =
    engine.undoReady ??
    (async () => {
        const { error } = await db().from("catalog_removed_items").select("id").limit(1);
        return !error || !write.isMissingSchema(error);
    });

/** (iii) Hold a suggestion for 30 minutes (guarded: free, expired or already ours). */
export const claimSuggestion: Engine["claimSuggestion"] =
    engine.claimSuggestion ??
    (async (actor, id) => {
        const now = new Date();
        const claimedUntil = new Date(now.getTime() + CLAIM_MS).toISOString();
        const { data, error } = await db()
            .from("catalog_suggestions")
            .update({ claimed_by: actor.userId, claimed_until: claimedUntil })
            .eq("id", id)
            .or(`claimed_by.is.null,claimed_until.lt.${now.toISOString()},claimed_by.eq.${actor.userId}`)
            .select("id");
        if (error) {
            if (write.isMissingSchema(error))
                return { success: false, code: "not_ready", error: "Claims start with update 242." };
            return { success: false, code: "failed", error: "It could not be held. Please try again." };
        }
        if (!data || (data as unknown[]).length === 0)
            return { success: false, code: "conflict", error: "Another moderator picked this one up a moment ago." };
        return { success: true, claimedUntil };
    });

/** (iii) Let go of a claim this moderator holds. */
export const releaseSuggestionClaim: Engine["releaseSuggestionClaim"] =
    engine.releaseSuggestionClaim ??
    (async (actor, id) => {
        const { error } = await db()
            .from("catalog_suggestions")
            .update({ claimed_by: null, claimed_until: null })
            .eq("id", id)
            .eq("claimed_by", actor.userId);
        if (error && !write.isMissingSchema(error))
            return { success: false, code: "failed", error: "The hold could not be let go." };
        return { success: true };
    });

/** (ii) Decide a suggestion, refusing ("changed") if it changed since the moderator saw it. */
export const decideSuggestion = apply.decideSuggestion as (
    id: string,
    decision: {
        reviewer: RegistryActor;
        verdict: "approved" | "rejected";
        note?: string;
        edited?: Record<string, unknown>;
        expected?: SuggestionExpectation;
    },
) => Promise<DecideResultWithDropped>;

/** (iv) Ask for a merge, release into release or mold into mold. */
export const requestMerge = write.requestMerge;
