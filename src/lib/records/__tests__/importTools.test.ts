import { describe, expect, it } from "vitest";

import { parseImportRows } from "../import";
import { applyHeaderMap, findDuplicates, guessHeaderMap, mapHasRequired, recordFingerprint } from "../importTools";

describe("header mapping", () => {
    it("guesses from the file's headers and leaves strangers unmapped", () => {
        const map = guessHeaderMap(["Event", "When", "Placement", "Horse", "Judge Name"]);
        expect(map).toEqual({ Event: "showName", When: "showDate", Placement: "placing", Horse: "", "Judge Name": "judgeName" });
        expect(mapHasRequired(map)).toBe(true);
        expect(mapHasRequired(guessHeaderMap(["Event", "Judge"]))).toBe(false);
    });

    it("never maps two file columns to one template column", () => {
        const map = guessHeaderMap(["Placing", "Placement"]);
        expect(map).toEqual({ Placing: "placing", Placement: "" });
    });

    it("rewrites rows onto the template's headers so the parser reads them", () => {
        const rows = applyHeaderMap([{ Event: "Spring Fling", When: "23/03/2024", Placement: "1", Horse: "Smoky" }], {
            Event: "showName",
            When: "showDate",
            Placement: "placing",
            Horse: "",
        });
        expect(rows).toEqual([{ "Show name": "Spring Fling", "Show date": "23/03/2024", Placing: "1" }]);
        const { records, problems } = parseImportRows(rows);
        expect(problems).toEqual([]);
        expect(records[0].record).toMatchObject({ showName: "Spring Fling", showDate: "2024-03-23", placing: "1st" });
    });
});

describe("duplicate detection", () => {
    it("matches on show, date, class and placing, loosely", () => {
        expect(recordFingerprint({ showName: "Spring  Fling", showDate: "2024-03-23", className: "Stock Horse Mare", placing: "1st" })).toBe(
            recordFingerprint({ showName: "spring fling", showDate: "2024-03-23T00:00:00", className: "stock horse mare", placing: "1ST" }),
        );
    });

    it("flags rows already on the horse and repeats within the file", () => {
        const { records } = parseImportRows([
            { "Show name": "Spring Fling", "Show date": "23/03/2024", Class: "Stock Horse Mare", Placing: "1" },
            { "Show name": "Spring Fling", "Show date": "23/03/2024", Class: "Stock Horse Mare", Placing: "1st" },
            { "Show name": "Spring Fling", "Show date": "23/03/2024", Class: "Stock Horse Mare", Placing: "2" },
            { "Show name": "Autumn Live", "Show date": "2023-10-01", Class: "Halter", Placing: "1" },
        ]);
        const dupes = findDuplicates(records, [{ showName: "Autumn Live", showDate: "2023-10-01", className: "Halter", placing: "1st" }]);
        expect([...dupes].sort()).toEqual([3, 5]);
    });
});
