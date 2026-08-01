import { describe, it, expect } from "vitest";
import { groupMakerCounts, countByParent } from "../makerHub";

describe("groupMakerCounts", () => {
    it("groups rows into one summary per slug with counts", () => {
        const rows = [
            { maker: "Breyer", maker_slug: "breyer" },
            { maker: "Breyer", maker_slug: "breyer" },
            { maker: "Peter Stone", maker_slug: "peter-stone" },
        ];
        expect(groupMakerCounts(rows)).toEqual([
            { maker: "Breyer", makerSlug: "breyer", count: 2 },
            { maker: "Peter Stone", makerSlug: "peter-stone", count: 1 },
        ]);
    });

    it("sorts by count desc, ties alphabetical by name", () => {
        const rows = [
            { maker: "Copperfox", maker_slug: "copperfox" },
            { maker: "Breyer", maker_slug: "breyer" },
            { maker: "Peter Stone", maker_slug: "peter-stone" },
            { maker: "Peter Stone", maker_slug: "peter-stone" },
        ];
        const grouped = groupMakerCounts(rows);
        expect(grouped.map((g) => g.maker)).toEqual(["Peter Stone", "Breyer", "Copperfox"]);
    });

    it("drops rows missing maker or maker_slug", () => {
        const rows = [
            { maker: null, maker_slug: "mystery" },
            { maker: "Nameless", maker_slug: null },
            { maker: "", maker_slug: "empty" },
            { maker: "Breyer", maker_slug: "breyer" },
        ];
        expect(groupMakerCounts(rows)).toEqual([{ maker: "Breyer", makerSlug: "breyer", count: 1 }]);
    });

    it("picks the most frequent display spelling per slug", () => {
        const rows = [
            { maker: "BREYER", maker_slug: "breyer" },
            { maker: "Breyer", maker_slug: "breyer" },
            { maker: "Breyer", maker_slug: "breyer" },
        ];
        expect(groupMakerCounts(rows)).toEqual([{ maker: "Breyer", makerSlug: "breyer", count: 3 }]);
    });

    it("returns empty for no rows", () => {
        expect(groupMakerCounts([])).toEqual([]);
    });
});

describe("countByParent", () => {
    it("counts children per parent id", () => {
        const counts = countByParent(["a", "b", "a", "a"]);
        expect(counts.get("a")).toBe(3);
        expect(counts.get("b")).toBe(1);
    });

    it("ignores null/undefined parents", () => {
        const counts = countByParent([null, undefined, "a"]);
        expect(counts.size).toBe(1);
        expect(counts.get("a")).toBe(1);
    });

    it("returns an empty map for no rows", () => {
        expect(countByParent([]).size).toBe(0);
    });
});
