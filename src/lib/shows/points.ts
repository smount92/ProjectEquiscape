/**
 * Shows domain — SEASON POINTS + STANDINGS (Wave 3, v1). Pure, no I/O.
 *
 * ══════════════════════════════════════════════════════════════
 * THE SCALE (v1 — change it HERE and nowhere else)
 *
 *   Placements        1st 7 · 2nd 5 · 3rd 4 · 4th 3 · 5th 2 · 6th 1
 *                     (participation — place NULL — scores 0)
 *   Championships     section champion +3 · division champion +5 ·
 *                     show (grand) champion +10
 *                     (reserves score 0 in v1)
 *
 * The numbers are deliberately a plain lookup table
 * (PLACEMENT_POINTS / CHAMPIONSHIP_POINTS) so the owner can retune
 * the scale without touching any aggregation logic. Nothing is
 * persisted: standings are COMPUTED on read from show_placings +
 * show_callbacks, so a scale change re-scores history for free.
 * ══════════════════════════════════════════════════════════════
 *
 * Points accrue to the HORSE; stable standings roll the same
 * points up to the owner. Attribution rules (v1):
 *   - Placement/championship points go to the horse on the entry,
 *     and to the OWNER RECORDED ON THAT ENTRY (the person who
 *     campaigned the horse at that show — a mid-year transfer
 *     doesn't move last season's points to the new owner's stable).
 *   - A horse's display owner is the owner of its most recent
 *     counted entry (entries arrive oldest → newest).
 *
 * Which shows count:
 *   - status completed | archived ONLY (results_review is
 *     provisional — house precedent, mirrors RESULT_LIFE_STATUSES
 *     in showLife.ts / RESULTS_STATUSES in gallery.ts);
 *   - shows.show_year === the requested year (May 1 → Apr 30,
 *     trigger-derived — see showYear.ts);
 *   - filter.qualifyingOnly → shows.is_mhh_qualifying only.
 *
 * Ranking: standard competition ranking ("1224") — tied points
 * share a rank, the next distinct total takes 1 + rows above it.
 * Within a tie, rows order alphabetically (then by id, so the
 * order is fully deterministic).
 *
 * The server action (src/app/actions/standings.ts) feeds this
 * module raw scoped rows; everything here is pure shaping so a
 * materialized view can replace the computation later without the
 * row shape changing.
 */

import type { CallbackScope, Place, ShowStatus } from "./types";

// ── The scale ──

/** Placement points, 1st → 6th. v1 scale — the one place to retune. */
export const PLACEMENT_POINTS: Record<Place, number> = {
    1: 7,
    2: 5,
    3: 4,
    4: 3,
    5: 2,
    6: 1,
};

/** Championship bonuses per callback scope. v1 scale. */
export const CHAMPIONSHIP_POINTS: Record<CallbackScope, number> = {
    section: 3,
    division: 5,
    show: 10,
};

/** Shows whose results are final enough to score (published results). */
export const STANDINGS_SHOW_STATUSES: ShowStatus[] = ["completed", "archived"];

/** Points for a recorded place; participation (null) and out-of-range score 0. */
export function placementPoints(place: number | null): number {
    if (place === null) return 0;
    return PLACEMENT_POINTS[place as Place] ?? 0;
}

/** Bonus for a championship at the given callback scope; unknown scopes score 0. */
export function championshipPoints(scope: string): number {
    return CHAMPIONSHIP_POINTS[scope as CallbackScope] ?? 0;
}

// ── Raw row shapes the action feeds in ──

export interface StandingsShowRow {
    id: string;
    status: string;
    show_year: number | null;
    is_mhh_qualifying: boolean;
}

/** Live (non-scratched) entries only; ordered oldest → newest. */
export interface StandingsEntryRow {
    id: string;
    show_id: string;
    horse_id: string;
    owner_id: string;
}

export interface StandingsPlacingRow {
    entry_id: string;
    place: number | null;
}

export interface StandingsCallbackRow {
    scope: string;
    champion_entry_id: string | null;
}

// ── Output row contracts ──

export interface HorseStandingRow {
    rank: number;
    horseId: string;
    horseName: string;
    ownerId: string;
    ownerAlias: string;
    points: number;
    /** Placed results (1st–6th); participation doesn't count. */
    placings: number;
    /** Championship titles won (callback champion, any scope). */
    championships: number;
    /** Distinct counted shows this horse was entered in. */
    showsEntered: number;
}

export interface StableStandingRow {
    rank: number;
    ownerId: string;
    ownerAlias: string;
    points: number;
    placings: number;
    championships: number;
    showsEntered: number;
}

export interface StandingsFilter {
    /** Show year (May 1 → Apr 30), as stored in shows.show_year. */
    showYear: number;
    /** true → only is_mhh_qualifying shows count. */
    qualifyingOnly: boolean;
}

export interface StandingsInput {
    shows: StandingsShowRow[];
    entries: StandingsEntryRow[];
    placings: StandingsPlacingRow[];
    callbacks: StandingsCallbackRow[];
    horseNamesById: Map<string, string>;
    ownerAliasById: Map<string, string>;
    filter: StandingsFilter;
}

/** Display fallbacks — RLS may hide a private horse's row; a user row
 *  may be gone. Honest placeholders, never a crash (house pattern). */
export const FALLBACK_HORSE_NAME = "Unnamed horse";
export const FALLBACK_OWNER_ALIAS = "member";

// ── Which shows count ──

