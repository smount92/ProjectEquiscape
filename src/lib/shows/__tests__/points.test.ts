import { describe, it, expect } from "vitest";
import {
    CHAMPIONSHIP_POINTS,
    FALLBACK_HORSE_NAME,
    FALLBACK_OWNER_ALIAS,
    PLACEMENT_POINTS,
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
): StandingsEntryRow {
    return { id, show_id: showId, horse_id: horseId, owner_id: ownerId };
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

describe("points — the v1 scale", () => {
    it("placements score 7·5·4·3·2·1 for 1st–6th", () => {
        expect(placementPoints(1)).toBe(7);
        expect(placementPoints(2)).toBe(5);
        expect(placementPoints(3)).toBe(4);
        expect(placementPoints(4)).toBe(3);
        expect(placementPoints(5)).toBe(2);
        expect(placementPoints(6)).toBe(1);
    });

    it("participation (null) scores 0", () => {
        expect(placementPoints(null)).toBe(0);
    });

    it("out-of-vocabulary places score 0 instead of crashing", () => {
        expect(placementPoints(0)).toBe(0);
        expect(placementPoints(7)).toBe(0);
        expect(placementPoints(-1)).toBe(0);
    });

    it("championship bonuses: section +3, division +5, show +10", () => {
        expect(championshipPoints("section")).toBe(3);
        expect(championshipPoints("division")).toBe(5);
        expect(championshipPoints("show")).toBe(10);
    });

    it("unknown callback scopes score 0", () => {
        expect(championshipPoints("galaxy")).toBe(0);
    });

    it("the lookup tables carry the whole scale (retuning point)", () => {
        expect(PLACEMENT_POINTS).toEqual({ 1: 7, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 });
        expect(CHAMPIONSHIP_POINTS).toEqual({ section: 3, division: 5, show: 10 });
    });
});

describe("countedShowIds — which shows score", () => {
    it("counts completed and archived shows of the requested year", () => {
        const shows = [
            show({ id: "a", status: "completed" }),
            show({ id: "b", status: "archived" }),
        ];
        expect(countedShowIds(shows, { showYear: 2026, qualifyingOnly: true })).toEqual(
            new Set(["a", "b"]),
        );
    });

    it("excludes provisional results_review and every earlier status", () => {
        const shows = [
            show({ id: "a", status: "results_review" }),
            show({ id: "b", status: "judging" }),
            show({ id: "c", status: "entries_open" }),
            show({ id: "d", status: "draft" }),
        ];
        expect(
            countedShowIds(shows, { showYear: 2026, qualifyingOnly: false }).size,
        ).toBe(0);
    });

    it("filters by show year (May 1 → Apr 30 identity, trigger-stored)", () => {
        const shows = [
            show({ id: "this-year", show_year: 2026 }),
            show({ id: "last-year", show_year: 2025 }),
            show({ id: "no-year", show_year: null }),
        ];
        expect(countedShowIds(shows, { showYear: 2026, qualifyingOnly: true })).toEqual(
            new Set(["this-year"]),
        );
    });

    it("qualifyingOnly excludes non-qualifying shows; all-shows keeps them", () => {
        const shows = [
            show({ id: "q", is_mhh_qualifying: true }),
            show({ id: "fun", is_mhh_qualifying: false }),
        ];
        expect(countedShowIds(shows, { showYear: 2026, qualifyingOnly: true })).toEqual(
            new Set(["q"]),
        );
        expect(countedShowIds(shows, { showYear: 2026, qualifyingOnly: false })).toEqual(
            new Set(["q", "fun"]),
        );
    });
});

describe("buildHorseStandings — aggregation", () => {
    it("sums placement points per horse across classes and shows", () => {
        const result = buildHorseStandings(
            input({
                shows: [show({ id: "s1" }), show({ id: "s2" })],
                entries: [
                    entry("e1", "s1", "h1", "o1"),
                    entry("e2", "s1", "h1", "o1"),
                    entry("e3", "s2", "h1", "o1"),
                ],
                placings: [
                    { entry_id: "e1", place: 1 }, // 7
                    { entry_id: "e2", place: 3 }, // 4
                    { entry_id: "e3", place: 6 }, // 1
                ],
            }),
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            rank: 1,
            horseId: "h1",
            points: 12,
            placings: 3,
            championships: 0,
            showsEntered: 2,
        });
    });

    it("adds championship bonuses from decided callbacks", () => {
        const callbacks: StandingsCallbackRow[] = [
            { scope: "section", champion_entry_id: "e1" }, // +3
            { scope: "division", champion_entry_id: "e1" }, // +5
            { scope: "show", champion_entry_id: "e1" }, // +10
            { scope: "section", champion_entry_id: null }, // undecided: ignored
        ];
        const result = buildHorseStandings(
            input({
                shows: [show({ id: "s1" })],
                entries: [entry("e1", "s1", "h1", "o1")],
                placings: [{ entry_id: "e1", place: 1 }],
                callbacks,
            }),
        );
        expect(result[0].points).toBe(7 + 3 + 5 + 10);
        expect(result[0].championships).toBe(3);
    });

    it("participation rows count the show as entered but score nothing", () => {
        const result = buildHorseStandings(
            input({
                shows: [show({ id: "s1" })],
                entries: [entry("e1", "s1", "h1", "o1")],
                placings: [{ entry_id: "e1", place: null }],
            }),
        );
        expect(result[0]).toMatchObject({
            points: 0,
            placings: 0,
            showsEntered: 1,
        });
    });

    it("a horse that entered but has no placing rows still stands (0 points)", () => {
        const result = buildHorseStandings(
            input({
                shows: [show({ id: "s1" })],
                entries: [entry("e1", "s1", "h1", "o1")],
            }),
        );
        expect(result).toHaveLength(1);
        expect(result[0].points).toBe(0);
        expect(result[0].showsEntered).toBe(1);
    });

    it("ignores placings and callbacks from uncounted shows (year + status + qualifying)", () => {
        const result = buildHorseStandings(
            input({
                shows: [
                    show({ id: "counted" }),
                    show({ id: "lastYear", show_year: 2025 }),
                    show({ id: "provisional", status: "results_review" }),
                    show({ id: "fun", is_mhh_qualifying: false }),
                ],
                entries: [
                    entry("e1", "counted", "h1", "o1"),
                    entry("e2", "lastYear", "h1", "o1"),
                    entry("e3", "provisional", "h1", "o1"),
                    entry("e4", "fun", "h1", "o1"),
                ],
                placings: [
                    { entry_id: "e1", place: 2 }, // 5 — counts
                    { entry_id: "e2", place: 1 }, // wrong year
                    { entry_id: "e3", place: 1 }, // provisional
                    { entry_id: "e4", place: 1 }, // non-qualifying
                ],
                callbacks: [
                    { scope: "show", champion_entry_id: "e3" }, // provisional: ignored
                ],
            }),
        );
        expect(result).toHaveLength(1);
        expect(result[0].points).toBe(5);
        expect(result[0].showsEntered).toBe(1);
        expect(result[0].championships).toBe(0);
    });

    it("qualifyingOnly=false widens the same data to all shows", () => {
        const base = {
            shows: [show({ id: "q" }), show({ id: "fun", is_mhh_qualifying: false })],
            entries: [entry("e1", "q", "h1", "o1"), entry("e2", "fun", "h1", "o1")],
            placings: [
                { entry_id: "e1", place: 1 },
                { entry_id: "e2", place: 1 },
            ] as StandingsPlacingRow[],
        };
        const qualifying = buildHorseStandings(input(base));
        const all = buildHorseStandings(
            input({ ...base, filter: { showYear: 2026, qualifyingOnly: false } }),
        );
        expect(qualifying[0].points).toBe(7);
        expect(all[0].points).toBe(14);
        expect(all[0].showsEntered).toBe(2);
    });

    it("resolves names and aliases, with honest fallbacks for hidden rows", () => {
        const result = buildHorseStandings(
            input({
                shows: [show({ id: "s1" })],
                entries: [
                    entry("e1", "s1", "h1", "o1"),
                    entry("e2", "s1", "h2", "o2"),
                ],
                placings: [
                    { entry_id: "e1", place: 1 },
                    { entry_id: "e2", place: 2 },
                ],
                horseNamesById: new Map([["h1", "Copperline"]]),
                ownerAliasById: new Map([["o1", "maggie"]]),
            }),
        );
        expect(result[0]).toMatchObject({ horseName: "Copperline", ownerAlias: "maggie" });
        expect(result[1]).toMatchObject({
            horseName: FALLBACK_HORSE_NAME,
            ownerAlias: FALLBACK_OWNER_ALIAS,
        });
    });

    it("attributes a transferred horse's display owner to its most recent counted entry", () => {
        const result = buildHorseStandings(
            input({
                shows: [show({ id: "s1" }), show({ id: "s2" })],
                entries: [
                    entry("e1", "s1", "h1", "sellerId"), // oldest
                    entry("e2", "s2", "h1", "buyerId"), // newest
                ],
                ownerAliasById: new Map([
                    ["sellerId", "seller"],
                    ["buyerId", "buyer"],
                ]),
            }),
        );
        expect(result[0].ownerId).toBe("buyerId");
        expect(result[0].ownerAlias).toBe("buyer");
    });
});

