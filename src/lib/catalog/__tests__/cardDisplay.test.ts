import { describe, it, expect } from "vitest";
import {
    disambiguationLine,
    displayTitle,
    pickQuickChips,
    yearRangeLabel,
} from "@/lib/catalog/cardDisplay";

describe("yearRangeLabel", () => {
    it("renders a start–end range", () => {
        expect(yearRangeLabel({ release_year_start: 1988, release_year_end: 1995 })).toBe(
            "1988–1995",
        );
    });

    it("collapses equal start/end to one year", () => {
        expect(yearRangeLabel({ release_year_start: "1988", release_year_end: "1988" })).toBe(
            "1988",
        );
    });

    it("tolerates start-only and end-only", () => {
        expect(yearRangeLabel({ release_year_start: 2001 })).toBe("2001");
        expect(yearRangeLabel({ release_year_end: "1979" })).toBe("1979");
    });

    it("accepts the alternate year_start/year_end key spellings", () => {
        expect(yearRangeLabel({ year_start: 1960, year_end: 1966 })).toBe("1960–1966");
    });

    it("prefers the canonical release_* keys when both spellings exist", () => {
        expect(yearRangeLabel({ release_year_start: 1988, year_start: 1901 })).toBe("1988");
    });

    it("returns null for absent, empty, or garbage values", () => {
        expect(yearRangeLabel(undefined)).toBeNull();
        expect(yearRangeLabel(null)).toBeNull();
        expect(yearRangeLabel({})).toBeNull();
        expect(yearRangeLabel({ release_year_start: "" })).toBeNull();
        expect(yearRangeLabel({ release_year_start: "unknown" })).toBeNull();
        expect(yearRangeLabel({ release_year_start: { nested: true } })).toBeNull();
        expect(yearRangeLabel({ release_year_start: "88" })).toBeNull();
    });
});

describe("disambiguationLine", () => {
    it("joins maker · years · color", () => {
        expect(
            disambiguationLine("Breyer", {
                release_year_start: 1988,
                release_year_end: 1995,
                color_description: "Dapple grey",
            }),
        ).toBe("Breyer · 1988–1995 · Dapple grey");
    });

    it("skips whatever is absent", () => {
        expect(disambiguationLine("Breyer", { color_description: "Bay" })).toBe("Breyer · Bay");
        expect(disambiguationLine("Breyer", null)).toBe("Breyer");
        expect(disambiguationLine(null, { release_year_start: 1990 })).toBe("1990");
    });

    it("returns empty string when nothing is known", () => {
        expect(disambiguationLine(null, null)).toBe("");
        expect(disambiguationLine("  ", { color_description: "   " })).toBe("");
    });

    it("trims whitespace-padded values", () => {
        expect(disambiguationLine(" Peter Stone ", { color_description: " Chestnut " })).toBe(
            "Peter Stone · Chestnut",
        );
    });
});

describe("displayTitle", () => {
    it("title-cases shout-case legacy names", () => {
        expect(displayTitle("COMMANDER")).toBe("Commander");
        expect(displayTitle("BIG BEN")).toBe("Big Ben");
        expect(displayTitle("SAN DOMINGO - GLOSSY")).toBe("San Domingo - Glossy");
    });

    it("leaves mixed-case curator casing exactly as stored", () => {
        expect(displayTitle("El Campeador")).toBe("El Campeador");
        expect(displayTitle("McDuff")).toBe("McDuff");
        expect(displayTitle("d'Artagnan")).toBe("d'Artagnan");
    });

    it("leaves short acronym-like tokens alone", () => {
        expect(displayTitle("POA")).toBe("POA");
        expect(displayTitle("ISH")).toBe("ISH");
    });

    it("tolerates null/empty and trims", () => {
        expect(displayTitle(null)).toBe("");
        expect(displayTitle(undefined)).toBe("");
        expect(displayTitle("  Misty  ")).toBe("Misty");
    });
});

describe("pickQuickChips", () => {
    it("returns preferred values that exist, in preference order", () => {
        expect(
            pickQuickChips(["Breyer", "Copperfox", "Hartland", "Peter Stone"], ["Peter Stone", "Breyer"], 3),
        ).toEqual(["Peter Stone", "Breyer"]);
    });

    it("matches preferred values case-insensitively but keeps facet casing", () => {
        expect(pickQuickChips(["BREYER"], ["Breyer"], 2)).toEqual(["BREYER"]);
    });

    it("respects the limit", () => {
        expect(pickQuickChips(["A", "B", "C"], ["A", "B", "C"], 2)).toEqual(["A", "B"]);
    });

    it("never pads with unvetted facet values (alphabetical head is junk)", () => {
        expect(pickQuickChips(["?", "Cantering", "Breyer"], ["Breyer"], 4)).toEqual(["Breyer"]);
    });

    it("handles empty/absent facets", () => {
        expect(pickQuickChips(undefined, ["Breyer"], 4)).toEqual([]);
        expect(pickQuickChips(["", "  "], ["Breyer"], 4)).toEqual([]);
    });
});
