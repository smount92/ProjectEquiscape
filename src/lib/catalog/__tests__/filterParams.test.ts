import { describe, it, expect } from "vitest";
import {
    activeCatalogChips,
    buildCatalogSearchParams,
    catalogSortToQuery,
    clearAllCatalogFilters,
    countActiveCatalogFilters,
    hasAdvancedCatalogFilters,
    parseCatalogSearchParams,
    removeCatalogFilter,
    CATALOG_SORTS,
} from "@/lib/catalog/filterParams";

describe("parseCatalogSearchParams", () => {
    it("returns default sort + page for empty params", () => {
        expect(parseCatalogSearchParams({})).toEqual({ sort: "name-az", page: 1 });
    });

    it("parses every supported filter", () => {
        expect(
            parseCatalogSearchParams({
                q: "valegro",
                maker: "Breyer",
                scale: "Traditional",
                type: "artist_resin",
                sort: "newest",
                page: "3",
            }),
        ).toEqual({
            q: "valegro",
            maker: "Breyer",
            scale: "Traditional",
            type: "artist_resin",
            sort: "newest",
            page: 3,
        });
    });

    it("drops unknown type/sort values instead of trusting them", () => {
        expect(
            parseCatalogSearchParams({ type: "spaceship", sort: "priciest" }),
        ).toEqual({ sort: "name-az", page: 1 });
    });

    it("clamps page to a sane positive integer", () => {
        expect(parseCatalogSearchParams({ page: "0" }).page).toBe(1);
        expect(parseCatalogSearchParams({ page: "-4" }).page).toBe(1);
        expect(parseCatalogSearchParams({ page: "abc" }).page).toBe(1);
        expect(parseCatalogSearchParams({ page: "999999" }).page).toBe(10_000);
    });

    it("takes the first value of an array param and length-caps search", () => {
        expect(parseCatalogSearchParams({ q: ["a", "b"] }).q).toBe("a");
        expect(parseCatalogSearchParams({ q: `  ${"x".repeat(300)}  ` }).q).toHaveLength(100);
    });

    it("treats whitespace-only values as absent", () => {
        expect(parseCatalogSearchParams({ q: "   ", maker: " " })).toEqual({
            sort: "name-az",
            page: 1,
        });
    });
});

describe("buildCatalogSearchParams", () => {
    it("omits defaults (name-az, page 1) so the pristine URL stays clean", () => {
        expect(buildCatalogSearchParams({ sort: "name-az", page: 1 }).toString()).toBe("");
    });

    it("serializes active filters and non-default page", () => {
        const qs = buildCatalogSearchParams({
            maker: "Breyer",
            type: "plastic_mold",
            sort: "newest",
            page: 2,
        }).toString();
        expect(qs).toContain("maker=Breyer");
        expect(qs).toContain("type=plastic_mold");
        expect(qs).toContain("sort=newest");
        expect(qs).toContain("page=2");
    });

    it("round-trips through parse", () => {
        const filters = parseCatalogSearchParams({
            q: "chic",
            scale: "Stablemate",
            type: "plastic_release",
            sort: "maker",
            page: "5",
        });
        const back = parseCatalogSearchParams(
            Object.fromEntries(buildCatalogSearchParams(filters).entries()),
        );
        expect(back).toEqual(filters);
    });
});

describe("catalogSortToQuery", () => {
    it("maps every sort to a real (sortBy, sortDir) pair", () => {
        expect(catalogSortToQuery("name-az")).toEqual({ sortBy: "title", sortDir: "asc" });
        expect(catalogSortToQuery("name-za")).toEqual({ sortBy: "title", sortDir: "desc" });
        expect(catalogSortToQuery("maker")).toEqual({ sortBy: "maker", sortDir: "asc" });
        expect(catalogSortToQuery("newest")).toEqual({ sortBy: "created_at", sortDir: "desc" });
    });
    it("only offers honest sorts", () => {
        expect(CATALOG_SORTS).toEqual(["name-az", "name-za", "maker", "newest"]);
    });
});

