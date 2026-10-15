import { describe, expect, it } from "vitest";
import { canonicalVocabulary, vocabularyProblem } from "@/lib/catalog/corrections";

describe("Registry vocabularies (the database refuses anything else, migration 233)", () => {
    it("gives the list's own spelling", () => {
        expect(canonicalVocabulary("scale", "classic")).toBe("Classic (1:12)");
        expect(canonicalVocabulary("scale", "Stablemate (1:32)")).toBe("Stablemate (1:32)");
        expect(canonicalVocabulary("material", "resin")).toBe("Resin");
        expect(canonicalVocabulary("run_type", "breyerfest")).toBe("BreyerFest");
    });

    it("returns null for values in no list, and for empty values", () => {
        expect(canonicalVocabulary("scale", "Gigantic")).toBeNull();
        expect(canonicalVocabulary("material", "Porcelain")).toBeNull();
        expect(canonicalVocabulary("run_type", "Benefit Live Auction Lot #01")).toBeNull();
        expect(canonicalVocabulary("scale", "  ")).toBeNull();
        expect(canonicalVocabulary("scale", undefined)).toBeNull();
    });

    it("names the first problem in a correction or an addition", () => {
        expect(vocabularyProblem({ scale: { from: "", to: "Gigantic" } })).toMatch(/not a scale/);
        expect(vocabularyProblem({ material: "Porcelain", title: "X" })).toMatch(/not a material/);
        expect(vocabularyProblem({ run_type: { from: "", to: "Lottery" } })).toMatch(/not a run type/);
    });

    it("lets good values, other fields and cleared values through", () => {
        expect(vocabularyProblem({ scale: { from: "", to: "traditional" }, title: { from: "a", to: "B" } })).toBeNull();
        expect(vocabularyProblem({ scale: { from: "Classic (1:12)", to: "" } })).toBeNull();
        expect(vocabularyProblem({ color_description: { from: "", to: "Bay" } })).toBeNull();
    });
});
