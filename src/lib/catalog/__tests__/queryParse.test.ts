import { describe, it, expect } from "vitest";
import { expandInitials, makerMatches, parseCatalogQuery } from "@/lib/catalog/queryParse";

describe("parseCatalogQuery", () => {
    it("splits a leading maker off the query, any case, longest alias first", () => {
        expect(parseCatalogQuery("Peter stone Ideal sto")).toEqual({ maker: "Peter Stone", term: "Ideal sto", raw: "Peter stone Ideal sto" });
        expect(parseCatalogQuery("stone horses arabian").maker).toBe("Peter Stone");
        expect(parseCatalogQuery("Breyer Adios")).toMatchObject({ maker: "Breyer", term: "Adios" });
        expect(parseCatalogQuery("BHR clydesdale")).toMatchObject({ maker: "Black Horse Ranch", term: "clydesdale" });
    });

    it("spells the hobby's initials out, as whole words only", () => {
        expect(parseCatalogQuery("PS ISH")).toMatchObject({ maker: "Peter Stone", term: "Ideal Stock Horse" });
        expect(parseCatalogQuery("pas")).toMatchObject({ maker: null, term: "Proud Arabian Stallion" });
        expect(expandInitials("Wish")).toBe("Wish");
        expect(expandInitials("SHM glossy")).toBe("Stock Horse Mare glossy");
    });

    it("leaves a maker-less query alone, and keeps a bare maker as its own term", () => {
        expect(parseCatalogQuery("  Smoky  ")).toEqual({ maker: null, term: "Smoky", raw: "  Smoky  " });
        expect(parseCatalogQuery("Stonewall")).toMatchObject({ maker: null, term: "Stonewall" });
        expect(parseCatalogQuery("Breyer")).toMatchObject({ maker: "Breyer", term: "Breyer" });
        expect(parseCatalogQuery("")).toEqual({ maker: null, term: "", raw: "" });
    });

    it("matches a row's maker to the named maker loosely", () => {
        expect(makerMatches("Peter Stone", "Peter Stone")).toBe(true);
        expect(makerMatches("peter stone", "Peter Stone")).toBe(true);
        expect(makerMatches("Breyer", "Peter Stone")).toBe(false);
        expect(makerMatches(null, "Breyer")).toBe(false);
        expect(makerMatches("Breyer", null)).toBe(false);
    });
});
