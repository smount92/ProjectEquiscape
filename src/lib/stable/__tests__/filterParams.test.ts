import { describe, it, expect } from "vitest";
import {
    activeFilterChips,
    buildStableSearchParams,
    clearAllFilters,
    countActiveFilters,
    filtersToViewParams,
    parseStableSearchParams,
    removeFilter,
    viewParamsToFilters,
} from "@/lib/stable/filterParams";

const COLLECTION_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("parseStableSearchParams", () => {
    it("returns only the default sort for empty params", () => {
        expect(parseStableSearchParams({})).toEqual({ sort: "newest" });
    });

    it("parses every supported filter", () => {
        const filters = parseStableSearchParams({
            q: "valegro",
            finish: "OF",
            maker: "Breyer",
            scale: "Traditional",
            category: "tack",
            trade: "For Sale",
            collection: COLLECTION_ID,
            records: "1",
            sort: "name-az",
        });
        expect(filters).toEqual({
            q: "valegro",
            finish: "OF",
            maker: "Breyer",
            scale: "Traditional",
            category: "tack",
            trade: "For Sale",
            collection: COLLECTION_ID,
            hasRecords: true,
            sort: "name-az",
        });
    });

    it("drops unknown enum values instead of trusting them", () => {
        const filters = parseStableSearchParams({
            finish: "Chrome",
            trade: "Stolen",
            category: "spaceship",
            sort: "priciest",
        });
        expect(filters).toEqual({ sort: "newest" });
    });

    it("drops a non-UUID collection", () => {
        expect(parseStableSearchParams({ collection: "not-a-uuid" })).toEqual({ sort: "newest" });
    });

    it("ignores records values other than 1", () => {
        expect(parseStableSearchParams({ records: "true" })).toEqual({ sort: "newest" });
    });

    it("takes the first value of an array param", () => {
        expect(parseStableSearchParams({ q: ["a", "b"] }).q).toBe("a");
    });

    it("trims and length-caps the search query", () => {
        const filters = parseStableSearchParams({ q: `  ${"x".repeat(300)}  ` });
        expect(filters.q).toHaveLength(100);
    });

    it("treats whitespace-only values as absent", () => {
        expect(parseStableSearchParams({ q: "   ", maker: " " })).toEqual({ sort: "newest" });
    });
});

describe("buildStableSearchParams", () => {
    it("omits defaults so the pristine URL stays clean", () => {
        expect(buildStableSearchParams({ sort: "newest" }).toString()).toBe("");
    });

    it("serializes active filters", () => {
        const qs = buildStableSearchParams({
            finish: "OF",
            maker: "Breyer",
            hasRecords: true,
            sort: "oldest",
        }).toString();
        expect(qs).toContain("finish=OF");
        expect(qs).toContain("maker=Breyer");
        expect(qs).toContain("records=1");
        expect(qs).toContain("sort=oldest");
    });

    it("round-trips through parse", () => {
        const filters = parseStableSearchParams({
            q: "chic",
            finish: "Custom",
            trade: "Open to Offers",
            collection: COLLECTION_ID,
            sort: "name-za",
        });
        const qs = buildStableSearchParams(filters);
        const back = parseStableSearchParams(Object.fromEntries(qs.entries()));
        expect(back).toEqual(filters);
    });
});

describe("activeFilterChips", () => {
    it("returns no chips for pristine filters", () => {
        expect(activeFilterChips({ sort: "newest" })).toEqual([]);
        expect(countActiveFilters({ sort: "newest" })).toBe(0);
    });

    it("sort is a view preference, never a chip", () => {
        expect(activeFilterChips({ sort: "name-az" })).toEqual([]);
    });

    it("labels the collection chip with its name", () => {
        const chips = activeFilterChips({ collection: COLLECTION_ID, sort: "newest" }, [
            { id: COLLECTION_ID, name: "Vintage Herd" },
        ]);
        expect(chips).toEqual([{ key: "collection", label: "Vintage Herd" }]);
    });

    it("builds one chip per active filter with human labels", () => {
        const chips = activeFilterChips({
            q: "chic",
            finish: "OF",
            category: "other_model",
            hasRecords: true,
            sort: "newest",
        });
        expect(chips.map((c) => c.key)).toEqual(["q", "finish", "category", "hasRecords"]);
        expect(chips.find((c) => c.key === "category")?.label).toBe("Other Model");
        expect(chips.find((c) => c.key === "hasRecords")?.label).toBe("Has show records");
    });
});

describe("removeFilter / clearAllFilters", () => {
    it("removes exactly one filter", () => {
        const next = removeFilter({ finish: "OF", maker: "Breyer", sort: "oldest" }, "finish");
        expect(next).toEqual({ maker: "Breyer", sort: "oldest" });
    });

    it("clear-all keeps the sort preference", () => {
        expect(clearAllFilters({ q: "x", finish: "OF", hasRecords: true, sort: "name-az" })).toEqual({
            sort: "name-az",
        });
    });
});

describe("saved-view param round trip", () => {
    it("filters → params → filters is lossless", () => {
        const filters = parseStableSearchParams({
            finish: "Artist Resin",
            scale: "Stablemate",
            records: "1",
            sort: "oldest",
        });
        expect(viewParamsToFilters(filtersToViewParams(filters))).toEqual(filters);
    });

    it("ignores non-string junk in stored params", () => {
        expect(viewParamsToFilters({ finish: "OF", evil: { nested: true }, n: 4 })).toEqual({
            finish: "OF",
            sort: "newest",
        });
    });
});
