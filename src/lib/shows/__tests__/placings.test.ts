import { describe, it, expect } from "vitest";
import {
    MAX_PLACE,
    PLACES,
    championColor,
    championLabel,
    isValidPlace,
    parsePlace,
    placeLabel,
    ribbonColor,
    ribbonHex,
} from "@/lib/shows/placings";
import type { Place } from "@/lib/shows/types";

describe("placings — the single vocabulary", () => {
    it("covers places 1..6", () => {
        expect(MAX_PLACE).toBe(6);
        expect(PLACES).toEqual([1, 2, 3, 4, 5, 6]);
    });

    describe("placeLabel", () => {
        const expected: [Place, string][] = [
            [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [5, "5th"], [6, "6th"],
        ];
        it.each(expected)("place %d → %s", (place, label) => {
            expect(placeLabel(place)).toBe(label);
        });
        it("null → Participant", () => {
            expect(placeLabel(null)).toBe("Participant");
        });
        it("throws on out-of-range place", () => {
            expect(() => placeLabel(7 as Place)).toThrow(RangeError);
            expect(() => placeLabel(0 as Place)).toThrow(RangeError);
        });
    });

    describe("ribbonColor — US convention", () => {
        const expected: [Place, string][] = [
            [1, "blue"], [2, "red"], [3, "yellow"], [4, "white"], [5, "pink"], [6, "green"],
        ];
        it.each(expected)("place %d → %s ribbon", (place, color) => {
            expect(ribbonColor(place)).toBe(color);
        });
        it("participation gets no ribbon", () => {
            expect(ribbonColor(null)).toBeNull();
            expect(ribbonHex(null)).toBeNull();
        });
        it("every place has a hex value", () => {
            for (const p of PLACES) {
                expect(ribbonHex(p)).toMatch(/^#[0-9a-f]{6}$/i);
            }
        });
        it("throws on out-of-range place", () => {
            expect(() => ribbonColor(9 as Place)).toThrow(RangeError);
        });
    });

    describe("isValidPlace", () => {
        it("accepts 1..6 only", () => {
            expect(isValidPlace(1)).toBe(true);
            expect(isValidPlace(6)).toBe(true);
            expect(isValidPlace(0)).toBe(false);
            expect(isValidPlace(7)).toBe(false);
            expect(isValidPlace(2.5)).toBe(false);
            expect(isValidPlace(-1)).toBe(false);
        });
    });

    describe("championLabel — callback ladder", () => {
        it("section scope", () => {
            expect(championLabel("champion", "section")).toBe("Section Champion");
            expect(championLabel("reserve", "section")).toBe("Section Reserve Champion");
        });
        it("division scope", () => {
            expect(championLabel("champion", "division")).toBe("Division Champion");
            expect(championLabel("reserve", "division")).toBe("Division Reserve Champion");
        });
        it("show scope is Grand", () => {
            expect(championLabel("champion", "show")).toBe("Grand Champion");
            expect(championLabel("reserve", "show")).toBe("Reserve Grand Champion");
        });
        it("rosette colors", () => {
            expect(championColor("champion")).toBe("purple");
            expect(championColor("reserve")).toBe("lavender");
        });
    });

    describe("parsePlace — legacy adapter", () => {
        it("parses ordinal strings", () => {
            expect(parsePlace("1st")).toBe(1);
            expect(parsePlace("2nd")).toBe(2);
            expect(parsePlace("6th")).toBe(6);
        });
        it("parses bare numbers and numeric strings", () => {
            expect(parsePlace(3)).toBe(3);
            expect(parsePlace("4")).toBe(4);
            expect(parsePlace(" 5 ")).toBe(5);
        });
        it("returns null for participation / junk / out-of-range", () => {
            expect(parsePlace(null)).toBeNull();
            expect(parsePlace(undefined)).toBeNull();
            expect(parsePlace("Champion")).toBeNull();
            expect(parsePlace("7th")).toBeNull();
            expect(parsePlace(0)).toBeNull();
            expect(parsePlace("")).toBeNull();
        });
    });
});