describe("ranking — shared ranks, then alphabetical", () => {
    const twoTiedOneBehind = input({
        shows: [show({ id: "s1" })],
        entries: [
            entry("e1", "s1", "hA", "o1"),
            entry("e2", "s1", "hB", "o2"),
            entry("e3", "s1", "hC", "o3"),
        ],
        placings: [
            { entry_id: "e1", place: 2 }, // 5
            { entry_id: "e2", place: 2 }, // 5 (another class)
            { entry_id: "e3", place: 3 }, // 4
        ],
        horseNamesById: new Map([
            ["hA", "zephyr"], // lowercase on purpose: sort is case-insensitive
            ["hB", "Argo"],
            ["hC", "Middling"],
        ]),
    });

    it("ties share a rank and the next distinct total skips (1-1-3)", () => {
        const result = buildHorseStandings(twoTiedOneBehind);
        expect(result.map((r) => r.rank)).toEqual([1, 1, 3]);
    });

    it("tied rows order alphabetically by name (case-insensitive)", () => {
        const result = buildHorseStandings(twoTiedOneBehind);
        expect(result.map((r) => r.horseName)).toEqual(["Argo", "zephyr", "Middling"]);
    });

    it("identical names fall back to id order for determinism", () => {
        const result = buildHorseStandings(
            input({
                shows: [show({ id: "s1" })],
                entries: [
                    entry("e1", "s1", "h-b", "o1"),
                    entry("e2", "s1", "h-a", "o1"),
                ],
                horseNamesById: new Map([
                    ["h-a", "Twin"],
                    ["h-b", "Twin"],
                ]),
            }),
        );
        expect(result.map((r) => r.horseId)).toEqual(["h-a", "h-b"]);
        expect(result.map((r) => r.rank)).toEqual([1, 1]);
    });
});

