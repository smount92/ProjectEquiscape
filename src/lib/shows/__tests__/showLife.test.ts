import { describe, expect, it } from "vitest";

import {
    buildShowLife,
    formatCloseAt,
    placeLabel,
    MAX_LISTED_CLASSES,
    MAX_LISTED_PLACINGS,
    MAX_RESULT_SHOWS,
    type ShowLifeEntryRow,
    type ShowLifePlacingRow,
    type ShowLifeShowRow,
} from "../showLife";

const classNamesById = new Map([
    ["c1", "Breed Halter"],
    ["c2", "Collectibility"],
    ["c3", "Performance"],
    ["c4", "Workmanship"],
    ["c5", "Custom Halter"],
]);
const horseNamesById = new Map([
    ["h1", "Ruffian"],
    ["h2", "Maple"],
]);

function entry(id: string, showId: string, classId = "c1", horseId = "h1"): ShowLifeEntryRow {
    return { id, show_id: showId, class_id: classId, horse_id: horseId };
}

function show(
    id: string,
    status: string,
    entriesCloseAt: string | null = null,
    updatedAt = "2026-07-01T00:00:00Z",
): ShowLifeShowRow {
    return { id, title: `Show ${id}`, status, entries_close_at: entriesCloseAt, updated_at: updatedAt };
}

describe("buildShowLife — active entries", () => {
    it("groups my entries per active show with count and up to 3 class names", () => {
        const life = buildShowLife({
            entries: [
                entry("e1", "s1", "c1"),
                entry("e2", "s1", "c2"),
                entry("e3", "s1", "c3"),
                entry("e4", "s1", "c4"),
            ],
            shows: [show("s1", "entries_open", "2099-01-01T00:00:00Z")],
            placings: [],
            classNamesById,
            horseNamesById,
        });

        expect(life.activeEntries).toHaveLength(1);
        const active = life.activeEntries[0];
        expect(active.showId).toBe("s1");
        expect(active.showStatus).toBe("entries_open");
        expect(active.myEntryCount).toBe(4);
        expect(active.myClasses).toHaveLength(MAX_LISTED_CLASSES);
        expect(active.myClasses).toEqual(["Breed Halter", "Collectibility", "Performance"]);
    });

    it("sorts active shows soonest deadline first, null deadlines last", () => {
        const life = buildShowLife({
            entries: [entry("e1", "far"), entry("e2", "soon"), entry("e3", "nodate")],
            shows: [
                show("far", "entries_open", "2099-06-01T00:00:00Z"),
                show("soon", "entries_open", "2099-01-01T00:00:00Z"),
                show("nodate", "judging", null),
            ],
            placings: [],
            classNamesById,
            horseNamesById,
        });
        expect(life.activeEntries.map((a) => a.showId)).toEqual(["soon", "far", "nodate"]);
    });

    it("excludes draft/completed shows from active and tolerates unknown ids", () => {
        const life = buildShowLife({
            entries: [entry("e1", "done"), entry("e2", "ghost-show"), entry("e3", "s1", "ghost-class")],
            shows: [show("done", "completed"), show("s1", "entries_open")],
            placings: [],
            classNamesById,
            horseNamesById,
        });
        expect(life.activeEntries).toHaveLength(1);
        expect(life.activeEntries[0].showId).toBe("s1");
        // Unknown class name degrades, never crashes.
        expect(life.activeEntries[0].myClasses).toEqual(["Class"]);
    });
});

describe("buildShowLife — recent results", () => {
    it("collects my placings from published shows only, best place first, capped at 5", () => {
        const entries = [
            entry("e1", "s1", "c1", "h1"),
            entry("e2", "s1", "c2", "h2"),
            entry("e3", "s1", "c3", "h1"),
            entry("e4", "s1", "c4", "h2"),
            entry("e5", "s1", "c5", "h1"),
            entry("e6", "s1", "c1", "h2"),
            entry("e7", "review", "c1", "h1"),
        ];
        const placings: ShowLifePlacingRow[] = [
            { entry_id: "e1", class_id: "c1", place: 3 },
            { entry_id: "e2", class_id: "c2", place: 1 },
            { entry_id: "e3", class_id: "c3", place: 2 },
            { entry_id: "e4", class_id: "c4", place: 6 },
            { entry_id: "e5", class_id: "c5", place: 4 },
            { entry_id: "e6", class_id: "c1", place: 5 },
            // Provisional show — must not surface even if a row leaks in.
            { entry_id: "e7", class_id: "c1", place: 1 },
            // Participation (null place) is not a result line.
            { entry_id: "e1", class_id: "c1", place: null },
        ];
        const life = buildShowLife({
            entries,
            shows: [show("s1", "completed"), show("review", "results_review")],
            placings,
            classNamesById,
            horseNamesById,
        });

        expect(life.recentResults).toHaveLength(1);
        const result = life.recentResults[0];
        expect(result.showTitle).toBe("Show s1");
        expect(result.placings).toHaveLength(MAX_LISTED_PLACINGS);
        expect(result.placings[0]).toEqual({ horseName: "Maple", place: 1, className: "Collectibility" });
        expect(result.placings.map((p) => p.place)).toEqual([1, 2, 3, 4, 5]);
    });

    it("keeps the newest shows first and caps the show list", () => {
        const shows: ShowLifeShowRow[] = [];
        const entries: ShowLifeEntryRow[] = [];
        const placings: ShowLifePlacingRow[] = [];
        for (let i = 1; i <= 5; i++) {
            shows.push(show(`s${i}`, "completed", null, `2026-0${i}-01T00:00:00Z`));
            entries.push(entry(`e${i}`, `s${i}`));
            placings.push({ entry_id: `e${i}`, class_id: "c1", place: 1 });
        }
        const life = buildShowLife({ entries, shows, placings, classNamesById, horseNamesById });
        expect(life.recentResults).toHaveLength(MAX_RESULT_SHOWS);
        expect(life.recentResults.map((r) => r.showId)).toEqual(["s5", "s4", "s3"]);
    });

    it("returns the empty shape at zero data", () => {
        const life = buildShowLife({
            entries: [],
            shows: [],
            placings: [],
            classNamesById: new Map(),
            horseNamesById: new Map(),
        });
        expect(life).toEqual({ activeEntries: [], recentResults: [] });
    });
});

describe("formatCloseAt", () => {
    const now = new Date("2026-08-01T12:00:00Z");

    it("is null for null / invalid input", () => {
        expect(formatCloseAt(null, now)).toBeNull();
        expect(formatCloseAt("not a date", now)).toBeNull();
    });

    it("labels past deadlines as closed", () => {
        expect(formatCloseAt("2026-08-01T11:59:00Z", now)).toBe("entries closed");
    });

    it("counts down soon / hours / tomorrow / days", () => {
        expect(formatCloseAt("2026-08-01T12:30:00Z", now)).toBe("entries close soon");
        expect(formatCloseAt("2026-08-01T17:00:00Z", now)).toBe("entries close in 5 hours");
        expect(formatCloseAt("2026-08-01T13:30:00Z", now)).toBe("entries close in 1 hour");
        expect(formatCloseAt("2026-08-02T20:00:00Z", now)).toBe("entries close tomorrow");
        expect(formatCloseAt("2026-08-05T12:30:00Z", now)).toBe("entries close in 4 days");
    });
});

describe("placeLabel", () => {
    it("renders the one placing vocabulary", () => {
        expect([1, 2, 3, 4, 5, 6].map(placeLabel)).toEqual([
            "1st",
            "2nd",
            "3rd",
            "4th",
            "5th",
            "6th",
        ]);
    });
});
