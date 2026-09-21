import { describe, expect, it } from "vitest";

import { IMPORT_MAX_ROWS, matchHeader, parseImportRows, parsePlacing, parseShowDate, parseShowType, TEMPLATE_COLUMNS, templateCsv } from "../import";

describe("show results import: dates", () => {
    it("reads ISO, European day-first, month names and bare years", () => {
        expect(parseShowDate("2024-03-23")).toEqual({ showDate: "2024-03-23", showDateText: null, ok: true });
        expect(parseShowDate("23/03/2024")).toEqual({ showDate: "2024-03-23", showDateText: null, ok: true });
        expect(parseShowDate("23.03.2024").showDate).toBe("2024-03-23");
        expect(parseShowDate("03/23/2024").showDate).toBe("2024-03-23");
        expect(parseShowDate("5/6/2024").showDate).toBe("2024-06-05");
        expect(parseShowDate("23 March 2024").showDate).toBe("2024-03-23");
        expect(parseShowDate("March 23, 2024").showDate).toBe("2024-03-23");
        expect(parseShowDate("March 2024")).toEqual({ showDate: "2024-03-01", showDateText: "March 2024", ok: true });
        expect(parseShowDate("2019")).toEqual({ showDate: "2019-01-01", showDateText: "2019", ok: true });
        expect(parseShowDate("")).toEqual({ showDate: null, showDateText: null, ok: true });
    });

    it("refuses what it cannot read, but keeps the text", () => {
        expect(parseShowDate("last spring")).toEqual({ showDate: null, showDateText: "last spring", ok: false });
        expect(parseShowDate("31/02/2024").ok).toBe(false);
    });
});

describe("show results import: placings", () => {
    it("normalises numbers, ordinals, words and ribbon colours", () => {
        expect(parsePlacing("1")).toEqual({ placing: "1st", ribbonColor: "Blue" });
        expect(parsePlacing("2nd")).toEqual({ placing: "2nd", ribbonColor: "Red" });
        expect(parsePlacing("Third")).toEqual({ placing: "3rd", ribbonColor: "Yellow" });
        expect(parsePlacing("blue")).toEqual({ placing: "1st", ribbonColor: "Blue" });
        expect(parsePlacing("1st of 12")).toEqual({ placing: "1st", ribbonColor: "Blue" });
        expect(parsePlacing("11")).toEqual({ placing: "11th", ribbonColor: null });
        expect(parsePlacing("21")).toEqual({ placing: "21st", ribbonColor: null });
    });

    it("keeps championship words and passes unknown text through", () => {
        expect(parsePlacing("Reserve")).toEqual({ placing: "Reserve Champion", ribbonColor: null });
        expect(parsePlacing("HM")).toEqual({ placing: "Honorable Mention", ribbonColor: null });
        expect(parsePlacing("1st + Champion")).toEqual({ placing: "1st", ribbonColor: "Blue" });
        expect(parsePlacing("Best in Show")).toEqual({ placing: "Best in Show", ribbonColor: null });
        expect(parsePlacing("")).toBeNull();
        expect(parsePlacing("0")).toBeNull();
    });
});

describe("show results import: headers and rows", () => {
    it("matches template headers and the aliases people type", () => {
        expect(matchHeader("Show name")).toBe("showName");
        expect(matchHeader("SHOW")).toBe("showName");
        expect(matchHeader("Placement")).toBe("placing");
        expect(matchHeader("# of entries")).toBe("classSize");
        expect(matchHeader("Judge Name")).toBe("judgeName");
        expect(matchHeader("Horse")).toBeNull();
    });

    it("parses a good row into a record with defaults filled", () => {
        const { records, problems } = parseImportRows([
            { "Show name": "Spring Fling", "Show date": "23/03/2024", "Photo or live": "", Division: "Halter", Class: "Stock Horse Mare", Placing: "1", "Class size": "12", "Card program": "NAN", "Card color": "green", "Card year": "" },
        ]);
        expect(problems).toEqual([]);
        expect(records).toHaveLength(1);
        expect(records[0].rowNumber).toBe(2);
        expect(records[0].record).toMatchObject({
            showName: "Spring Fling",
            showDate: "2024-03-23",
            showType: "photo",
            division: "Halter",
            className: "Stock Horse Mare",
            placing: "1st",
            ribbonColor: "Blue",
            classSize: 12,
            qualifierProgram: "nan",
            qualifierCard: "green",
            qualifierYear: 2024,
            judgeName: null,
        });
    });

    it("reports problems per row and keeps the good rows", () => {
        const { records, problems } = parseImportRows([
            { "Show name": "A", Placing: "1", "Show date": "" },
            { "Show name": "", Placing: "2", "Show date": "" },
            { "Show name": "C", Placing: "1", "Show date": "sometime" },
            { "Show name": "D", Placing: "1", "Photo or live": "hybrid" },
            { "Show name": "E", Placing: "1", "Card program": "NAN", "Card color": "" },
            { "Show name": "", Placing: "", "Show date": "" },
        ]);
        expect(records.map((r) => r.record.showName)).toEqual(["A"]);
        expect(problems.map((p) => p.rowNumber)).toEqual([3, 4, 5, 6]);
        expect(problems[0].message).toMatch(/Show name is missing/);
        expect(problems[1].message).toMatch(/Date "sometime"/);
        expect(problems[2].message).toMatch(/Photo or live/);
        expect(problems[3].message).toMatch(/needs a card color/);
    });

    it("refuses a file without the required columns", () => {
        const { records, problems } = parseImportRows([{ Judge: "x" }]);
        expect(records).toEqual([]);
        expect(problems.map((p) => p.message)).toEqual([`The file has no "Show name" column.`, `The file has no "Placing" column.`]);
    });

    it("caps the row count and says so", () => {
        const rows = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => ({ "Show name": `S${i}`, Placing: "1" }));
        const { records, problems } = parseImportRows(rows);
        expect(records).toHaveLength(IMPORT_MAX_ROWS);
        expect(problems.at(-1)?.message).toMatch(/first 500 rows/);
    });

    it("ships a template whose headers all map back to columns", () => {
        const [header] = templateCsv().split("\n");
        expect(header.split(",")).toHaveLength(TEMPLATE_COLUMNS.length);
        for (const c of TEMPLATE_COLUMNS) expect(matchHeader(c.header)).toBe(c.key);
        expect(parseShowType("L")).toBe("live");
        expect(parseShowType("online")).toBe("photo");
    });
});
