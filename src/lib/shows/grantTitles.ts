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
 * Judge attribution for CH (a card has no judge column): the
 * judge_id recorded on the card's own placing row — the person who
 * ACTUALLY judged it. The staff roster is deliberately not
 * consulted (owner decision 2026-08-19: a padded roster must not
 * satisfy the 2-different-judges honesty rule).
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

/** PostgREST `.in()` serializes ids into the GET query string — a
 *  big career (hundreds of classes) would 414. Chunk every
 *  career-sized id list. */
const IN_CHUNK = 150;

async function selectInChunks<T>(
    values: string[],
    run: (chunk: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[] | { error: string }> {
    const out: T[] = [];
    for (let i = 0; i < values.length; i += IN_CHUNK) {
        const { data, error } = await run(values.slice(i, i + IN_CHUNK));
        if (error) return { error: error.message };
        out.push(...(((data as T[]) ?? [])));
    }
    return out;
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

    const fieldRows = await selectInChunks<Record<string, unknown>>(classIds, (chunk) =>
        supabase
            .from("show_class_entries")
            .select("id, show_id, class_id, horse_id, owner_id")
            .in("class_id", chunk)
            .neq("status", "scratched"),
    );
    if (!Array.isArray(fieldRows)) return { error: fieldRows.error };
    const entriesById = new Map<string, StandingsEntryRow>(seedEntries);
    for (const row of fieldRows) {
        entriesById.set(row.id as string, row as unknown as StandingsEntryRow);
    }
    const entries = [...entriesById.values()];
    const showIds = [...new Set(entries.map((e) => e.show_id))];
    const entryIds = entries.map((e) => e.id);

    // 3. Shows, placings (with recorder judge), callbacks — chunked.
    const [showRows, placingRows, callbackRows] = await Promise.all([
        selectInChunks<StandingsShowRow>(showIds, (chunk) =>
            supabase.from("shows").select("id, status, show_year, is_mhh_qualifying").in("id", chunk),
        ),
        selectInChunks<PlacingRow>(entryIds, (chunk) =>
            supabase.from("show_placings").select("entry_id, place, judge_id").in("entry_id", chunk),
        ),
        selectInChunks<StandingsCallbackRow>(showIds, (chunk) =>
            supabase
                .from("show_callbacks")
                .select("scope, champion_entry_id")
                .in("show_id", chunk)
                .not("champion_entry_id", "is", null),
        ),
    ]);
    if (!Array.isArray(showRows)) return { error: showRows.error };
    if (!Array.isArray(placingRows)) return { error: placingRows.error };
    if (!Array.isArray(callbackRows)) return { error: callbackRows.error };
    const shows = showRows;
    const placings = placingRows;
    const callbacks = callbackRows;

    const { horsePoints, ownerPoints } = buildCareerTotals({
        shows,
        entries,
        placings,
        callbacks,
    });

    // 4. Cards + judge attribution for CH. Owner decision 2026-08-19
    // (audit SEV-3): a card's judge is the person who ACTUALLY judged
    // it — the judge_id recorded on the card's placing row. The staff
    // roster is ignored: a listed judge who never placed a class must
    // not satisfy the "2 different judges" honesty rule.
    const { data: cardRows, error: cardsError } = await supabase
        .from("qualification_cards")
        .select("show_id, class_id, horse_id, status")
        .in("horse_id", horseIds);
    if (cardsError) return { error: cardsError.message };

    const judgeByEntry = new Map<string, string>();
    for (const p of placings) {
        if (p.judge_id) judgeByEntry.set(p.entry_id, p.judge_id);
    }
    const entryByClassHorse = new Map<string, string>();
    for (const e of entries) {
        entryByClassHorse.set(`${e.class_id}::${e.horse_id}`, e.id);
    }

    const cardsByHorse = new Map<string, TitleCardInput[]>();
    for (const card of cardRows ?? []) {
        const entryId = entryByClassHorse.get(`${card.class_id}::${card.horse_id}`);
        const recorder = entryId ? judgeByEntry.get(entryId) : undefined;
        const list = cardsByHorse.get(card.horse_id as string) ?? [];
        list.push({
            showId: card.show_id as string,
            status: card.status as string,
            judgeIds: recorder ? [recorder] : [],
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

    // Diff against existing grants BEFORE the upsert so only genuinely
    // NEW titles notify (audit S8: title grants were silent). The
    // upsert stays ignoreDuplicates — a racing publish is still free.
    const [existingTitles, existingDistinctions] = await Promise.all([
        supabase.from("horse_titles").select("horse_id, title_code").in("horse_id", horseIds),
        supabase
            .from("exhibitor_distinctions")
            .select("user_id, distinction_code")
            .in("user_id", ownerIds),
    ]);
    const hadTitle = new Set(
        ((existingTitles.data ?? []) as { horse_id: string; title_code: string }[]).map(
            (r) => `${r.horse_id}::${r.title_code}`,
        ),
    );
    const hadDistinction = new Set(
        ((existingDistinctions.data ?? []) as { user_id: string; distinction_code: string }[]).map(
            (r) => `${r.user_id}::${r.distinction_code}`,
        ),
    );

    const untypedFrom = supabase.from.bind(supabase) as unknown as UntypedUpsert;

    // Career ledgers (163): persist the totals this run computed so
    // passports/profiles/progress ladders have a cheap read path.
    // Full upsert (not ignoreDuplicates) — totals move every publish.
    const careerHorseRows = horseIds
        .filter((id) => horsePoints.has(id))
        .map((id) => ({ horse_id: id, career_points: horsePoints.get(id) ?? 0 }));
    if (careerHorseRows.length > 0) {
        const { error } = await untypedFrom("horse_career").upsert(careerHorseRows, {
            onConflict: "horse_id",
            ignoreDuplicates: false,
        });
        if (error) console.error(`horse_career write failed: ${error.message}`);
    }
    const careerOwnerRows = ownerIds
        .filter((id) => ownerPoints.has(id))
        .map((id) => ({ user_id: id, career_points: ownerPoints.get(id) ?? 0 }));
    if (careerOwnerRows.length > 0) {
        const { error } = await untypedFrom("exhibitor_career").upsert(careerOwnerRows, {
            onConflict: "user_id",
            ignoreDuplicates: false,
        });
        if (error) console.error(`exhibitor_career write failed: ${error.message}`);
    }

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

    // Notify the payoffs (best-effort; grants stand regardless).
    try {
        const newTitleRows = titleRows.filter(
            (r) => !hadTitle.has(`${r.horse_id}::${r.title_code}`),
        );
        if (newTitleRows.length > 0) {
            const { HORSE_TITLE_LABELS } = await import("./titles");
            const { createNotification } = await import(
                "@/lib/notifications/createNotification"
            );
            const grantedHorseIds = [...new Set(newTitleRows.map((r) => r.horse_id as string))];
            const { data: horses } = await supabase
                .from("user_horses")
                .select("id, owner_id, custom_name")
                .in("id", grantedHorseIds);
            const horseById = new Map(
                ((horses ?? []) as { id: string; owner_id: string; custom_name: string }[]).map(
                    (h) => [h.id, h],
                ),
            );
            for (const row of newTitleRows) {
                const horse = horseById.get(row.horse_id as string);
                if (!horse) continue;
                const label =
                    HORSE_TITLE_LABELS[row.title_code as keyof typeof HORSE_TITLE_LABELS] ??
                    (row.title_code as string);
                await createNotification({
                    userId: horse.owner_id,
                    type: "show_title",
                    actorId: null,
                    content: `🏆 ${horse.custom_name} earned the MHH ${label} (${row.title_code}) title!`,
                    linkUrl: `/community/${horse.id}`,
                });
            }
        }
        const newDistinctionRows = distinctionRows.filter(
            (r) => !hadDistinction.has(`${r.user_id}::${r.distinction_code}`),
        );
        if (newDistinctionRows.length > 0) {
            const { EXHIBITOR_DISTINCTION_LABELS } = await import("./titles");
            const { createNotification } = await import(
                "@/lib/notifications/createNotification"
            );
            for (const row of newDistinctionRows) {
                const label =
                    EXHIBITOR_DISTINCTION_LABELS[
                        row.distinction_code as keyof typeof EXHIBITOR_DISTINCTION_LABELS
                    ] ?? (row.distinction_code as string);
                await createNotification({
                    userId: row.user_id as string,
                    type: "show_title",
                    actorId: null,
                    content: `⭐ You earned the ${label} distinction!`,
                    linkUrl: `/standings`,
                });
            }
        }
    } catch {
        // Never fail grants over a notification hiccup.
    }

    return { horseTitles: titleRows.length, distinctions: distinctionRows.length };
}
