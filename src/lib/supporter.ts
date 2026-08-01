// Server-only Supporter helpers (brass plaque + supporters ledger).
//
// Supporter is cosmetic recognition for a "keep the lights on" contribution —
// it deliberately gates NOTHING and is orthogonal to the pro/studio tier in
// app_metadata. State lives on public.users (migration 142); it is written
// ONLY by the Stripe webhook via the service-role client.
//
// Every read here degrades gracefully: main auto-deploys, so this code can be
// live before migration 142 is applied. A missing column or missing RPC must
// mean "no plaque / no ledger", never a broken profile or About page.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";
import { createAnonClient } from "@/lib/supabase/anon";

export interface SupporterBadge {
    isSupporter: boolean;
    /** ISO timestamp of first support, or null. */
    since: string | null;
    /** Ledger opt-in preference (only meaningful for the user's own row). */
    showInLedger: boolean;
}

const NO_BADGE: SupporterBadge = { isSupporter: false, since: null, showInLedger: false };

/**
 * Read a user's supporter badge state with whatever client the caller already
 * has (cookie client on member-facing pages, admin client in AnonProfile).
 * Errors — including "column does not exist" before migration 142 — resolve to
 * the no-badge state.
 */
export async function fetchSupporterBadge(
    client: SupabaseClient<Database>,
    userId: string,
): Promise<SupporterBadge> {
    try {
        const { data, error } = await client
            .from("users")
            .select("is_supporter, supporter_since, show_in_supporters_ledger")
            .eq("id", userId)
            .maybeSingle();
        if (error || !data) return NO_BADGE;
        return {
            isSupporter: data.is_supporter === true,
            since: data.supporter_since ?? null,
            showInLedger: data.show_in_supporters_ledger === true,
        };
    } catch {
        return NO_BADGE;
    }
}

export interface SupportersLedgerEntry {
    alias_name: string;
    supporter_since: string | null;
}

/**
 * The public Supporters' Ledger (About page). Uses the cookie-less anon client
 * so the About page can stay static/ISR; get_supporters_ledger (migration 142)
 * is a DEFINER RPC granted to anon that returns alias + since ONLY for
 * supporters who opted in. Missing RPC / any error → empty ledger.
 */
export async function fetchSupportersLedger(): Promise<SupportersLedgerEntry[]> {
    try {
        const supabase = createAnonClient();
        const { data, error } = await supabase.rpc("get_supporters_ledger");
        if (error || !Array.isArray(data)) return [];
        return data.filter((row) => typeof row?.alias_name === "string" && row.alias_name.length > 0);
    } catch {
        return [];
    }
}

/** "March 2026" — shared date formatting for plaque + ledger. */
export function formatSupporterSince(since: string | null): string | null {
    if (!since) return null;
    const d = new Date(since);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
