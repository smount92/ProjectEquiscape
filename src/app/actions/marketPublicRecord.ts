"use server";

/**
 * Market quick-look — the ANON-SAFE competitive record.
 *
 * The listing card's 🏆 chip opens a dialog that fetches one horse's
 * record on demand. Until now that dialog called getMarketHorseRecord
 * (src/app/actions/market.ts), which starts with requireAuth() — so it
 * threw for exactly the logged-out buyer the marketplace front door
 * exists to convert: the chip rendered, the click opened, the dialog
 * showed "Could not load the show record."
 *
 * This is the same view model built from the PUBLIC read paths that
 * already exist and are already anon-granted:
 *   - get_public_horse_records (migration 146) via getPublicHorseRecords
 *   - get_public_horse_cards   (migration 141) via getPublicHorseCards
 * Both are visibility-guarded server-side (public horses only) and both
 * degrade to nothing until their migration is applied.
 *
 * No data is published that those RPCs do not already publish. What
 * they withhold — judge names, notes, show location, owner identity —
 * stays withheld; this function never reads show_records directly for
 * an anonymous viewer.
 *
 * The authed capability is preserved rather than replaced: when the
 * public path yields no rows AND there is a session, one RLS-scoped
 * read follows. That covers the two cases 146 deliberately declines
 * (an owner looking at their own private/unlisted horse) plus the
 * pre-146 world, so signed-in viewers see exactly what they saw
 * before.
 *
 * Lives in its own file on purpose: src/app/actions/market.ts is a
 * shared surface other pages depend on, and this needs none of it.
 */

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getPublicHorseCards } from "@/lib/shows/publicCards";
import { getPublicHorseRecords } from "@/lib/shows/publicRecords";
import {
    sortRecordsBestFirst,
    summarizeShowRecords,
    type MarketRecordDetailRow,
} from "@/lib/market/recordSummary";
import type { MarketHorseRecord } from "@/app/actions/market";

/** Bound the trophy-case read for one horse (campaigners included). */
const MAX_DETAIL_RECORDS = 200;
/** "Recent placings, best first" — the dialog shows at most this many. */
const TOP_RECORDS_SHOWN = 5;

const publicRecordSchema = z.object({ horseId: z.uuid() });

/** Raw show_records columns of the signed-in fallback read. */
interface SessionRecordRow {
    id: string;
    show_name: string;
    show_id: string | null;
    show_date: string | null;
    show_date_text: string | null;
    division: string | null;
    class_name: string | null;
    placing: string | null;
    ribbon_color: string | null;
    verification_tier: string | null;
    is_nan: boolean | null;
}

/**
 * The signed-in fallback: the viewer's own RLS-scoped read. RLS only
 * returns rows for public horses or the viewer's own, so a private
 * horse belonging to someone else still yields nothing. Returns []
 * for anonymous viewers — they get the public path or nothing.
 */
async function fetchViaSession(horseId: string): Promise<MarketRecordDetailRow[]> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from("show_records")
            .select(
                'id, show_name, show_id, show_date, show_date_text, division, class_name, "placing", ribbon_color, verification_tier, is_nan',
            )
            .eq("horse_id", horseId)
            .order("show_date", { ascending: false, nullsFirst: false })
            .limit(MAX_DETAIL_RECORDS);
        if (error) return [];

        return ((data ?? []) as SessionRecordRow[]).map((r) => ({
            id: r.id,
            showName: r.show_name,
            showId: r.show_id,
            showDate: r.show_date,
            showDateText: r.show_date_text,
            className: r.class_name,
            division: r.division,
            placing: r.placing,
            ribbonColor: r.ribbon_color,
            verificationTier: r.verification_tier,
            isNan: r.is_nan === true,
        }));
    } catch {
        return [];
    }
}

/**
 * One listed horse's competitive record for the market quick-look —
 * readable by anyone, because the horse's record is the product and a
 * buyer should not need an account to see it.
 */
export async function getPublicMarketHorseRecord(
    input: z.input<typeof publicRecordSchema>,
): Promise<{ success: true; record: MarketHorseRecord } | { success: false; error: string }> {
    const parsed = publicRecordSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid horse id." };
    const { horseId } = parsed.data;

    try {
        const [publicRecords, cards] = await Promise.all([
            getPublicHorseRecords(horseId),
            getPublicHorseCards(horseId),
        ]);

        const records =
            publicRecords.length > 0 ? publicRecords : await fetchViaSession(horseId);

        const summary =
            summarizeShowRecords(
                records.map((r) => ({
                    horse_id: horseId,
                    placing: r.placing,
                    ribbon_color: r.ribbonColor,
                    verification_tier: r.verificationTier,
                })),
            ).get(horseId) ?? null;

        return {
            success: true,
            record: {
                summary,
                topRecords: sortRecordsBestFirst(records).slice(0, TOP_RECORDS_SHOWN),
                cardCount: cards.length,
            },
        };
    } catch {
        return { success: false, error: "Could not load the show record." };
    }
}
