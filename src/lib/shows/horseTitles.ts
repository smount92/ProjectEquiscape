/**
 * Titles — public reads for passports and profiles.
 *
 * Graceful degradation contract (publicCards.ts precedent): until
 * the owner applies migration 159 the tables don't exist — ANY
 * error returns [] and the sections render nothing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAnonClient } from "@/lib/supabase/anon";
import {
    EXHIBITOR_DISTINCTION_LABELS,
    HORSE_TITLE_LABELS,
    highestStar,
    horseTitleProgress,
    type ExhibitorDistinctionCode,
    type HorseTitleCode,
    type TitleCardInput,
    type TitleProgress,
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

/**
 * The OWNER's full title ladder for one of their horses: earned
 * titles + live progress toward the rest (CH's judge/show counts
 * derived from the actual placing records, same attribution the
 * grant engine uses). Owner's own server client — their card reads
 * ride the card-people RLS branch. Any failure degrades to a
 * ladder built from what loaded ([] cards / 0 points), never a
 * crash: this is a decoration, not a gate.
 */
export async function getOwnerHorseLadder(
    supabase: SupabaseClient,
    horseId: string,
): Promise<{ progress: TitleProgress[]; careerPoints: number }> {
    try {
        const [titlesRes, careerRes, cardsRes] = await Promise.all([
            supabase.from("horse_titles").select("title_code").eq("horse_id", horseId),
            supabase
                .from("horse_career")
                .select("career_points")
                .eq("horse_id", horseId)
                .maybeSingle(),
            supabase
                .from("qualification_cards")
                .select("show_id, class_id, status")
                .eq("horse_id", horseId),
        ]);
        const grantedCodes = (titlesRes.data ?? []).map((r) => r.title_code as string);
        const careerPoints =
            (careerRes.data as { career_points: number } | null)?.career_points ?? 0;
        const rawCards = (cardsRes.data ?? []) as {
            show_id: string;
            class_id: string;
            status: string;
        }[];

        // Judge attribution per card via its placing recorder — only
        // fetched when the horse actually holds cards.
        const judgeByClass = new Map<string, string>();
        if (rawCards.length > 0) {
            const classIds = rawCards.map((c) => c.class_id);
            const { data: entries } = await supabase
                .from("show_class_entries")
                .select("id, class_id")
                .eq("horse_id", horseId)
                .in("class_id", classIds);
            const entryIds = (entries ?? []).map((e) => e.id as string);
            const entryToClass = new Map(
                (entries ?? []).map((e) => [e.id as string, e.class_id as string]),
            );
            if (entryIds.length > 0) {
                const { data: placings } = await supabase
                    .from("show_placings")
                    .select("entry_id, judge_id")
                    .in("entry_id", entryIds);
                for (const p of placings ?? []) {
                    const classId = entryToClass.get(p.entry_id as string);
                    if (classId && p.judge_id) judgeByClass.set(classId, p.judge_id as string);
                }
            }
        }
        const cards: TitleCardInput[] = rawCards.map((c) => {
            const judge = judgeByClass.get(c.class_id);
            return { showId: c.show_id, status: c.status, judgeIds: judge ? [judge] : [] };
        });

        return { progress: horseTitleProgress({ cards, careerPoints, grantedCodes }), careerPoints };
    } catch {
        return {
            progress: horseTitleProgress({ cards: [], careerPoints: 0, grantedCodes: [] }),
            careerPoints: 0,
        };
    }
}

/** Live MHH card counts for a profile strap (anon-safe count-only
 *  RPC, 164) — null on any failure or pre-migration. */
export async function getExhibitorCardCount(
    userId: string,
): Promise<{ liveCards: number; stakesCards: number } | null> {
    try {
        const supabase = createAnonClient();
        const { data, error } = await supabase.rpc("get_exhibitor_card_count", {
            p_user_id: userId,
        });
        if (error || !Array.isArray(data) || data.length === 0) return null;
        const row = data[0] as { live_cards: number | null; stakes_cards: number | null };
        return { liveCards: row.live_cards ?? 0, stakesCards: row.stakes_cards ?? 0 };
    } catch {
        return null;
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
