/**
 * Titles — public reads for passports and profiles.
 *
 * Graceful degradation contract (publicCards.ts precedent): until
 * the owner applies migration 159 the tables don't exist — ANY
 * error returns [] and the sections render nothing.
 */

import { createAnonClient } from "@/lib/supabase/anon";
import {
    EXHIBITOR_DISTINCTION_LABELS,
    HORSE_TITLE_LABELS,
    highestStar,
    type ExhibitorDistinctionCode,
    type HorseTitleCode,
} from "./titles";

export interface HorseTitleRow {
    code: HorseTitleCode;
    label: string;
    grantedAt: string;
    showYear: number | null;
}

/** Untyped read (tables enter generated types after 159). */
type UntypedSelect = (table: string) => {
    select: (cols: string) => {
        eq: (
            col: string,
            val: string,
        ) => PromiseLike<{ data: unknown; error: unknown }>;
    };
};

export async function getHorseTitles(horseId: string): Promise<HorseTitleRow[]> {
    try {
        const supabase = createAnonClient();
        const from = supabase.from.bind(supabase) as unknown as UntypedSelect;
        const { data, error } = await from("horse_titles")
            .select("title_code, granted_at, show_year")
            .eq("horse_id", horseId);
        if (error || !Array.isArray(data)) return [];
        const rows: HorseTitleRow[] = [];
        for (const raw of data) {
            const row = raw as { title_code?: string; granted_at?: string; show_year?: number | null };
            const code = row.title_code as HorseTitleCode | undefined;
            if (!code || !(code in HORSE_TITLE_LABELS)) continue;
            rows.push({
                code,
                label: HORSE_TITLE_LABELS[code],
                grantedAt: typeof row.granted_at === "string" ? row.granted_at : "",
                showYear: typeof row.show_year === "number" ? row.show_year : null,
            });
        }
        // Display order: CH, then marks (SUP before ROM).
        const order: Record<string, number> = { CH: 0, SUP: 1, ROM: 2 };
        rows.sort((a, b) => (order[a.code] ?? 9) - (order[b.code] ?? 9));
        return rows;
    } catch {
        return [];
    }
}

/** The exhibitor's highest star grade, or null (none / pre-159). */
export async function getExhibitorStar(
    userId: string,
): Promise<{ code: ExhibitorDistinctionCode; label: string; stars: number } | null> {
    try {
        const supabase = createAnonClient();
        const from = supabase.from.bind(supabase) as unknown as UntypedSelect;
        const { data, error } = await from("exhibitor_distinctions")
            .select("distinction_code")
            .eq("user_id", userId);
        if (error || !Array.isArray(data)) return null;
        const codes = data
            .map((r) => (r as { distinction_code?: string }).distinction_code)
            .filter((c): c is string => typeof c === "string");
        const top = highestStar(codes);
        if (!top) return null;
        return {
            code: top,
            label: EXHIBITOR_DISTINCTION_LABELS[top],
            stars: Number(top.slice(-1)),
        };
    } catch {
        return null;
    }
}
