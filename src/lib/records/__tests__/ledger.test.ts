import { describe, expect, it } from "vitest";

import { filterLedger, groupByYear, isFirstPlace, recordYear, summarizeLedger } from "../ledger";

const rec = (over: Partial<Parameters<typeof summarizeLedger>[0][number]> & { id: string }) => ({
    showName: "Spring Fling",
    showDate: "2024-03-23",
    placing: "1st",
    ...over,
});

describe("ledger", () => {
    it("summarises placings, firsts, championships, cards, shows and the span", () => {
        const s = summarizeLedger([
            rec({ id: "a", placing: "1st" }),
            rec({ id: "b", placing: "2nd", className: "Other" }),
            rec({ id: "c", placing: "Champion", ribbonColor: null, isNan: true }),
            rec({ id: "d", showName: "Autumn Live", showDate: "2019-10-01", placing: "Blue", qualifierProgram: "omeq" }),
            rec({ id: "e", showName: "Sometime", showDate: null, showDateText: "2021", placing: "HM" }),
        ]);
        expect(s).toEqual({ total: 5, firsts: 2, championships: 1, cards: 2, shows: 3, span: "2019–2024" });
    });

    it("reads a year from the date or the fuzzy text", () => {
        expect(recordYear({ showDate: "2024-03-23" })).toBe(2024);
        expect(recordYear({ showDate: null, showDateText: "Summer 2019" })).toBe(2019);
        expect(recordYear({ showDate: null, showDateText: "long ago" })).toBeNull();
        expect(isFirstPlace("1")).toBe(true);
        expect(isFirstPlace(null, "Blue")).toBe(true);
        expect(isFirstPlace("2nd", "Blue")).toBe(false);
    });

    it("groups newest year first with undated last", () => {
        const groups = groupByYear([
            rec({ id: "a", showDate: "2019-05-01" }),
            rec({ id: "b", showDate: "2024-03-23" }),
            rec({ id: "c", showDate: null, showDateText: null }),
            rec({ id: "d", showDate: "2024-08-01" }),
        ]);
        expect(groups.map((g) => [g.label, g.records.map((r) => r.id)])).toEqual([
            ["2024", ["b", "d"]],
            ["2019", ["a"]],
            ["Undated", ["c"]],
        ]);
    });

    it("filters by anything a member remembers a placing by", () => {
        const list = [
            rec({ id: "a", className: "Stock Horse Mare", judgeName: "Jane Judge" }),
            rec({ id: "b", showName: "Autumn Live", placing: "Reserve Champion", isNan: true }),
        ];
        expect(filterLedger(list, "stock").map((r) => r.id)).toEqual(["a"]);
        expect(filterLedger(list, "jane").map((r) => r.id)).toEqual(["a"]);
        expect(filterLedger(list, "reserve").map((r) => r.id)).toEqual(["b"]);
        expect(filterLedger(list, "nan").map((r) => r.id)).toEqual(["b"]);
        expect(filterLedger(list, "  ")).toHaveLength(2);
    });
});
