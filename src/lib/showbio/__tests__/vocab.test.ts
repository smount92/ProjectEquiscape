import { describe, it, expect } from "vitest";
import { AGES, BREEDS, COLORS, canonicalShowbio, showbioSuggestions } from "@/lib/showbio/vocab";

describe("show-bio vocabulary", () => {
    it("lists are non-empty and free of duplicates (case-insensitive)", () => {
        for (const list of [BREEDS, COLORS, AGES]) {
            expect(list.length).toBeGreaterThan(0);
            const lower = list.map((v) => v.toLowerCase());
            expect(new Set(lower).size).toBe(lower.length);
        }
    });

    it("folds case and spacing into the list spelling", () => {
        expect(canonicalShowbio("breed", "quarter   horse")).toBe("Quarter Horse");
        expect(canonicalShowbio("breed", "AKHAL TEKE")).toBe("Akhal-Teke");
        expect(canonicalShowbio("color", "bay TOBIANO")).toBe("Bay tobiano");
        expect(canonicalShowbio("color", "Gray")).toBe("Grey");
        expect(canonicalShowbio("age", "adult")).toBe("Adult");
    });

    it("maps hobby shorthand to the list spelling", () => {
        expect(canonicalShowbio("breed", "Paint")).toBe("Paint Horse");
        expect(canonicalShowbio("breed", "American Mustang")).toBe("Mustang");
        expect(canonicalShowbio("breed", "TB")).toBe("Thoroughbred");
        expect(canonicalShowbio("age", "2 year old")).toBe("2 years");
    });

    it("keeps anything it does not know exactly as typed, trimmed", () => {
        expect(canonicalShowbio("breed", "  Kiger Mustang ")).toBe("Kiger Mustang");
        expect(canonicalShowbio("color", "sooty buckskin sabino")).toBe("sooty buckskin sabino");
        expect(canonicalShowbio("age", "Adult, born 2018")).toBe("Adult, born 2018");
        expect(canonicalShowbio("age", "5")).toBe("5");
    });

    it("turns empty input into null", () => {
        expect(canonicalShowbio("breed", "")).toBeNull();
        expect(canonicalShowbio("breed", "   ")).toBeNull();
        expect(canonicalShowbio("breed", null)).toBeNull();
        expect(canonicalShowbio("breed", undefined)).toBeNull();
    });

    it("offers each field its own list", () => {
        expect(showbioSuggestions("breed")).toBe(BREEDS);
        expect(showbioSuggestions("color")).toBe(COLORS);
        expect(showbioSuggestions("age")).toBe(AGES);
    });
});
