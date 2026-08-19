/**
 * Titles engine — I/O orchestration (Championship program §3).
 *
 * Runs after a show's results publish (inside the publish fanout's
 * after() on the ADMIN client — grants must never block or fail a
 * publish). Loads the career record of every horse and exhibitor in
 * the published show, evaluates the pure rules in titles.ts, and
 * writes grants with ignoreDuplicates upserts — re-runs are free,
 * titles are never revoked.
 *
 * Judge attribution for CH (a card has no judge column): the union
 * of the show's show_staff role='judge' roster and the judge_id
 * recorded on the card's own placing row (covers host-judges, who
 * can't hold a second show_staff row).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
    buildCareerTotals,
    type StandingsCallbackRow,
    type StandingsEntryRow,
    type StandingsShowRow,
} from "./points";
import {
    evaluateExhibitorDistinctions,
    evaluateHorseTitles,
    type TitleCardInput,
} from "./titles";

/** horse_titles/exhibitor_distinctions enter generated types after
 *  migration 159 — minimal untyped write access until then (same
 *  idiom as publicCards/135). */
type UntypedUpsert = (
    table: string,
) => {
    upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string; ignoreDuplicates: boolean },
    ) => PromiseLike<{ error: { message: string } | null }>;
};

interface PlacingRow {
    entry_id: string;
    place: number | null;
    judge_id: string | null;
}

