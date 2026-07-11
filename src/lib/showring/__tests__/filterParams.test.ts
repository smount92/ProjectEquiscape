import { describe, it, expect } from "vitest";
import {
    activeShowRingChips,
    buildShowRingSearchParams,
    clearAllShowRingFilters,
    countActiveShowRingFilters,
    parseShowRingSearchParams,
    removeShowRingFilter,
    SHOWRING_SORTS,
} from "@/lib/showring/filterParams";

describe("parseShowRingSearchParams", () => {
    it("returns only the default sort for empty params", () => {
        expect(parseShowRingSearchParams({})).toEqual({ sort: "newest" });
    });

    it("parses every supported filter", () => {
        const filters = parseShowRingSearchParams({
            q: "valegro",
            finish: "OF",
            maker: "Breyer",
            scale: "Traditional",
            trade: "For Sale",
            sort: "oldest",
        });
        expect(filters).toEqual({
            q: "valegro",
            finish: "OF",
            maker: "Breyer",
            scale: "Traditional",
            trade: "For Sale",
            sort: "oldest",
        });
    });

    it("drops unknown enum values instead of trusting them", () => {
        const filters = parseShowRingSearchParams({
            finish: "Chrome",
            trade: "Stolen/Missing",
            sort: "priciest",
        });
        expect(filters).toEqual({ sort: "newest" });
    });

    it("offers only honest sorts — the fake most-favorited is gone", () => {
        // The legacy dropdown offered "most-favorited" but the server
        // silently sorted by newest. It must neither parse…
        expect(parseShowRingSearchParams({ sort: "most-favorited" })).toEqual({ sort: "newest" });
        // …nor be in the vocabulary the sort dropdown renders from.
        expect(SHOWRING_SORTS).not.toContain("most-favorited");
    });

    it("takes the first value of an array param", () => {
        expect(parseShowRingSearchParams({ q: ["a", "b"] }).q).toBe("a");
    });

    it("trims and length-caps the search query", () => {
        const filters = parseShowRingSearchParams({ q: `  ${"x".repeat(300)}  ` });
        expect(filters.q).toHaveLength(100);
    });

    it("treats whitespace-only values as absent", () => {
        expect(parseShowRingSearchParams({ q: "   ", maker: " " })).toEqual({ sort: "newest" });
    });
});

describe("buildShowRingSearchParams", () => {
    it("omits defaults so the pristine URL stays clean", () => {
        expect(buildShowRingSearchParams({ sort: "newest" }).toString()).toBe("");
    });

    it("serializes active filters", () => {
        const qs = buildShowRingSearchParams({
            finish: "OF",
            maker: "Breyer",
            trade: "For Sale",
            sort: "oldest",
        }).toString();
        expect(qs).toContain("finish=OF");
        expect(qs).toContain("maker=Breyer");
        expect(qs).toContain("trade=For+Sale");
        expect(qs).toContain("sort=oldest");
    });

    it("round-trips through parse", () => {
        const filters = parseShowRingSearchParams({
            q: "chic",
            finish: "Custom",
            scale: "Stablemate",
            trade: "Open to Offers",
            sort: "oldest",
        });
        const qs = buildShowRingSearchParams(filters);
        const back = parseShowRingSearchParams(Object.fromEntries(qs.entries()));
        expect(back).toEqual(filters);
    });
});

describe("activeShowRingChips", () => {
    it("returns no chips for pristine filters", () => {
        expect(activeShowRingChips({ sort: "newest" })).toEqual([]);
        expect(countActiveShowRingFilters({ sort: "newest" })).toBe(0);
    });

    it("sort is a view preference, never a chip", () => {
        expect(activeShowRingChips({ sort: "oldest" })).toEqual([]);
    });

    it("builds one chip per active filter", () => {
        const chips = activeShowRingChips({
            q: "chic",
            finish: "OF",
            maker: "Breyer",
            scale: "Classic",
            trade: "For Sale",
            sort: "newest",
        });
        expect(chips.map((c) => c.key)).toEqual(["q", "finish", "maker", "scale", "trade"]);
        expect(chips.find((c) => c.key === "q")?.label).toBe("“chic”");
    });
});

describe("removeShowRingFilter / clearAllShowRingFilters", () => {
    it("removes exactly one filter", () => {
        const next = removeShowRingFilter({ finish: "OF", maker: "Breyer", sort: "oldest" }, "finish");
        expect(next).toEqual({ maker: "Breyer", sort: "oldest" });
    });

    it("clear-all keeps the sort preference", () => {
        expect(
            clearAllShowRingFilters({ q: "x", finish: "OF", trade: "For Sale", sort: "oldest" }),
        ).toEqual({ sort: "oldest" });
    });
});
