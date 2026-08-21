"use server";

/**
 * Season standings server action (Wave 3 — the sport layer v1).
 *
 * COMPUTED ON READ: no new tables, no migrations. Standings derive
 * from shows + show_class_entries + show_placings + show_callbacks
 * (championships), scored by the pure points model in
 * src/lib/shows/points.ts. At ~100 users this is a handful of
 * batched id-list queries (never per-show N+1); if it ever gets
 * hot, a materialized view can replace the middle of getStandings
 * without changing the row contract the page consumes.
 *
 * AUTHED-ONLY v1 (deliberate): the feature ships dark for owner +
 * design review, and keeping it members-only avoids minting a new
 * SECURITY DEFINER RPC for the anon alias path. Opening standings
 * to anon later means swapping requireAuth for the established
 * anon-safe alias read — the shape below doesn't change.
 */

import { AuthError, requireAuth } from "@/lib/auth";
import {
    buildHorseStandings,
    buildStableStandings,
    type HorseStandingRow,
    type StableStandingRow,
    type StandingsCallbackRow,
    type StandingsEntryRow,
    type StandingsFilter,
    type StandingsPlacingRow,
    type StandingsShowRow,
    countedShowIds,
} from "@/lib/shows/points";
import { nextStarProgress } from "@/lib/shows/titles";
import { showYearOf } from "@/lib/shows/showYear";

export type StandingsScope = "horses" | "stables";

export interface GetStandingsParams {
    /** Show year (May 1 → Apr 30) — the year it starts in. */
    showYear: number;
    scope: StandingsScope;
    /** Default true: only is_mhh_qualifying shows count. */
    qualifyingOnly?: boolean;
}

/** A counted show, for the "scored from" provenance line. */
export interface CountedShowRef {
    id: string;
    title: string;
}

export type GetStandingsResult =
    | {
          success: true;
          scope: "horses";
          rows: HorseStandingRow[];
          countedShows: CountedShowRef[];
      }
    | {
          success: true;
          scope: "stables";
          rows: StableStandingRow[];
          countedShows: CountedShowRef[];
      }
    | { success: false; error: string };

const SHOW_YEAR_MIN = 2000;
const SHOW_YEAR_MAX = 2100;

/** PostgREST caps a response at 1000 rows — page past it. */
const PAGE = 1000;
/** Hard ceiling so a runaway season can't loop forever (50 pages). */
const ENTRY_CAP = 50_000;
/** Same .in() chunk size grantTitles uses — keeps URLs sane. */
const IN_CHUNK = 150;

function chunks<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

/** The signed-in exhibitor's season at a glance (season-felt wave). */
export interface MySeason {
    showYear: number;
    /** null until they have any counted result. */
    rank: number | null;
    points: number;
    liveCards: number;
    stakesCards: number;
    careerPoints: number;
    nextStar: { label: string; pointsNeeded: number } | null;
}

export async function getMySeason(): Promise<MySeason | null> {
    try {
        const { supabase, user } = await requireAuth();
        const showYear = showYearOf(new Date());

        const standings = await getStandings({ showYear, scope: "stables" });
        const myRow =
            standings.success && standings.scope === "stables"
                ? standings.rows.find((r) => r.ownerId === user.id)
                : undefined;

        const [cardsRes, careerRes, distinctionsRes] = await Promise.all([
            supabase
                .from("qualification_cards")
                .select("id, is_stakes, status")
                .eq("current_owner_id", user.id)
                .in("status", ["issued", "transferred"]),
            supabase
                .from("exhibitor_career")
                .select("career_points")
                .eq("user_id", user.id)
                .maybeSingle(),
            supabase
                .from("exhibitor_distinctions")
                .select("distinction_code")
                .eq("user_id", user.id),
        ]);
        const cards = cardsRes.data ?? [];
        const careerPoints =
            (careerRes.data as { career_points: number } | null)?.career_points ?? 0;
        const next = nextStarProgress({
            careerPoints,
            grantedCodes: (distinctionsRes.data ?? []).map((d) => d.distinction_code as string),
        });

        return {
            showYear,
            rank: myRow?.rank ?? null,
            points: myRow?.points ?? 0,
            liveCards: cards.length,
            stakesCards: cards.filter((c) => (c as { is_stakes: boolean | null }).is_stakes === true)
                .length,
            careerPoints,
            nextStar: next ? { label: next.label, pointsNeeded: next.pointsNeeded } : null,
        };
    } catch {
        return null;
    }
}

