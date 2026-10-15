import { describe, expect, it } from "vitest";
import { buildCorrectionUpdate, hasTrailingPunctuation, normalizeFactValue, tidyName } from "@/lib/catalog/corrections";

describe("normalizeFactValue: one tidy step before a Registry write", () => {
    it("capitalizes a colour description and keeps the rest as typed", () => {
        expect(normalizeFactValue("color_description", "red chestnut, star")).toBe("Red chestnut, star");
        expect(normalizeFactValue("color_description", "  dapple grey ")).toBe("Dapple grey");
        expect(normalizeFactValue("color_description", "Bay")).toBe("Bay");
    });

    it("strips trailing punctuation and stray spaces from names", () => {
        expect(normalizeFactValue("title", "Silky Sullivan.")).toBe("Silky Sullivan");
        expect(normalizeFactValue("maker", "Maggie Bennett. ")).toBe("Maggie Bennett");
        expect(normalizeFactValue("title", "Arabian  Stallion (G1)")).toBe("Arabian Stallion (G1)");
        expect(normalizeFactValue("title", "Mr. Ed")).toBe("Mr. Ed");
    });

    it("keeps a period that ends an abbreviation", () => {
        expect(normalizeFactValue("title", "I.C.E.")).toBe("I.C.E.");
        expect(normalizeFactValue("title", "JCPenney Holiday Catalog, later Bentley Sales Co.")).toBe("JCPenney Holiday Catalog, later Bentley Sales Co.");
        expect(normalizeFactValue("title", "Dr. Peaches.")).toBe("Dr. Peaches");
        expect(hasTrailingPunctuation("Smart Chic Olena Jr.")).toBe(false);
        expect(hasTrailingPunctuation("Vanity,")).toBe(true);
        expect(tidyName("Bayberry and Roses.;")).toBe("Bayberry and Roses");
    });

    it("stores a four-digit year as a number", () => {
        expect(normalizeFactValue("release_year_start", "1998")).toBe(1998);
        expect(normalizeFactValue("release_year_end", " 2004 ")).toBe(2004);
        expect(normalizeFactValue("release_year_start", "circa 1998")).toBe("circa 1998");
        expect(normalizeFactValue("release_year_start", 1998)).toBe(1998);
    });

    it("keeps the paragraphs of notes and descriptions", () => {
        const notes = "First paragraph.\n\nSecond paragraph,\n  with a line break.";
        expect(normalizeFactValue("registry_notes", `  ${notes}  `)).toBe(notes);
        expect(normalizeFactValue("color_description", "bay,\nstar")).toBe("Bay,\nstar");
    });

    it("stores scale, run type and material in the list's own spelling", () => {
        expect(normalizeFactValue("scale", "traditional")).toBe("Traditional (1:9)");
        expect(normalizeFactValue("material", "china/ceramic")).toBe("China/Ceramic");
        expect(normalizeFactValue("run_type", "special run")).toBe("Special Run");
        expect(normalizeFactValue("scale", "Gigantic")).toBe("Gigantic");
    });

    it("reads Mesteño's final period as punctuation, not an abbreviation", () => {
        expect(hasTrailingPunctuation("Replaced Mesteño.")).toBe(true);
        expect(hasTrailingPunctuation("I.C.E.")).toBe(false);
    });

    it("leaves other fields and non-strings alone", () => {
        expect(normalizeFactValue("model_number", "700105")).toBe("700105");
        expect(normalizeFactValue("run_type", "Special Run")).toBe("Special Run");
        expect(normalizeFactValue("color_description", null)).toBe(null);
    });

    it("is applied when a correction is built", () => {
        const { columnUpdates, attributes } = buildCorrectionUpdate(
            {
                title: { from: "x", to: "Montana Harvest." },
                color_description: { from: "", to: "palomino" },
                release_year_start: { from: "", to: "2019" },
            },
            { model_number: "1838" }
        );
        expect(columnUpdates).toEqual({ title: "Montana Harvest" });
        expect(attributes).toEqual({ model_number: "1838", color_description: "Palomino", release_year_start: 2019 });
    });
});
