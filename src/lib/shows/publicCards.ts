/**
 * Shows domain — public passport cards (Wave 2).
 *
 * Fetches a PUBLIC horse's live MHH qualification cards through the
 * anon-granted get_public_horse_cards DEFINER RPC (migration 141) so
 * the public passport /community/[id] — the page a buyer sees — can
 * render the same trust section the private passport has.
 *
 * Graceful degradation is the contract here: the owner applies
 * migrations by hand, so until 141 lands the RPC does not exist.
 * ANY error (missing function, network, malformed rows) returns []
 * — the section renders nothing and the passport never breaks, with
 * zero console spam.
 */

import { createAnonClient } from "@/lib/supabase/anon";
import type { PassportQualificationCard } from "@/components/shows/QualificationCardsSection";
import type { CardStatus } from "./types";

/** Raw row shape returned by get_public_horse_cards (migration 141). */
export interface PublicCardRow {
    code: string;
    earned_place: number;
    status: string;
    show_year: number | null;
    show_title: string;
    class_name: string;
    issued_at: string;
    /** Migration 153 — absent until the owner applies it. */
    class_entry_count?: number | null;
    class_exhibitor_count?: number | null;
    is_stakes?: boolean | null;
}

const CARD_STATUSES: readonly string[] = ["issued", "transferred", "redeemed", "void"];

/**
 * Pure mapping RPC rows → the passport card shape. Tolerant of junk:
 * rows missing a code, place, or status are dropped rather than
 * rendering a broken plaque.
 */
export function mapPublicCardRows(rows: unknown): PassportQualificationCard[] {
    if (!Array.isArray(rows)) return [];
    const cards: PassportQualificationCard[] = [];
    for (const raw of rows) {
        if (raw === null || typeof raw !== "object") continue;
        const row = raw as Partial<PublicCardRow>;
        if (typeof row.code !== "string" || row.code.length === 0) continue;
        if (row.earned_place !== 1 && row.earned_place !== 2) continue;
        if (typeof row.status !== "string" || !CARD_STATUSES.includes(row.status)) continue;
        cards.push({
            code: row.code,
            earnedPlace: row.earned_place,
            status: row.status as CardStatus,
            showYear: typeof row.show_year === "number" ? row.show_year : null,
            showTitle: typeof row.show_title === "string" ? row.show_title : "Unknown show",
            className: typeof row.class_name === "string" ? row.class_name : "Unknown class",
            issuedAt: typeof row.issued_at === "string" ? row.issued_at : "",
            classEntryCount:
                typeof row.class_entry_count === "number" ? row.class_entry_count : null,
            classExhibitorCount:
                typeof row.class_exhibitor_count === "number" ? row.class_exhibitor_count : null,
            isStakes: row.is_stakes === true,
        });
    }
    return cards;
}

/**
 * A public horse's live cards, or [] on any failure. Cookie-less anon
 * client: the RPC is anon-granted and visibility-guarded server-side,
 * so the same call serves logged-in and logged-out passport views.
 */
export async function getPublicHorseCards(horseId: string): Promise<PassportQualificationCard[]> {
    try {
        const supabase = createAnonClient();
        // get_public_horse_cards ships in migration 141 (not yet in
        // generated types → cast, same idiom as AnonPassport / 135).
        const rpc = supabase.rpc.bind(supabase) as unknown as (
            fn: string,
            args: { p_horse_id: string },
        ) => Promise<{ data: unknown; error: unknown }>;
        const { data, error } = await rpc("get_public_horse_cards", { p_horse_id: horseId });
        if (error || !data) return [];
        return mapPublicCardRows(data);
    } catch {
        return [];
    }
}
