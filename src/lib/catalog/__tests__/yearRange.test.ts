import { describe, expect, it } from "vitest";
import { additionYears, parseYearRange } from "@/lib/catalog/corrections";
import { passportReleaseInfo, yearRangeLabel } from "@/lib/catalog/cardDisplay";
import { yearsInput, yearsLabel } from "@/lib/linker/model";
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

    it("shows an end-only year as an end, never as a first year (review of MHH-077)", () => {
        expect(yearRangeLabel({ release_year_end: 1997 })).toBe("–1997");
        expect(yearsLabel({ from: null, to: 1997 })).toBe("–1997");
        expect(releaseYears({ release_year_end: "1997" })).toBe("–1997");
    });

    it("keeps a legacy year written in words instead of hiding it", () => {
        expect(yearRangeLabel({ release_year_start: "1990s" })).toBe("1990s");
        expect(yearRangeLabel({ release_year_start: " c. 1985 " })).toBe("c. 1985");
        expect(yearRangeLabel({ release_year_start: "1990s", release_year_end: 1999 })).toBe("1990s–1999");
        expect(yearRangeLabel({ release_year_start: "", release_year_end: null })).toBeNull();
        expect(yearRangeLabel({ release_year_start: {} })).toBeNull();
    });
});

describe("passportReleaseInfo: the passport's release rows", () => {
    it("carries one years label, so a row shows only when there is something to show", () => {
        const cat = (attributes: Record<string, unknown>) => ({
            item_type: "plastic_release",
            title: "Pinto Saddlebred",
            attributes,
        });
        expect(passportReleaseInfo(cat({ release_year_start: "1990s" }))?.years).toBe("1990s");
        expect(passportReleaseInfo(cat({ release_year_end: 1997 }))?.years).toBe("–1997");
        expect(passportReleaseInfo(cat({ release_year_start: 1995, release_year_end: 1997 }))?.years).toBe("1995–1997");
        expect(passportReleaseInfo(cat({ release_year_start: "" }))?.years).toBeNull();
        expect(passportReleaseInfo(cat({ model_number: "5002", color_description: "Light chestnut pinto" }))).toEqual({
            name: "Pinto Saddlebred",
            modelNumber: "5002",
            color: "Light chestnut pinto",
            years: null,
        });
        expect(passportReleaseInfo({ item_type: "plastic_mold", title: "Saddlebred", attributes: {} })).toBeNull();
        expect(passportReleaseInfo(null)).toBeNull();
    });
});

describe("yearsInput: the years a form is filled in with", () => {
    it("never files an end year as a first year", () => {
        expect(yearsInput({ from: 1995, to: 1997 })).toBe("1995-1997");
        expect(yearsInput({ from: 1998, to: null })).toBe("1998");
        expect(yearsInput({ from: 1998, to: 1998 })).toBe("1998");
        expect(yearsInput({ from: null, to: 1997 })).toBe("");
        expect(yearsInput({ from: null, to: null })).toBe("");
    });
});
