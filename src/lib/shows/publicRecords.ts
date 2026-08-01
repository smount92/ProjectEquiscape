/**
 * Shows domain — public passport show records (Wave 5a — commerce).
 *
 * Fetches a PUBLIC horse's show records through the anon-granted
 * get_public_horse_records DEFINER RPC (migration 146) so the
 * logged-out public passport (AnonPassport) — the page a prospective
 * buyer lands on — can render the horse's competitive record.
 * show_records RLS is authenticated-only (022/027), so this RPC is
 * the ONLY anon read path.
 *
 * Graceful degradation is the contract here (same as publicCards.ts):
 * the owner applies migrations by hand, so until 146 lands the RPC
 * does not exist. ANY error (missing function, network, malformed
 * rows) returns [] — the section renders nothing and the passport
 * never breaks, with zero console spam.
 */

import { createAnonClient } from "@/lib/supabase/anon";
import type { MarketRecordDetailRow } from "@/lib/market/recordSummary";

/** Raw row shape returned by get_public_horse_records (migration 146). */
interface PublicRecordRow {
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
 * Pure mapping RPC rows → the market record view model (so the anon
 * section reuses the same summary/ranking helpers the market
 * quick-look uses). Tolerant of junk: rows missing an id or show name
 * are dropped rather than rendering a broken line.
 */
export function mapPublicRecordRows(rows: unknown): MarketRecordDetailRow[] {
    if (!Array.isArray(rows)) return [];
    const records: MarketRecordDetailRow[] = [];
    for (const raw of rows) {
        if (raw === null || typeof raw !== "object") continue;
        const row = raw as Partial<PublicRecordRow>;
        if (typeof row.id !== "string" || row.id.length === 0) continue;
        if (typeof row.show_name !== "string" || row.show_name.length === 0) continue;
        records.push({
            id: row.id,
            showName: row.show_name,
            showId: typeof row.show_id === "string" ? row.show_id : null,
            showDate: typeof row.show_date === "string" ? row.show_date : null,
            showDateText: typeof row.show_date_text === "string" ? row.show_date_text : null,
            className: typeof row.class_name === "string" ? row.class_name : null,
            division: typeof row.division === "string" ? row.division : null,
            placing: typeof row.placing === "string" ? row.placing : null,
            ribbonColor: typeof row.ribbon_color === "string" ? row.ribbon_color : null,
            verificationTier: typeof row.verification_tier === "string" ? row.verification_tier : null,
            isNan: row.is_nan === true,
        });
    }
    return records;
}

/**
 * A public horse's show records, or [] on any failure. Cookie-less
 * anon client: the RPC is anon-granted and visibility-guarded
 * server-side (public horses only).
 */
export async function getPublicHorseRecords(horseId: string): Promise<MarketRecordDetailRow[]> {
    try {
        const supabase = createAnonClient();
        // get_public_horse_records ships in migration 146 (not yet in
        // generated types → cast, same idiom as publicCards.ts / 141).
        const rpc = supabase.rpc.bind(supabase) as unknown as (
            fn: string,
            args: { p_horse_id: string },
        ) => Promise<{ data: unknown; error: unknown }>;
        const { data, error } = await rpc("get_public_horse_records", { p_horse_id: horseId });
        if (error || !data) return [];
        return mapPublicRecordRows(data);
    } catch {
        return [];
    }
}