describe("chips + remove/clear", () => {
    it("returns no chips for pristine filters; sort/page never chip", () => {
        expect(activeCatalogChips({ sort: "newest", page: 4 })).toEqual([]);
        expect(countActiveCatalogFilters({ sort: "newest", page: 1 })).toBe(0);
    });

    it("builds one chip per active filter with a human type label", () => {
        const chips = activeCatalogChips({
            q: "chic",
            maker: "Breyer",
            scale: "Classic",
            type: "artist_resin",
            sort: "name-az",
            page: 1,
        });
        expect(chips.map((c) => c.key)).toEqual(["q", "maker", "scale", "type"]);
        expect(chips.find((c) => c.key === "q")?.label).toBe("“chic”");
        expect(chips.find((c) => c.key === "type")?.label).toBe("Artist Resin");
    });

    it("removing a filter resets to page 1", () => {
        const next = removeCatalogFilter({ maker: "Breyer", scale: "Classic", sort: "maker", page: 6 }, "maker");
        expect(next).toEqual({ scale: "Classic", sort: "maker", page: 1 });
    });

    it("clear-all keeps the sort preference and resets page", () => {
        expect(
            clearAllCatalogFilters({ q: "x", maker: "Breyer", type: "plastic_mold", sort: "newest", page: 9 }),
        ).toEqual({ sort: "newest", page: 1 });
    });
});

describe("advanced (attributes) filters", () => {
    it("parses year range, color, model, medium, and material", () => {
        expect(
            parseCatalogSearchParams({
                year_from: "1990",
                year_to: "2005",
                color: "dark bay",
                model: "1490",
                medium: "resin",
                material: "Pewter",
            }),
        ).toEqual({
            sort: "name-az",
            page: 1,
            yearFrom: 1990,
            yearTo: 2005,
            color: "dark bay",
            model: "1490",
            medium: "resin",
            material: "Pewter",
        });
    });

    it("drops out-of-range years and swaps an inverted range", () => {
        expect(parseCatalogSearchParams({ year_from: "1200" }).yearFrom).toBeUndefined();
        expect(parseCatalogSearchParams({ year_to: "abc" }).yearTo).toBeUndefined();
        const swapped = parseCatalogSearchParams({ year_from: "2010", year_to: "1990" });
        expect([swapped.yearFrom, swapped.yearTo]).toEqual([1990, 2010]);
    });

    it("round-trips the advanced filters through build", () => {
        const filters = parseCatalogSearchParams({
            year_from: "1995",
            year_to: "2001",
            color: "chestnut",
            model: "700",
            medium: "resin",
            material: "Pewter",
            sort: "newest",
        });
        const back = parseCatalogSearchParams(
            Object.fromEntries(buildCatalogSearchParams(filters).entries()),
        );
        expect(back).toEqual(filters);
    });

    it("hasAdvancedCatalogFilters reflects only the advanced keys", () => {
        expect(hasAdvancedCatalogFilters({ sort: "name-az", page: 1, maker: "Breyer" })).toBe(false);
        expect(hasAdvancedCatalogFilters({ sort: "name-az", page: 1, yearFrom: 1990 })).toBe(true);
        expect(hasAdvancedCatalogFilters({ sort: "name-az", page: 1, color: "bay" })).toBe(true);
        expect(hasAdvancedCatalogFilters({ sort: "name-az", page: 1, material: "Pewter" })).toBe(true);
    });

    it("round-trips a material chip and removes it cleanly", () => {
        const filters = parseCatalogSearchParams({ material: "Pewter" });
        expect(filters.material).toBe("Pewter");
        const chip = activeCatalogChips(filters).find((c) => c.key === "material");
        expect(chip?.label).toBe("Pewter");
        expect(removeCatalogFilter(filters, "material").material).toBeUndefined();
    });

    it("renders one year chip and removing it clears both bounds", () => {
        const filters = { sort: "name-az" as const, page: 3, yearFrom: 1995, yearTo: 2001, color: "bay" };
        const chips = activeCatalogChips(filters);
        expect(chips.find((c) => c.key === "year")?.label).toBe("1995–2001");
        expect(chips.find((c) => c.key === "color")?.label).toBe("🎨 bay");
        const next = removeCatalogFilter(filters, "year");
        expect(next.yearFrom).toBeUndefined();
        expect(next.yearTo).toBeUndefined();
        expect(next).toEqual({ sort: "name-az", page: 1, color: "bay" });
    });

    it("labels open-ended and equal year ranges sensibly", () => {
        expect(activeCatalogChips({ sort: "name-az", page: 1, yearFrom: 1999 })[0].label).toBe("1999+");
        expect(activeCatalogChips({ sort: "name-az", page: 1, yearTo: 1999 })[0].label).toBe("≤1999");
        expect(activeCatalogChips({ sort: "name-az", page: 1, yearFrom: 2000, yearTo: 2000 })[0].label).toBe("2000");
    });
});
