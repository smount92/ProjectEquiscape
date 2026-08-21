import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Feature detection for migration 173.
 *
 * Migrations here are hand-pasted by the owner, so every messaging read
 * and write path has to work on BOTH shapes of the schema:
 *
 *   without 173 — exactly today's behaviour. Threads are plain chat,
 *   unread comes off messages.is_read, roles come off buyer_id/seller_id,
 *   the terms panel and the payment ledger are hidden rather than broken,
 *   and the evidence pack falls back to transcript + Safe-Trade stamps.
 *
 *   with 173 — the deal room.
 *
 * Selecting a column that does not exist is a PostgREST 42703 and a
 * missing table is 42P01, so a handful of cheap probes per process answer
 * it. Mirrors src/lib/studio/columnSupport.ts, including the short TTL:
 * after the owner pastes 173 a running instance picks it up within a
 * minute rather than needing a redeploy.
 */

export interface DealColumnSupport {
    /** messages.kind + messages.payload — the mixed transcript. */
    messageKinds: boolean;
    /** conversation_participants — roles, unread, mute, archive. */
    participants: boolean;
    /** conversations.last_message_at + deal_terms + subject columns. */
    conversationDeal: boolean;
    /** payment_installments — the time-payment ledger. */
    installments: boolean;
}

const TTL_MS = 60_000;
const NONE: DealColumnSupport = {
    messageKinds: false,
    participants: false,
    conversationDeal: false,
    installments: false,
};

/** Every capability present — the shape after 173 is pasted. */
export const ALL_SUPPORTED: DealColumnSupport = {
    messageKinds: true,
    participants: true,
    conversationDeal: true,
    installments: true,
};

let cached: DealColumnSupport | null = null;
let cachedAt = 0;
let inflight: Promise<DealColumnSupport> | null = null;

/** Test seam — resets the memo so a probe re-runs. */
export function resetDealColumnSupport(): void {
    cached = null;
    cachedAt = 0;
    inflight = null;
}

export async function getDealColumnSupport(
    supabase: SupabaseClient,
): Promise<DealColumnSupport> {
    if (cached && Date.now() - cachedAt < TTL_MS) return cached;
    if (inflight) return inflight;

    inflight = (async () => {
        try {
            const [kinds, participants, deal, installments] = await Promise.all([
                supabase.from("messages").select("kind").limit(1),
                supabase.from("conversation_participants").select("conversation_id").limit(1),
                supabase.from("conversations").select("last_message_at").limit(1),
                supabase.from("payment_installments").select("id").limit(1),
            ]);
            const result: DealColumnSupport = {
                messageKinds: !kinds.error,
                participants: !participants.error,
                conversationDeal: !deal.error,
                installments: !installments.error,
            };
            cached = result;
            cachedAt = Date.now();
            return result;
        } catch {
            // Never let a probe failure take the inbox down — degrade to
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

/** Postgres "column does not exist" — migration 173 not applied yet. */
export const UNDEFINED_COLUMN = "42703";
/** Postgres "relation does not exist" — the new tables are missing. */
export const UNDEFINED_TABLE = "42P01";

export function isMissingSchema(
    error: { code?: string; message?: string } | null | undefined,
): boolean {
    if (!error) return false;
    return (
        error.code === UNDEFINED_COLUMN ||
        error.code === UNDEFINED_TABLE ||
        /(column|relation) .* does not exist/i.test(error.message ?? "")
    );
}

/**
 * Untyped view of the Supabase client for the schema migration 173 adds.
 * The generated Database types are regenerated only after the owner
 * pastes the migration, so until then TypeScript does not know
 * `messages.kind`, `conversation_participants` or `payment_installments`
 * exist. Every call site behind this cast handles the missing-schema
 * error codes above, so a pre-173 database degrades instead of throwing.
 *
 * Mirrors `barnDb` in src/app/actions/groups.ts.
 */
export function dealDb(client: unknown): SupabaseClient {
    return client as SupabaseClient;
}
