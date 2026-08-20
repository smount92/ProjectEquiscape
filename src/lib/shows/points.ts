/**
 * Shows domain — SEASON POINTS + STANDINGS (v2 — the Championship
 * Series scale). Pure, no I/O.
 *
 * ══════════════════════════════════════════════════════════════
 * THE SCALE (v2 — ratified 2026-08, change it HERE and nowhere else)
 *
 *   "First place is worth the class" —
 *     1st = number of live entries in the class, capped at 10;
 *     each place below is one point less, floor 1.
 *       class of 3:  1st 3 · 2nd 2 · 3rd 1
 *       class of 8:  1st 8 · 2nd 7 · … · 6th 3
 *       class of 25: 1st 10 · 2nd 9 · … · 6th 5
 *   Classes with fewer than 2 DISTINCT EXHIBITORS score 0 — you
 *   cannot earn points beating only yourself.
 *   Championships   section +3 · division +5 · show (grand) +10
 *
 *   THE CAP: only a PAIR's (horse × owner-on-entry) best
 *   BEST_RESULTS_CAP placement results count per season.
 *   Championship bonuses always count. Without the cap, free
 *   online entry makes season awards measure attendance, not
 *   quality (the CFA best-100-rings / Pokémon Best-Finish-Limit
 *   mechanism). Recalibrated annually per the program rules.
 * ══════════════════════════════════════════════════════════════
 *
 * The scoring unit is the PAIR (Championship program §0): points
 * belong to (horse, owner recorded on the entry). Horse standings
 * aggregate a horse's pairs; stable standings aggregate an owner's
 * pairs. A mid-season transfer starts a fresh pair — the buyer
 * inherits nothing, the seller keeps what they campaigned.
 *
 * Which shows count:
 *   - status completed | archived ONLY (results_review is
 *     provisional — house precedent);
 *   - shows.show_year === the requested year (May 1 → Apr 30);
 *   - filter.qualifyingOnly → shows.is_mhh_qualifying only.
 *
 * Ranking: standard competition ranking ("1224"); ties share a
 * rank, ordered alphabetically then by id (fully deterministic).
 *
 * The server action (src/app/actions/standings.ts) feeds this
 * module raw scoped rows; everything here is pure shaping.
 */

import type { CallbackScope, ShowStatus } from "./types";

// ── The scale (v2) ──

/** 1st place never pays more than this, however deep the class. */
export const POINTS_CAP = 10;

/** A class needs this many DISTINCT exhibitors to pay any points. */
export const MIN_EXHIBITORS_FOR_POINTS = 2;

/**
 * One owner's entries grow a class's PAYABLE size by at most this
 * many (owner decision 2026-08-19, audit SEV-2): 9 of your own
 * horses + 1 rival used to pay as a 10-entry class — the payable
 * size now counts sum(min(ownerEntries, 3)), so the self-pump
 * collapses to a 4 while real classes are untouched. Cards stamp
 * the FACTUAL field size; only points use the capped size.
 */
export const MAX_ENTRIES_PER_OWNER_FOR_SIZE = 3;

/** Only a pair's best N placement results count per season. */
export const BEST_RESULTS_CAP = 30;

/** Championship bonuses per callback scope (unchanged from v1). */
export const CHAMPIONSHIP_POINTS: Record<CallbackScope, number> = {
    section: 3,
    division: 5,
    show: 10,
};

/** Shows whose results are final enough to score (published results). */
export const STANDINGS_SHOW_STATUSES: ShowStatus[] = ["completed", "archived"];

/**
 * v2 placement points: 1st = min(classSize, cap), one less per
 * place, floor 1 — but a class with < 2 distinct exhibitors pays 0,
 * and participation (place null) pays 0.
 */
