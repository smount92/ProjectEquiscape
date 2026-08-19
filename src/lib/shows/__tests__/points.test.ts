import { describe, it, expect } from "vitest";
import {
    BEST_RESULTS_CAP,
    CHAMPIONSHIP_POINTS,
    FALLBACK_HORSE_NAME,
    FALLBACK_OWNER_ALIAS,
    MIN_EXHIBITORS_FOR_POINTS,
    POINTS_CAP,
    buildHorseStandings,
    buildStableStandings,
    championshipPoints,
    countedShowIds,
    placementPoints,
    type StandingsCallbackRow,
    type StandingsEntryRow,
    type StandingsInput,
    type StandingsPlacingRow,
    type StandingsShowRow,
} from "@/lib/shows/points";

// ── fixture helpers ──

function show(overrides: Partial<StandingsShowRow> & { id: string }): StandingsShowRow {
    return {
        status: "completed",
        show_year: 2026,
        is_mhh_qualifying: true,
        ...overrides,
    };
}

function entry(
    id: string,
    showId: string,
    horseId: string,
    ownerId: string,
    classId = "class-1",
): StandingsEntryRow {
    return { id, show_id: showId, class_id: classId, horse_id: horseId, owner_id: ownerId };
}

function input(overrides: Partial<StandingsInput>): StandingsInput {
    return {
        shows: [],
        entries: [],
        placings: [],
        callbacks: [],
        horseNamesById: new Map(),
        ownerAliasById: new Map(),
        filter: { showYear: 2026, qualifyingOnly: true },
        ...overrides,
    };
}

/** N entries in one class from distinct owners (owner-1 … owner-N). */
function classOf(
    n: number,
    showId = "show-1",
    classId = "class-1",
): StandingsEntryRow[] {
    return Array.from({ length: n }, (_, i) =>
        entry(`e${i + 1}`, showId, `horse-${i + 1}`, `owner-${i + 1}`, classId),
    );
}

describe("points — the v2 scale ('first place is worth the class')", () => {
    it("1st = class size, one less per place, floor 1", () => {
        // class of 3: 3·2·1
        expect(placementPoints(1, 3, 3)).toBe(3);
        expect(placementPoints(2, 3, 3)).toBe(2);
        expect(placementPoints(3, 3, 3)).toBe(1);
        // class of 8: 8·7·6·5·4·3
        expect(placementPoints(1, 8, 5)).toBe(8);
        expect(placementPoints(6, 8, 5)).toBe(3);
        // class of 2: 2·1
        expect(placementPoints(2, 2, 2)).toBe(1);
    });

    it(`1st is capped at ${POINTS_CAP} however deep the class`, () => {
        expect(placementPoints(1, 25, 9)).toBe(POINTS_CAP);
        expect(placementPoints(2, 25, 9)).toBe(POINTS_CAP - 1);
        expect(placementPoints(6, 25, 9)).toBe(POINTS_CAP - 5);
    });

    it(`a class with fewer than ${MIN_EXHIBITORS_FOR_POINTS} distinct exhibitors pays 0`, () => {
        expect(placementPoints(1, 6, 1)).toBe(0); // six entries, one owner
        expect(placementPoints(1, 1, 1)).toBe(0);
    });

    it("participation (null) and invalid places score 0", () => {
        expect(placementPoints(null, 8, 4)).toBe(0);
        expect(placementPoints(0, 8, 4)).toBe(0);
        expect(placementPoints(-1, 8, 4)).toBe(0);
    });

    it("championship bonuses: section +3, division +5, show +10", () => {
        expect(championshipPoints("section")).toBe(CHAMPIONSHIP_POINTS.section);
        expect(championshipPoints("division")).toBe(CHAMPIONSHIP_POINTS.division);
        expect(championshipPoints("show")).toBe(CHAMPIONSHIP_POINTS.show);
        expect(championshipPoints("galaxy")).toBe(0);
    });
});

describe("countedShowIds — which shows score", () => {
    it("filters by status, year, and qualifying flag", () => {
        const shows = [
            show({ id: "counts" }),
            show({ id: "provisional", status: "results_review" }),
            show({ id: "wrong-year", show_year: 2025 }),
            show({ id: "unsanctioned", is_mhh_qualifying: false }),
        ];
        const counted = countedShowIds(shows, { showYear: 2026, qualifyingOnly: true });
        expect([...counted]).toEqual(["counts"]);
        const widened = countedShowIds(shows, { showYear: 2026, qualifyingOnly: false });
        expect(widened.has("unsanctioned")).toBe(true);
    });
});

