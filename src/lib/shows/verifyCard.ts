/**
 * Shows domain — public card verification (Phase F).
 *
 * The /cards/[code] page is the trust feature: ANYONE (anon
 * included) can check that an MHH qualification card is real
 * before buying a horse. Reads go through the SECURITY DEFINER
 * verify_qualification_card RPC (migration 118) so the table
 * itself is never crawlable — one code in, one card's public
 * face out.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isValidCardCode } from "./cards";
import type { CardStatus } from "./types";

export interface CardVerification {
    code: string;
    status: CardStatus;
    earnedPlace: 1 | 2;
    showYear: number | null;
    showTitle: string;
    className: string;
    issuedAt: string;
    /**
     * Added to the RPC in migration 120 — tolerated as missing so
     * the page keeps working until the owner applies it (interim
     * Phase-B-style overlay; regenerate types after 120).
     */
    horseName: string | null;
}

export async function verifyCard(
    supabase: SupabaseClient,
    rawCode: string,
): Promise<CardVerification | null | { error: string }> {
    const code = rawCode.trim();
    // Malformed codes can't exist — skip the round-trip.
    if (!isValidCardCode(code)) return null;

    const { data, error } = await supabase.rpc("verify_qualification_card", {
        p_code: code,
    });
    if (error) return { error: error.message };

    const row = (Array.isArray(data) ? data[0] : data) as
        | {
              code: string;
              status: string;
              earned_place: number;
              show_year: number | null;
              show_title: string;
              class_name: string;
              issued_at: string;
              horse_name?: string | null;
          }
        | undefined;
    if (!row) return null;

    return {
        code: row.code,
        status: row.status as CardStatus,
        earnedPlace: row.earned_place as 1 | 2,
        showYear: row.show_year ?? null,
        showTitle: row.show_title,
        className: row.class_name,
        issuedAt: row.issued_at,
        horseName: row.horse_name ?? null,
    };
}
