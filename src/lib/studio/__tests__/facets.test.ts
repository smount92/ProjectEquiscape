import { describe, it, expect } from "vitest";

import { canonicalFacet, canonicalFacets, sameFacet } from "@/lib/studio/facets";

describe("studio facets", () => {
    // Exactly what the live directory showed on 2026-09-18.
    it("folds the spellings the live directory was listing separately", () => {
        expect(
            canonicalFacets([
                "Acrylics",
                "Body Mods",
                "Body mods",
                "Custom (sculpting)",
                "Custom Painting (OF)",
                "Custom Painting (Resin)",
                "Dolls & riders",
                "Etching/Dremmeling",
                "Finishwork (repaint)",
                "Hairing",
                "Pastels",
                "Prep work",
                "Prepping",
                "Props",
                "Resin prep & finish",
                "Tack Making",
                "Tack making",
            ]),
        ).toEqual([
            "Acrylics",
            "Body Mods",
            "Custom (sculpting)",
            "Finishwork (repaint)",
            "Resin prep & finish",
            "Dolls & riders",
            "Etching / dremel work",
            "Hair / mane & tail",
            "Pastels",
            "Prep work",
            "Props",
            "Tack making",
        ]);
    });

    it("prefers the current vocabulary's label when a value matches it case-insensitively", () => {
        expect(canonicalFacet("tack MAKING")).toBe("Tack making");
        expect(canonicalFacet("  Finishwork (Repaint) ")).toBe("Finishwork (repaint)");
    });

    it("keeps an unknown value as typed, whitespace tidied", () => {
        expect(canonicalFacet("  Glazework   ")).toBe("Glazework");
        expect(canonicalFacets(["Micro Mini", "Micro mini", "Other"])).toEqual(["Micro mini", "Other"]);
    });

    it("compares by meaning", () => {
        expect(sameFacet("Prepping", "Prep work")).toBe(true);
        expect(sameFacet("Tack Making", "tack making")).toBe(true);
        expect(sameFacet("Props", "Prep work")).toBe(false);
    });

    it("drops empties", () => {
        expect(canonicalFacets(["", "  ", "Props"])).toEqual(["Props"]);
    });
});
