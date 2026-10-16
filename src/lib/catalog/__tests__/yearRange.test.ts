import { describe, expect, it } from "vitest";
import { additionYears, parseYearRange } from "@/lib/catalog/corrections";
import { yearRangeLabel } from "@/lib/catalog/cardDisplay";
import { yearsLabel } from "@/lib/linker/model";
import { releaseYears } from "@/lib/catalog/searchRank";

/** MHH-077: a release's years as a member types them, and as every page shows them. */
describe("parseYearRange", () => {
    it("reads one year and every way of writing a range", () => {
        expect(parseYearRange("1995")).toEqual({ ok: true, start: 1995, end: null });
        expect(parseYearRange(" 1995 ")).toEqual({ ok: true, start: 1995, end: null });
        expect(parseYearRange("1995-1997")).toEqual({ ok: true, start: 1995, end: 1997 });
        expect(parseYearRange("1995–97")).toEqual({ ok: true, start: 1995, end: 1997 });
        expect(parseYearRange("1995 - 1997")).toEqual({ ok: true, start: 1995, end: 1997 });
        expect(parseYearRange("1995 to 1997")).toEqual({ ok: true, start: 1995, end: 1997 });
        expect(parseYearRange("1995—1997")).toEqual({ ok: true, start: 1995, end: 1997 });
        expect(parseYearRange("1998-02")).toEqual({ ok: true, start: 1998, end: 2002 });
        // The same year twice is one year.
        expect(parseYearRange("1995-1995")).toEqual({ ok: true, start: 1995, end: null });
    });

    it("refuses an end before the start, years out of range, and anything else", () => {
        expect(parseYearRange("1997-1995")).toMatchObject({ ok: false, error: expect.stringMatching(/before/) });
        expect(parseYearRange("1995-93")).toMatchObject({ ok: false, error: expect.stringMatching(/before/) });
        expect(parseYearRange("1850")).toMatchObject({ ok: false, error: expect.stringMatching(/1900/) });
        expect(parseYearRange("2999")).toMatchObject({ ok: false });
        expect(parseYearRange("95")).toMatchObject({ ok: false, error: expect.stringMatching(/1995-1997/) });
        expect(parseYearRange("early 90s")).toMatchObject({ ok: false });
        expect(parseYearRange("")).toMatchObject({ ok: false });
    });
});

describe("additionYears: what an approved new entry stores", () => {
    it("stores the last year with the first, and never a broken range", () => {
        expect(additionYears(1995, 1997)).toEqual({ release_year_start: 1995, release_year_end: 1997 });
        expect(additionYears("1995", "1997")).toEqual({ release_year_start: 1995, release_year_end: 1997 });
        expect(additionYears(1995, undefined)).toEqual({ release_year_start: 1995 });
        expect(additionYears("1995", "")).toEqual({ release_year_start: 1995 });
        expect(additionYears(1997, 1995)).toEqual({ release_year_start: 1997 });
        expect(additionYears(undefined, 1997)).toEqual({});
    });
});

describe("one year label everywhere", () => {
    it("shows a start-only year as the year, not an open dash", () => {
        expect(yearRangeLabel({ release_year_start: 1998 })).toBe("1998");
        expect(yearsLabel({ from: 1998, to: null })).toBe("1998");
        expect(releaseYears({ release_year_start: 1998 })).toBe("1998");
        expect(yearsLabel({ from: 1995, to: 1997 })).toBe("1995–1997");
        expect(releaseYears({ release_year_start: "1995", release_year_end: 1997 })).toBe("1995–1997");
        expect(yearsLabel({ from: null, to: null })).toBeNull();
    });
});
