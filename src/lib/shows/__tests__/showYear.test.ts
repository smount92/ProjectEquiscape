import { describe, it, expect } from "vitest";
import {
    isInShowYear,
    showYearEnd,
    showYearLabel,
    showYearLabelOf,
    showYearOf,
    showYearStart,
} from "@/lib/shows/showYear";

describe("showYear — May 1 → April 30 (locked decision)", () => {
    describe("showYearOf — the edges", () => {
        it("Apr 30 belongs to the PREVIOUS show year", () => {
            expect(showYearOf("2027-04-30")).toBe(2026);
        });
        it("May 1 starts the NEW show year", () => {
            expect(showYearOf("2026-05-01")).toBe(2026);
        });
        it("Apr 30 / May 1 of the same calendar year straddle two show years", () => {
            expect(showYearOf("2026-04-30")).toBe(2025);
            expect(showYearOf("2026-05-01")).toBe(2026);
        });
        it("mid-year dates", () => {
            expect(showYearOf("2026-07-09")).toBe(2026);
            expect(showYearOf("2026-12-31")).toBe(2026);
            expect(showYearOf("2027-01-01")).toBe(2026);
            expect(showYearOf("2027-02-15")).toBe(2026);
        });
    });

    describe("input forms", () => {
        it("accepts Date objects (UTC calendar)", () => {
            expect(showYearOf(new Date(Date.UTC(2026, 3, 30)))).toBe(2025); // Apr 30
            expect(showYearOf(new Date(Date.UTC(2026, 4, 1)))).toBe(2026); // May 1
        });
        it("accepts full ISO timestamps without timezone drift", () => {
            expect(showYearOf("2026-04-30T23:59:59Z")).toBe(2025);
            expect(showYearOf("2026-05-01T00:00:00Z")).toBe(2026);
        });
        it("throws on invalid input", () => {
            expect(() => showYearOf("not a date")).toThrow(RangeError);
            expect(() => showYearOf(new Date("nope"))).toThrow(RangeError);
        });
    });

    describe("labels", () => {
        it('formats "2026–27" with an en dash', () => {
            expect(showYearLabel(2026)).toBe("2026–27");
        });
        it("pads single-digit end years", () => {
            expect(showYearLabel(2008)).toBe("2008–09");
        });
        it("handles the century rollover", () => {
            expect(showYearLabel(2099)).toBe("2099–00");
        });
        it("labels straight from a date", () => {
            expect(showYearLabelOf("2027-04-30")).toBe("2026–27");
            expect(showYearLabelOf("2027-05-01")).toBe("2027–28");
        });
    });

    describe("bounds", () => {
        it("start/end are May 1 and April 30", () => {
            expect(showYearStart(2026)).toBe("2026-05-01");
            expect(showYearEnd(2026)).toBe("2027-04-30");
        });
        it("isInShowYear respects the boundaries", () => {
            expect(isInShowYear("2026-05-01", 2026)).toBe(true);
            expect(isInShowYear("2027-04-30", 2026)).toBe(true);
            expect(isInShowYear("2027-05-01", 2026)).toBe(false);
            expect(isInShowYear("2026-04-30", 2026)).toBe(false);
        });
    });
});