describe("buildStableStandings — owner rollup", () => {
    const twoStables = input({
        shows: [show({ id: "s1" }), show({ id: "s2" })],
        entries: [
            entry("e1", "s1", "h1", "o1"),
            entry("e2", "s1", "h2", "o1"), // second horse, same stable
            entry("e3", "s2", "h1", "o1"),
            entry("e4", "s1", "h3", "o2"),
        ],
        placings: [
            { entry_id: "e1", place: 1 }, // 7
            { entry_id: "e2", place: 4 }, // 3
            { entry_id: "e3", place: null }, // participation
            { entry_id: "e4", place: 1 }, // 7
        ],
        callbacks: [{ scope: "section", champion_entry_id: "e4" }], // o2 +3
        ownerAliasById: new Map([
            ["o1", "brookside"],
            ["o2", "alder"],
        ]),
    });

    it("rolls horse points up to the owner", () => {
        const result = buildStableStandings(twoStables);
        expect(result).toHaveLength(2);
        const byAlias = new Map(result.map((r) => [r.ownerAlias, r]));
        expect(byAlias.get("brookside")).toMatchObject({
            points: 10, // 7 + 3 across two horses
            placings: 2,
            championships: 0,
            showsEntered: 2,
        });
        expect(byAlias.get("alder")).toMatchObject({
            points: 10, // 7 + section champion bonus 3
            placings: 1,
            championships: 1,
            showsEntered: 1,
        });
    });

    it("tied stables share the rank and order alphabetically", () => {
        const result = buildStableStandings(twoStables);
        // both stables total 10 — shared rank 1, alder < brookside
        expect(result.map((r) => r.rank)).toEqual([1, 1]);
        expect(result.map((r) => r.ownerAlias)).toEqual(["alder", "brookside"]);
    });

    it("mid-year transfer: each stable keeps the points it campaigned", () => {
        const result = buildStableStandings(
            input({
                shows: [show({ id: "s1" }), show({ id: "s2" })],
                entries: [
                    entry("e1", "s1", "h1", "sellerId"),
                    entry("e2", "s2", "h1", "buyerId"),
                ],
                placings: [
                    { entry_id: "e1", place: 1 }, // seller campaigned this
                    { entry_id: "e2", place: 2 }, // buyer campaigned this
                ],
            }),
        );
        const points = new Map(result.map((r) => [r.ownerId, r.points]));
        expect(points.get("sellerId")).toBe(7);
        expect(points.get("buyerId")).toBe(5);
    });
});

describe("row-shape contract (materialized-view replacement seam)", () => {
    it("horse rows carry exactly the contracted keys", () => {
        const [row] = buildHorseStandings(
            input({
                shows: [show({ id: "s1" })],
                entries: [entry("e1", "s1", "h1", "o1")],
                placings: [{ entry_id: "e1", place: 1 }],
            }),
        );
        expect(Object.keys(row).sort()).toEqual([
            "championships",
            "horseId",
            "horseName",
            "ownerAlias",
            "ownerId",
            "placings",
            "points",
            "rank",
            "showsEntered",
        ]);
        expect(typeof row.rank).toBe("number");
        expect(typeof row.points).toBe("number");
    });

    it("stable rows carry exactly the contracted keys", () => {
        const [row] = buildStableStandings(
            input({
                shows: [show({ id: "s1" })],
                entries: [entry("e1", "s1", "h1", "o1")],
            }),
        );
        expect(Object.keys(row).sort()).toEqual([
            "championships",
            "ownerAlias",
            "ownerId",
            "placings",
            "points",
            "rank",
            "showsEntered",
        ]);
    });

    it("empty input yields empty standings (the young show year)", () => {
        expect(buildHorseStandings(input({}))).toEqual([]);
        expect(buildStableStandings(input({}))).toEqual([]);
    });
});
