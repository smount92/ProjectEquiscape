import { describe, expect, it } from "vitest";

import { bucketByDay, countPriorWindow, dayLabels, deltaLabel, shortDay } from "../growth";

const NOW = new Date("2026-09-21T15:00:00Z");

describe("growth series", () => {
    it("labels the last N UTC days oldest first, ending today", () => {
        expect(dayLabels(3, NOW)).toEqual(["2026-09-19", "2026-09-20", "2026-09-21"]);
    });

    it("buckets stamps by day and fills the gaps with zero", () => {
        const stamps = ["2026-09-21T01:00:00Z", "2026-09-21T23:59:00Z", "2026-09-19T12:00:00Z", "2026-08-01T00:00:00Z", null];
        expect(bucketByDay(stamps, 3, NOW)).toEqual([1, 0, 2]);
    });

    it("counts the window immediately before this one", () => {
        const stamps = ["2026-09-18T10:00:00Z", "2026-09-17T10:00:00Z", "2026-09-15T10:00:00Z", "2026-09-20T10:00:00Z"];
        // window = 19..21, prior = 16..18
        expect(countPriorWindow(stamps, 3, NOW)).toBe(2);
    });

    it("says the delta plainly", () => {
        expect(deltaLabel(14, 9, 7)).toBe("+5 vs prior 7 days");
        expect(deltaLabel(4, 9, 7)).toBe("−5 vs prior 7 days");
        expect(deltaLabel(9, 9, 30)).toBe("same as prior 30 days");
        expect(deltaLabel(3, 0, 30)).toBe("first 30 days");
        expect(deltaLabel(0, 0, 7)).toBe("nothing in 7 days");
        expect(shortDay("2026-09-21")).toBe("Sep 21");
    });
});
