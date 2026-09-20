/**
 * Seller terms (migration 218): the once-set facts a buyer wants before
 * messaging — where the seller is, where they ship, where they do not,
 * whether they trade, and what they are looking for. Asked for by the
 * first professional artist on the site, who used to check a country
 * flag on Model Horse Central before deciding to buy at all.
 *
 * Five columns on users, read through the anon-safe DEFINER RPC
 * get_public_seller_terms so a logged-out buyer sees the same panel a
 * member does. The owner pastes migrations by hand, so every read here
 * tolerates a missing RPC or column (empty, never an error) and the save
 * path retries without the five columns (see `isMissingSellerColumn`).
 *
 * The Want List stays private by the owner's ruling; `lookingFor` is the
 * public, one-line stand-in a seller chooses to publish.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { isCountryCode } from "@/lib/geo/countries";

export const SELLER_COLUMNS = ["country", "ships_to", "ships_not_to", "open_to_trades", "looking_for"] as const;

export const SHIPS_MAX = 200;
export const LOOKING_FOR_MAX = 300;

export interface SellerTerms {
    userId: string;
    /** ISO 3166-1 alpha-2, upper case. */
    country: string | null;
    shipsTo: string | null;
    shipsNotTo: string | null;
    openToTrades: boolean;
    lookingFor: string | null;
}

export function emptySellerTerms(userId: string): SellerTerms {
    return { userId, country: null, shipsTo: null, shipsNotTo: null, openToTrades: false, lookingFor: null };
}

function text(v: unknown, max: number): string | null {
    return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null;
}

/** Map a raw row (RPC or table) to the terms. */
export function sellerTermsFrom(row: Record<string, unknown> | null | undefined, userId?: string): SellerTerms {
    const id = (typeof row?.user_id === "string" && row.user_id) || (typeof row?.id === "string" && row.id) || userId || "";
    if (!row) return emptySellerTerms(id);
    const rawCountry = typeof row.country === "string" ? row.country.toUpperCase() : null;
    return {
        userId: id,
        country: isCountryCode(rawCountry) ? rawCountry : null,
        shipsTo: text(row.ships_to, SHIPS_MAX),
        shipsNotTo: text(row.ships_not_to, SHIPS_MAX),
        openToTrades: row.open_to_trades === true,
        lookingFor: text(row.looking_for, LOOKING_FOR_MAX),
    };
}

/** Anything worth a "Shipping & seller" panel at all. */
export function hasSellerTerms(t: SellerTerms | null | undefined): boolean {
    return !!t && !!(t.country || t.shipsTo || t.shipsNotTo || t.openToTrades || t.lookingFor);
}

/** True when a save failed only because migration 218 is not in the database yet. */
export function isMissingSellerColumn(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
    if (!err) return false;
    const code = err.code ?? "";
    const message = err.message ?? "";
    if (code !== "42703" && code !== "PGRST204") return false;
    return SELLER_COLUMNS.some((c) => message.includes(c));
}

export function withoutSellerColumns<T extends Record<string, unknown>>(row: T): T {
    const copy = { ...row };
    for (const c of SELLER_COLUMNS) delete copy[c];
    return copy;
}

/** How many ids one RPC call carries; the function clamps the same. */
const RPC_BATCH = 100;

/**
 * Seller terms for a set of members, keyed by user id. Works for anon
 * and members alike (DEFINER RPC, public-safe columns only). Empty map
 * when the RPC is not there yet, never an error.
 */
export async function readSellerTerms(client: SupabaseClient, userIds: readonly string[]): Promise<Map<string, SellerTerms>> {
    const out = new Map<string, SellerTerms>();
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return out;
    const rpc = client.rpc.bind(client) as unknown as (
        fn: string,
        args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
    for (let i = 0; i < ids.length; i += RPC_BATCH) {
        try {
            const { data, error } = await rpc("get_public_seller_terms", { p_user_ids: ids.slice(i, i + RPC_BATCH) });
            if (error || !Array.isArray(data)) continue;
            for (const row of data as Record<string, unknown>[]) {
                const t = sellerTermsFrom(row);
                if (t.userId) out.set(t.userId, t);
            }
        } catch {
            // pre-paste: no RPC, no panel
        }
    }
    return out;
}

/** The same, for one member by alias (the public passport RPC carries the alias, not the id). */
export async function readSellerTermsByAlias(client: SupabaseClient, alias: string): Promise<SellerTerms | null> {
    if (!alias.trim()) return null;
    try {
        const rpc = client.rpc.bind(client) as unknown as (
            fn: string,
            args: Record<string, unknown>,
        ) => PromiseLike<{ data: unknown; error: unknown }>;
        const { data, error } = await rpc("get_public_seller_terms", { p_aliases: [alias.trim()] });
        if (error || !Array.isArray(data) || data.length === 0) return null;
        return sellerTermsFrom(data[0] as Record<string, unknown>);
    } catch {
        return null;
    }
}