export function countedShowIds(shows: StandingsShowRow[], filter: StandingsFilter): Set<string> {
    const counted = new Set<string>();
    for (const show of shows) {
        if (!STANDINGS_SHOW_STATUSES.includes(show.status as ShowStatus)) continue;
        if (show.show_year !== filter.showYear) continue;
        if (filter.qualifyingOnly && !show.is_mhh_qualifying) continue;
        counted.add(show.id);
    }
    return counted;
}

// ── Internal tally (shared by both scopes) ──

interface Tally {
    points: number;
    placings: number;
    championships: number;
    showIds: Set<string>;
}

function emptyTally(): Tally {
    return { points: 0, placings: 0, championships: 0, showIds: new Set() };
}

/**
 * One pass over entries/placings/callbacks, keyed by keyOf(entry)
 * (horse_id for horse standings, owner_id for stables). Every horse
 * that ENTERED a counted show gets a row — a 0-point campaigner is
 * still standing, just at the bottom of the ledger.
 */
function tallyByKey(
    input: StandingsInput,
    keyOf: (entry: StandingsEntryRow) => string,
): Map<string, Tally> {
    const counted = countedShowIds(input.shows, input.filter);
    const tallies = new Map<string, Tally>();
    const countedEntriesById = new Map<string, StandingsEntryRow>();

    for (const entry of input.entries) {
        if (!counted.has(entry.show_id)) continue;
        countedEntriesById.set(entry.id, entry);
        const key = keyOf(entry);
        const tally = tallies.get(key) ?? emptyTally();
        tally.showIds.add(entry.show_id);
        tallies.set(key, tally);
    }

    for (const placing of input.placings) {
        if (placing.place === null) continue; // participation: 0 points
        const entry = countedEntriesById.get(placing.entry_id);
        if (!entry) continue; // placing from an uncounted show
        const tally = tallies.get(keyOf(entry))!;
        tally.points += placementPoints(placing.place);
        tally.placings += 1;
    }

    for (const callback of input.callbacks) {
        if (!callback.champion_entry_id) continue; // undecided round
        const entry = countedEntriesById.get(callback.champion_entry_id);
        if (!entry) continue;
        const tally = tallies.get(keyOf(entry))!;
        tally.points += championshipPoints(callback.scope);
        tally.championships += 1;
    }

    return tallies;
}

/**
 * Standard competition ranking ("1224") over rows already sorted by
 * points desc, then name asc, then id asc. Ties share the rank of
 * the first tied row.
 */
function assignRanks<T extends { points: number }>(sorted: T[]): (T & { rank: number })[] {
    let rank = 0;
    let lastPoints: number | null = null;
    return sorted.map((row, index) => {
        if (row.points !== lastPoints) {
            rank = index + 1;
            lastPoints = row.points;
        }
        return { ...row, rank };
    });
}

function byPointsThenName<T extends { points: number; id: string; name: string }>(a: T, b: T): number {
    if (b.points !== a.points) return b.points - a.points;
    const names = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    if (names !== 0) return names;
    return a.id.localeCompare(b.id);
}

// ── Builders ──

/** Horse standings for one show year. Rank 1 = most points. */
export function buildHorseStandings(input: StandingsInput): HorseStandingRow[] {
    const tallies = tallyByKey(input, (entry) => entry.horse_id);

    // Display owner = owner of the horse's most recent counted entry
    // (entries arrive oldest → newest, so last write wins).
    const counted = countedShowIds(input.shows, input.filter);
    const ownerByHorse = new Map<string, string>();
    for (const entry of input.entries) {
        if (!counted.has(entry.show_id)) continue;
        ownerByHorse.set(entry.horse_id, entry.owner_id);
    }

    const unranked = [...tallies.entries()].map(([horseId, tally]) => {
        const ownerId = ownerByHorse.get(horseId)!;
        return {
            id: horseId,
            name: input.horseNamesById.get(horseId) ?? FALLBACK_HORSE_NAME,
            ownerId,
            points: tally.points,
            placings: tally.placings,
            championships: tally.championships,
            showsEntered: tally.showIds.size,
        };
    });
    unranked.sort(byPointsThenName);

    // Explicit pick — the row-shape contract holds no stray keys.
    return assignRanks(unranked).map((row) => ({
        rank: row.rank,
        horseId: row.id,
        horseName: row.name,
        ownerId: row.ownerId,
        ownerAlias: input.ownerAliasById.get(row.ownerId) ?? FALLBACK_OWNER_ALIAS,
        points: row.points,
        placings: row.placings,
        championships: row.championships,
        showsEntered: row.showsEntered,
    }));
}

/** Stable (owner) standings for one show year. Rank 1 = most points. */
export function buildStableStandings(input: StandingsInput): StableStandingRow[] {
    const tallies = tallyByKey(input, (entry) => entry.owner_id);

    const unranked = [...tallies.entries()].map(([ownerId, tally]) => ({
        id: ownerId,
        name: input.ownerAliasById.get(ownerId) ?? FALLBACK_OWNER_ALIAS,
        points: tally.points,
        placings: tally.placings,
        championships: tally.championships,
        showsEntered: tally.showIds.size,
    }));
    unranked.sort(byPointsThenName);

    // Explicit pick — the row-shape contract holds no stray keys.
    return assignRanks(unranked).map((row) => ({
        rank: row.rank,
        ownerId: row.id,
        ownerAlias: row.name,
        points: row.points,
        placings: row.placings,
        championships: row.championships,
        showsEntered: row.showsEntered,
    }));
}