export async function grantTitlesForShow(
    supabase: SupabaseClient,
    showId: string,
): Promise<{ horseTitles: number; distinctions: number } | { error: string }> {
    // 1. Who was in the published show?
    const { data: showEntries, error: seError } = await supabase
        .from("show_class_entries")
        .select("horse_id, owner_id")
        .eq("show_id", showId)
        .neq("status", "scratched");
    if (seError) return { error: seError.message };
    const horseIds = [...new Set((showEntries ?? []).map((e) => e.horse_id as string))];
    const ownerIds = [...new Set((showEntries ?? []).map((e) => e.owner_id as string))];
    if (horseIds.length === 0) return { horseTitles: 0, distinctions: 0 };

    // 2. Their career entries (horse ledger + person ledger), then the
    //    full field of every class involved — class size and exhibitor
    //    spread need ALL entries in those classes, not just theirs.
    const [byHorse, byOwner] = await Promise.all([
        supabase
            .from("show_class_entries")
            .select("id, show_id, class_id, horse_id, owner_id")
            .in("horse_id", horseIds)
            .neq("status", "scratched"),
        supabase
            .from("show_class_entries")
            .select("id, show_id, class_id, horse_id, owner_id")
            .in("owner_id", ownerIds)
            .neq("status", "scratched"),
    ]);
    if (byHorse.error) return { error: byHorse.error.message };
    if (byOwner.error) return { error: byOwner.error.message };
    const seedEntries = new Map<string, StandingsEntryRow>();
    for (const row of [...(byHorse.data ?? []), ...(byOwner.data ?? [])]) {
        seedEntries.set(row.id as string, row as unknown as StandingsEntryRow);
    }
    const classIds = [...new Set([...seedEntries.values()].map((e) => e.class_id))];

    const { data: fieldRows, error: fieldError } = await supabase
        .from("show_class_entries")
        .select("id, show_id, class_id, horse_id, owner_id")
        .in("class_id", classIds)
        .neq("status", "scratched");
    if (fieldError) return { error: fieldError.message };
    const entriesById = new Map<string, StandingsEntryRow>(seedEntries);
    for (const row of fieldRows ?? []) {
        entriesById.set(row.id as string, row as unknown as StandingsEntryRow);
    }
    const entries = [...entriesById.values()];
    const showIds = [...new Set(entries.map((e) => e.show_id))];
    const entryIds = entries.map((e) => e.id);

    // 3. Shows, placings (with recorder judge), callbacks — batched.
    const [showsRes, placingsRes, callbacksRes] = await Promise.all([
        supabase.from("shows").select("id, status, show_year, is_mhh_qualifying").in("id", showIds),
        supabase.from("show_placings").select("entry_id, place, judge_id").in("entry_id", entryIds),
        supabase
            .from("show_callbacks")
            .select("scope, champion_entry_id")
            .in("show_id", showIds)
            .not("champion_entry_id", "is", null),
    ]);
    if (showsRes.error) return { error: showsRes.error.message };
    if (placingsRes.error) return { error: placingsRes.error.message };
    if (callbacksRes.error) return { error: callbacksRes.error.message };
    const shows = (showsRes.data ?? []) as unknown as StandingsShowRow[];
    const placings = (placingsRes.data ?? []) as unknown as PlacingRow[];
    const callbacks = (callbacksRes.data ?? []) as unknown as StandingsCallbackRow[];

    const { horsePoints, ownerPoints } = buildCareerTotals({
        shows,
        entries,
        placings,
        callbacks,
    });

    // 4. Cards + judge attribution for CH.
    const [cardsRes, staffRes] = await Promise.all([
        supabase
            .from("qualification_cards")
            .select("show_id, class_id, horse_id, status")
            .in("horse_id", horseIds),
        supabase.from("show_staff").select("show_id, user_id").eq("role", "judge").in("show_id", showIds),
    ]);
    if (cardsRes.error) return { error: cardsRes.error.message };
    if (staffRes.error) return { error: staffRes.error.message };

    const judgesByShow = new Map<string, Set<string>>();
    for (const row of staffRes.data ?? []) {
        const set = judgesByShow.get(row.show_id as string) ?? new Set<string>();
        set.add(row.user_id as string);
        judgesByShow.set(row.show_id as string, set);
    }
    // Placing-recorder judge per (class, horse): covers host-judges.
    const judgeByEntry = new Map<string, string>();
    for (const p of placings) {
        if (p.judge_id) judgeByEntry.set(p.entry_id, p.judge_id);
    }
    const entryByClassHorse = new Map<string, string>();
    for (const e of entries) {
        entryByClassHorse.set(`${e.class_id}::${e.horse_id}`, e.id);
    }

    const cardsByHorse = new Map<string, TitleCardInput[]>();
    for (const card of cardsRes.data ?? []) {
        const judges = new Set<string>(judgesByShow.get(card.show_id as string) ?? []);
        const entryId = entryByClassHorse.get(`${card.class_id}::${card.horse_id}`);
        const recorder = entryId ? judgeByEntry.get(entryId) : undefined;
        if (recorder) judges.add(recorder);
        const list = cardsByHorse.get(card.horse_id as string) ?? [];
        list.push({
            showId: card.show_id as string,
            status: card.status as string,
            judgeIds: [...judges],
        });
        cardsByHorse.set(card.horse_id as string, list);
    }

    // 5. Evaluate + write grants (idempotent).
    const publishedShow = shows.find((s) => s.id === showId);
    const titleRows: Record<string, unknown>[] = [];
    for (const horseId of horseIds) {
        const grants = evaluateHorseTitles({
            cards: cardsByHorse.get(horseId) ?? [],
            careerPoints: horsePoints.get(horseId) ?? 0,
        });
        for (const grant of grants) {
            titleRows.push({
                horse_id: horseId,
                title_code: grant.code,
                show_year: publishedShow?.show_year ?? null,
                evidence: grant.evidence,
            });
        }
    }
    const distinctionRows: Record<string, unknown>[] = [];
    for (const ownerId of ownerIds) {
        const grants = evaluateExhibitorDistinctions({
            careerPoints: ownerPoints.get(ownerId) ?? 0,
        });
        for (const grant of grants) {
            distinctionRows.push({
                user_id: ownerId,
                distinction_code: grant.code,
                evidence: grant.evidence,
            });
        }
    }

    const untypedFrom = supabase.from.bind(supabase) as unknown as UntypedUpsert;
    if (titleRows.length > 0) {
        const { error } = await untypedFrom("horse_titles").upsert(titleRows, {
            onConflict: "horse_id,title_code",
            ignoreDuplicates: true,
        });
        if (error) return { error: error.message };
    }
    if (distinctionRows.length > 0) {
        const { error } = await untypedFrom("exhibitor_distinctions").upsert(distinctionRows, {
            onConflict: "user_id,distinction_code",
            ignoreDuplicates: true,
        });
        if (error) return { error: error.message };
    }

    return { horseTitles: titleRows.length, distinctions: distinctionRows.length };
}