describe("buildHorseStandings — v2", () => {
    it("scores class-size points: 1st in a class of 4 earns 4", () => {
        const entries = classOf(4);
        const rows = buildHorseStandings(
            input({
                shows: [show({ id: "show-1" })],
                entries,
                placings: [
                    { entry_id: "e1", place: 1 },
                    { entry_id: "e2", place: 2 },
                ],
            }),
        );
        expect(rows[0]).toMatchObject({ horseId: "horse-1", points: 4, rank: 1 });
        expect(rows[1]).toMatchObject({ horseId: "horse-2", points: 3, rank: 2 });
        // Entered-but-unplaced horses still stand at 0.
        expect(rows.find((r) => r.horseId === "horse-3")?.points).toBe(0);
    });

    it("a self-only class pays 0 points but still counts the placing", () => {
        // Two entries, both owner-1 — no competition.
        const entries = [
            entry("e1", "show-1", "horse-1", "owner-1"),
            entry("e2", "show-1", "horse-2", "owner-1"),
        ];
        const rows = buildHorseStandings(
            input({
                shows: [show({ id: "show-1" })],
                entries,
                placings: [{ entry_id: "e1", place: 1 }],
            }),
        );
        const h1 = rows.find((r) => r.horseId === "horse-1")!;
        expect(h1.points).toBe(0);
        expect(h1.placings).toBe(1);
    });

    it("adds championship bonuses from decided callbacks (never capped away)", () => {
        const entries = classOf(3);
        const callbacks: StandingsCallbackRow[] = [
            { scope: "show", champion_entry_id: "e1" },
            { scope: "section", champion_entry_id: null }, // undecided
        ];
        const rows = buildHorseStandings(
            input({
                shows: [show({ id: "show-1" })],
                entries,
                placings: [{ entry_id: "e1", place: 1 }],
                callbacks,
            }),
        );
        expect(rows[0]).toMatchObject({ horseId: "horse-1", points: 3 + 10, championships: 1 });
    });

    it(`the best-${BEST_RESULTS_CAP} cap: result #${BEST_RESULTS_CAP + 1} adds nothing`, () => {
        // One pair placing 1st in (CAP + 1) two-horse classes across one show.
        const entries: StandingsEntryRow[] = [];
        const placings: StandingsPlacingRow[] = [];
        for (let i = 0; i < BEST_RESULTS_CAP + 1; i++) {
            const classId = `class-${i}`;
            entries.push(entry(`mine-${i}`, "show-1", "horse-1", "owner-1", classId));
            entries.push(entry(`theirs-${i}`, "show-1", `rival-${i}`, "owner-2", classId));
            placings.push({ entry_id: `mine-${i}`, place: 1 }); // 2 points each
        }
        const rows = buildHorseStandings(
            input({ shows: [show({ id: "show-1" })], entries, placings }),
        );
        const h1 = rows.find((r) => r.horseId === "horse-1")!;
        expect(h1.points).toBe(BEST_RESULTS_CAP * 2); // the 31st win is worth 0
        expect(h1.placings).toBe(BEST_RESULTS_CAP + 1); // …but still counts as a placing
    });

    it("ignores placings and callbacks from uncounted shows", () => {
        const rows = buildHorseStandings(
            input({
                shows: [show({ id: "old", show_year: 2025 })],
                entries: classOf(3, "old"),
                placings: [{ entry_id: "e1", place: 1 }],
                callbacks: [{ scope: "show", champion_entry_id: "e1" }],
            }),
        );
        expect(rows).toHaveLength(0);
    });

    it("falls back to honest placeholders for hidden names", () => {
        const rows = buildHorseStandings(
            input({
                shows: [show({ id: "show-1" })],
                entries: classOf(2),
                placings: [{ entry_id: "e1", place: 1 }],
            }),
        );
        expect(rows[0].horseName).toBe(FALLBACK_HORSE_NAME);
        expect(rows[0].ownerAlias).toBe(FALLBACK_OWNER_ALIAS);
    });
});

describe("buildStableStandings — v2 pair semantics", () => {
    it("rolls pair points up to the owner", () => {
        const entries = classOf(4);
        const rows = buildStableStandings(
            input({
                shows: [show({ id: "show-1" })],
                entries,
                placings: [
                    { entry_id: "e1", place: 1 },
                    { entry_id: "e2", place: 2 },
                ],
            }),
        );
        expect(rows[0]).toMatchObject({ ownerId: "owner-1", points: 4, rank: 1 });
        expect(rows[1]).toMatchObject({ ownerId: "owner-2", points: 3, rank: 2 });
    });

    it("mid-year transfer: each stable keeps the points it campaigned", () => {
        // Same horse, two shows, two owners — two PAIRS.
        const entries = [
            entry("a1", "show-1", "horse-1", "seller", "c1"),
            entry("a2", "show-1", "horse-2", "other", "c1"),
            entry("b1", "show-2", "horse-1", "buyer", "c2"),
            entry("b2", "show-2", "horse-3", "other", "c2"),
        ];
        const rows = buildStableStandings(
            input({
                shows: [show({ id: "show-1" }), show({ id: "show-2" })],
                entries,
                placings: [
                    { entry_id: "a1", place: 1 }, // 2 pts to seller's pair
                    { entry_id: "b1", place: 1 }, // 2 pts to buyer's pair
                ],
            }),
        );
        expect(rows.find((r) => r.ownerId === "seller")?.points).toBe(2);
        expect(rows.find((r) => r.ownerId === "buyer")?.points).toBe(2);
        // The horse's own standing aggregates both pairs.
        const horseRows = buildHorseStandings(
            input({
                shows: [show({ id: "show-1" }), show({ id: "show-2" })],
                entries,
                placings: [
                    { entry_id: "a1", place: 1 },
                    { entry_id: "b1", place: 1 },
                ],
            }),
        );
        expect(horseRows.find((r) => r.horseId === "horse-1")?.points).toBe(4);
    });

    it("tied stables share the rank and order alphabetically", () => {
        const entries = classOf(3);
        const rows = buildStableStandings(
            input({
                shows: [show({ id: "show-1" })],
                entries,
                placings: [], // everyone at 0
                ownerAliasById: new Map([
                    ["owner-1", "Zinnia"],
                    ["owner-2", "Apple"],
                    ["owner-3", "Maple"],
                ]),
            }),
        );
        expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
        expect(rows.map((r) => r.ownerAlias)).toEqual(["Apple", "Maple", "Zinnia"]);
    });
});