export async function getStandings(params: GetStandingsParams): Promise<GetStandingsResult> {
    const { showYear, scope } = params;
    if (!Number.isInteger(showYear) || showYear < SHOW_YEAR_MIN || showYear > SHOW_YEAR_MAX) {
        return { success: false, error: "That show year is out of range." };
    }
    if (scope !== "horses" && scope !== "stables") {
        return { success: false, error: "Standings come in horses or stables." };
    }
    const filter: StandingsFilter = {
        showYear,
        qualifyingOnly: params.qualifyingOnly ?? true,
    };

    try {
        // Authed-only v1 — see file header. AuthError is caught below.
        const { supabase } = await requireAuth();
        // 1. Result-final shows of the year (completed/archived only —
        //    results_review is provisional, house precedent). The DB
        //    filter narrows the fetch; countedShowIds stays the single
        //    source of counting truth (status + year + qualifying).
        const { data: rawShows, error: showsError } = await supabase
            .from("shows")
            .select("id, title, status, show_year, is_mhh_qualifying")
            .in("status", ["completed", "archived"])
            .eq("show_year", showYear);
        if (showsError) return { success: false, error: showsError.message };
        const shows = (rawShows ?? []) as unknown as (StandingsShowRow & {
            title: string | null;
        })[];

        const counted = countedShowIds(shows, filter);
        const countedShows: CountedShowRef[] = shows
            .filter((s) => counted.has(s.id))
            .map((s) => ({ id: s.id, title: s.title ?? "Untitled show" }))
            .sort((a, b) => a.title.localeCompare(b.title));

        const empty = () =>
            ({
                success: true,
                scope,
                rows: [],
                countedShows,
            }) as GetStandingsResult;
        if (counted.size === 0) return empty();

        // 2. Live entries across all counted shows, oldest → newest
        //    (the points model reads "latest entry" as current owner).
        //    Paged past PostgREST's 1000-row cap — a busy season must
        //    not silently drop entries and publish wrong standings.
        const entries: StandingsEntryRow[] = [];
        for (let from = 0; from < ENTRY_CAP; from += PAGE) {
            const { data: rawEntries, error: entriesError } = await supabase
                .from("show_class_entries")
                .select("id, show_id, class_id, horse_id, owner_id")
                .in("show_id", [...counted])
                .neq("status", "scratched")
                .order("created_at", { ascending: true })
                .range(from, from + PAGE - 1);
            if (entriesError) return { success: false, error: entriesError.message };
            const batch = (rawEntries ?? []) as unknown as StandingsEntryRow[];
            entries.push(...batch);
            if (batch.length < PAGE) break;
        }
        if (entries.length === 0) return empty();

        // 3 + 4. Placings for those entries, and decided championship
        //    callbacks for those shows — chunked .in() lists (an id
        //    list of thousands breaks the request URL) fetched in
        //    parallel.
        const entryIds = entries.map((e) => e.id);
        const [placingChunks, callbacksRes] = await Promise.all([
            Promise.all(
                chunks(entryIds, IN_CHUNK).map((ids) =>
                    supabase.from("show_placings").select("entry_id, place").in("entry_id", ids),
                ),
            ),
            supabase
                .from("show_callbacks")
                .select("scope, champion_entry_id")
                .in("show_id", [...counted])
                .not("champion_entry_id", "is", null),
        ]);
        for (const res of placingChunks) {
            if (res.error) return { success: false, error: res.error.message };
        }
        if (callbacksRes.error) return { success: false, error: callbacksRes.error.message };
        const placings = placingChunks.flatMap(
            (res) => (res.data ?? []) as unknown as StandingsPlacingRow[],
        );
        const callbacks = (callbacksRes.data ?? []) as unknown as StandingsCallbackRow[];

        // 5. Display names — RLS may hide private horses; the points
        //    model degrades those to honest fallbacks. Chunked like
        //    the placings read.
        const horseIds = [...new Set(entries.map((e) => e.horse_id))];
        const ownerIds = [...new Set(entries.map((e) => e.owner_id))];
        const [horseChunks, ownerChunks] = await Promise.all([
            Promise.all(
                chunks(horseIds, IN_CHUNK).map((ids) =>
                    supabase.from("user_horses").select("id, custom_name").in("id", ids),
                ),
            ),
            Promise.all(
                chunks(ownerIds, IN_CHUNK).map((ids) =>
                    supabase.from("users").select("id, alias_name").in("id", ids),
                ),
            ),
        ]);
        const horseNamesById = new Map<string, string>();
        for (const res of horseChunks) {
            for (const row of res.data ?? []) {
                if (row.custom_name) horseNamesById.set(row.id as string, row.custom_name as string);
            }
        }
        const ownerAliasById = new Map<string, string>();
        for (const res of ownerChunks) {
            for (const row of res.data ?? []) {
                if (row.alias_name) ownerAliasById.set(row.id as string, row.alias_name as string);
            }
        }

        const input = {
            shows,
            entries,
            placings,
            callbacks,
            horseNamesById,
            ownerAliasById,
            filter,
        };
        if (scope === "horses") {
            return {
                success: true,
                scope,
                rows: buildHorseStandings(input),
                countedShows,
            };
        }
        return {
            success: true,
            scope,
            rows: buildStableStandings(input),
            countedShows,
        };
    } catch (err) {
        if (err instanceof AuthError) {
            return { success: false, error: "Sign in to see season standings." };
        }
        return {
            success: false,
            error: "Standings could not be tallied — please try again.",
        };
    }
}