export function placementPoints(
    place: number | null,
    classSize: number,
    distinctExhibitors: number,
): number {
    if (place === null || place < 1) return 0;
    if (distinctExhibitors < MIN_EXHIBITORS_FOR_POINTS) return 0;
    if (classSize < 1) return 0;
    const first = Math.min(classSize, POINTS_CAP);
    return Math.max(first - (place - 1), 1);
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
    /** v2: class context (size + exhibitor spread) derives from this. */
    class_id: string;
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

// ── Output row contracts (unchanged from v1) ──

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

// ── Class context (shared by season + career tallies) ──

/**
 * Per-class payable size + distinct owners from live entries.
 * Payable size = sum over owners of min(theirEntries, cap) — one
 * owner cannot pump a class's point value with their own herd.
 */
function deriveClassContext(
    entries: StandingsEntryRow[],
    counted: Set<string>,
): { classSize: Map<string, number>; classOwners: Map<string, Set<string>> } {
    const perOwner = new Map<string, Map<string, number>>();
    const classOwners = new Map<string, Set<string>>();
    for (const entry of entries) {
        if (!counted.has(entry.show_id)) continue;
        const byOwner = perOwner.get(entry.class_id) ?? new Map<string, number>();
        byOwner.set(entry.owner_id, (byOwner.get(entry.owner_id) ?? 0) + 1);
        perOwner.set(entry.class_id, byOwner);
        const owners = classOwners.get(entry.class_id) ?? new Set<string>();
        owners.add(entry.owner_id);
        classOwners.set(entry.class_id, owners);
    }
    const classSize = new Map<string, number>();
    for (const [classId, byOwner] of perOwner) {
        let size = 0;
        for (const count of byOwner.values()) {
            size += Math.min(count, MAX_ENTRIES_PER_OWNER_FOR_SIZE);
        }
        classSize.set(classId, size);
    }
    return { classSize, classOwners };
}

// ── The pair tally (v2 core) ──

interface PairTally {
    horseId: string;
    ownerId: string;
    /** Placement point values, uncapped — capped at read-out. */
    placementResults: number[];
    placings: number;
    championshipBonus: number;
    championships: number;
    showIds: Set<string>;
}

/** Sum of a pair's points under the best-N cap (+ bonuses, uncapped). */
function pairPoints(pair: PairTally): number {
    const best = [...pair.placementResults]
        .sort((a, b) => b - a)
        .slice(0, BEST_RESULTS_CAP);
    return best.reduce((sum, p) => sum + p, 0) + pair.championshipBonus;
}

/**
 * One pass building pair tallies. Class size / exhibitor spread are
 * derived from the counted live entries themselves — no extra input.
 */
function tallyPairs(input: StandingsInput): Map<string, PairTally> {
    const counted = countedShowIds(input.shows, input.filter);

    // Class context from the entry list (live entries only, by contract).
    // Payable size caps each owner's contribution — see
    // MAX_ENTRIES_PER_OWNER_FOR_SIZE.
    const { classSize, classOwners } = deriveClassContext(input.entries, counted);

    const pairs = new Map<string, PairTally>();
    const countedEntriesById = new Map<string, StandingsEntryRow>();
    const keyOf = (e: StandingsEntryRow) => `${e.horse_id}|${e.owner_id}`;

    for (const entry of input.entries) {
        if (!counted.has(entry.show_id)) continue;
        countedEntriesById.set(entry.id, entry);
        const key = keyOf(entry);
        const pair = pairs.get(key) ?? {
            horseId: entry.horse_id,
            ownerId: entry.owner_id,
            placementResults: [],
            placings: 0,
            championshipBonus: 0,
            championships: 0,
            showIds: new Set<string>(),
        };
        pair.showIds.add(entry.show_id);
        pairs.set(key, pair);
    }

    for (const placing of input.placings) {
        if (placing.place === null) continue; // participation: 0 points
        const entry = countedEntriesById.get(placing.entry_id);
        if (!entry) continue; // placing from an uncounted show
        const pair = pairs.get(keyOf(entry))!;
        const points = placementPoints(
            placing.place,
            classSize.get(entry.class_id) ?? 0,
            classOwners.get(entry.class_id)?.size ?? 0,
        );
        pair.placings += 1;
        if (points > 0) pair.placementResults.push(points);
    }

    for (const callback of input.callbacks) {
        if (!callback.champion_entry_id) continue; // undecided round
        const entry = countedEntriesById.get(callback.champion_entry_id);
        if (!entry) continue;
        const pair = pairs.get(keyOf(entry))!;
        pair.championshipBonus += championshipPoints(callback.scope);
        pair.championships += 1;
    }

    return pairs;
}

// ── Career totals (titles engine) ──

export interface CareerTotals {
    horsePoints: Map<string, number>;
    ownerPoints: Map<string, number>;
}

/**
 * RAW career accumulation for the titles engine (ROM/Superior marks,
 * exhibitor stars): every result-final MHH-qualifying show, ANY
 * season, NO best-30 cap — career marks reward longevity (the AQHA
 * mechanism); the cap is a season-fairness device and stays in the
 * standings path only. Same scale, same class-context derivation.
 */
export function buildCareerTotals(input: {
    shows: StandingsShowRow[];
    entries: StandingsEntryRow[];
    placings: StandingsPlacingRow[];
    callbacks: StandingsCallbackRow[];
}): CareerTotals {
    const counted = new Set<string>();
    for (const show of input.shows) {
        if (!STANDINGS_SHOW_STATUSES.includes(show.status as ShowStatus)) continue;
        if (!show.is_mhh_qualifying) continue;
        counted.add(show.id);
    }

    const { classSize, classOwners } = deriveClassContext(input.entries, counted);
    const entriesById = new Map<string, StandingsEntryRow>();
    for (const entry of input.entries) {
        if (!counted.has(entry.show_id)) continue;
        entriesById.set(entry.id, entry);
    }

    const horsePoints = new Map<string, number>();
    const ownerPoints = new Map<string, number>();
    const add = (entry: StandingsEntryRow, points: number) => {
        if (points <= 0) return;
        horsePoints.set(entry.horse_id, (horsePoints.get(entry.horse_id) ?? 0) + points);
        ownerPoints.set(entry.owner_id, (ownerPoints.get(entry.owner_id) ?? 0) + points);
    };

    for (const placing of input.placings) {
        const entry = entriesById.get(placing.entry_id);
        if (!entry) continue;
        add(
            entry,
            placementPoints(
                placing.place,
                classSize.get(entry.class_id) ?? 0,
                classOwners.get(entry.class_id)?.size ?? 0,
            ),
        );
    }
    for (const callback of input.callbacks) {
        if (!callback.champion_entry_id) continue;
        const entry = entriesById.get(callback.champion_entry_id);
        if (!entry) continue;
        add(entry, championshipPoints(callback.scope));
    }

    return { horsePoints, ownerPoints };
}

// ── Ranking helpers (unchanged from v1) ──

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

/** Horse standings for one show year (aggregating the horse's pairs). */
export function buildHorseStandings(input: StandingsInput): HorseStandingRow[] {
    const pairs = tallyPairs(input);
    const counted = countedShowIds(input.shows, input.filter);

    // Display owner = owner of the horse's most recent counted entry.
    const ownerByHorse = new Map<string, string>();
    for (const entry of input.entries) {
        if (!counted.has(entry.show_id)) continue;
        ownerByHorse.set(entry.horse_id, entry.owner_id);
    }

    const byHorse = new Map<
        string,
        { points: number; placings: number; championships: number; showIds: Set<string> }
    >();
    for (const pair of pairs.values()) {
        const agg = byHorse.get(pair.horseId) ?? {
            points: 0,
            placings: 0,
            championships: 0,
            showIds: new Set<string>(),
        };
        agg.points += pairPoints(pair);
        agg.placings += pair.placings;
        agg.championships += pair.championships;
        for (const id of pair.showIds) agg.showIds.add(id);
        byHorse.set(pair.horseId, agg);
    }

    const unranked = [...byHorse.entries()].map(([horseId, agg]) => ({
        id: horseId,
        name: input.horseNamesById.get(horseId) ?? FALLBACK_HORSE_NAME,
        ownerId: ownerByHorse.get(horseId)!,
        points: agg.points,
        placings: agg.placings,
        championships: agg.championships,
        showsEntered: agg.showIds.size,
    }));
    unranked.sort(byPointsThenName);

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

/** Stable (owner) standings for one show year (aggregating the owner's pairs). */
export function buildStableStandings(input: StandingsInput): StableStandingRow[] {
    const pairs = tallyPairs(input);

    const byOwner = new Map<
        string,
        { points: number; placings: number; championships: number; showIds: Set<string> }
    >();
    for (const pair of pairs.values()) {
        const agg = byOwner.get(pair.ownerId) ?? {
            points: 0,
            placings: 0,
            championships: 0,
            showIds: new Set<string>(),
        };
        agg.points += pairPoints(pair);
        agg.placings += pair.placings;
        agg.championships += pair.championships;
        for (const id of pair.showIds) agg.showIds.add(id);
        byOwner.set(pair.ownerId, agg);
    }

    const unranked = [...byOwner.entries()].map(([ownerId, agg]) => ({
        id: ownerId,
        name: input.ownerAliasById.get(ownerId) ?? FALLBACK_OWNER_ALIAS,
        points: agg.points,
        placings: agg.placings,
        championships: agg.championships,
        showsEntered: agg.showIds.size,
    }));
    unranked.sort(byPointsThenName);

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
