"use server";

/**
 * "My Show Life" server action (Wave 2) — the member's cross-show
 * view: what am I entered in, and how did I do?
 *
 * Deliberately self-contained: OWN scoped queries, no imports from
 * shows-v2.ts. Every read is owner_id = me (RLS "Public reads
 * entries of visible shows" also allows owner reads regardless of
 * show status) plus id-list lookups for titles/names.
 *
 * Failure contract: this feeds a dashboard rail and a browse-page
 * section — it must NEVER take a page down. Any error (including
 * shows-domain tables missing on an environment where the owner has
 * not applied 117/118) returns EMPTY_SHOW_LIFE silently, and both
 * surfaces hide at zero data.
 */

import { createClient } from "@/lib/supabase/server";
import {
    buildShowLife,
    EMPTY_SHOW_LIFE,
    RESULT_LIFE_STATUSES,
    type MyShowLife,
    type ShowLifeEntryRow,
    type ShowLifePlacingRow,
    type ShowLifeShowRow,
} from "@/lib/shows/showLife";
import type { ShowStatus } from "@/lib/shows/types";

export async function getMyShowLife(): Promise<MyShowLife> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return EMPTY_SHOW_LIFE;

        // 1. Every live entry I own, across all shows (scratched rows
        //    are history — they don't belong in "my show life").
        const { data: rawEntries, error: entriesError } = await supabase
            .from("show_class_entries")
            .select("id, show_id, class_id, horse_id")
            .eq("owner_id", user.id)
            .neq("status", "scratched")
            .order("created_at", { ascending: true });
        if (entriesError || !rawEntries || rawEntries.length === 0) return EMPTY_SHOW_LIFE;
        const entries = rawEntries as unknown as ShowLifeEntryRow[];

        // 2. The shows those entries belong to.
        const showIds = [...new Set(entries.map((e) => e.show_id))];
        const { data: rawShows, error: showsError } = await supabase
            .from("shows")
            .select("id, title, status, entries_close_at, updated_at")
            .in("id", showIds);
        if (showsError || !rawShows) return EMPTY_SHOW_LIFE;
        const shows = rawShows as unknown as ShowLifeShowRow[];

        // 3. My placings — but only from shows whose results are
        //    PUBLISHED (completed/archived). Provisional placings in
        //    results_review stay with the host.
        const resultShowIds = new Set(
            shows
                .filter((s) => RESULT_LIFE_STATUSES.includes(s.status as ShowStatus))
                .map((s) => s.id),
        );
        const resultEntryIds = entries
            .filter((e) => resultShowIds.has(e.show_id))
            .map((e) => e.id);
        let placings: ShowLifePlacingRow[] = [];
        if (resultEntryIds.length > 0) {
            const { data: rawPlacings, error: placingsError } = await supabase
                .from("show_placings")
                .select("entry_id, class_id, place")
                .in("entry_id", resultEntryIds)
                .not("place", "is", null);
            if (placingsError) return EMPTY_SHOW_LIFE;
            placings = (rawPlacings ?? []) as unknown as ShowLifePlacingRow[];
        }

        // 4. Names for display: classes (active listing + placings) and
        //    my horses (placing lines). Both tolerate missing rows —
        //    e.g. a horse transferred away after the show.
        const classIds = [
            ...new Set([...entries.map((e) => e.class_id), ...placings.map((p) => p.class_id)]),
        ];
        const classNamesById = new Map<string, string>();
        if (classIds.length > 0) {
            const { data: classRows } = await supabase
                .from("show_classes")
                .select("id, name")
                .in("id", classIds);
            for (const row of classRows ?? []) {
                classNamesById.set(row.id as string, (row.name as string | null) ?? "Class");
            }
        }

        const horseIds = [...new Set(entries.map((e) => e.horse_id))];
        const horseNamesById = new Map<string, string>();
        if (horseIds.length > 0) {
            const { data: horseRows } = await supabase
                .from("user_horses")
                .select("id, custom_name")
                .in("id", horseIds);
            for (const row of horseRows ?? []) {
                horseNamesById.set(
                    row.id as string,
                    (row.custom_name as string | null) ?? "Unnamed horse",
                );
            }
        }

        return buildShowLife({ entries, shows, placings, classNamesById, horseNamesById });
    } catch {
        return EMPTY_SHOW_LIFE;
    }
}
