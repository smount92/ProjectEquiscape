import { describe, it, expect } from "vitest";
import { OTHER, tallyHerd, topBuckets, UNKNOWN, windowCounts, type Bucket } from "@/lib/metrics/herd";

describe("tallyHerd", () => {
    it("counts makers, finishes, sex and colour, owner-set before registry", () => {
        const t = tallyHerd([
            { finish_type: "OF", assigned_gender: "Mare", catalog_id: "c1", catalog_items: { maker: "Breyer", scale: "Traditional (1:9)", attributes: { gender: "Stallion", color_description: "Bay" } } },
            { finish_type: "OF", catalog_id: "c2", catalog_items: { maker: "breyer", scale: "Traditional (1:9)", attributes: { gender: "Gelding", color_description: "Bay" } } },
            { finish_type: "CM", color: "Grey", catalog_items: null },
        ]);
        expect(t.total).toBe(3);
        expect(t.linked).toBe(2);
        expect(t.byMaker).toEqual([{ label: "Breyer", count: 2 }, { label: UNKNOWN, count: 1 }]);
        expect(t.byFinish).toEqual([{ label: "OF", count: 2 }, { label: "CM", count: 1 }]);
        expect(t.byGender).toEqual([{ label: "Gelding", count: 1 }, { label: "Mare", count: 1 }, { label: UNKNOWN, count: 1 }]);
        expect(t.byColor).toEqual([{ label: "Bay", count: 2 }, { label: "Grey", count: 1 }]);
    });

    it("folds the long tail into Other and keeps Unknown last", () => {
        const map = new Map<string, Bucket>([
            ["a", { label: "A", count: 5 }],
            ["b", { label: "B", count: 4 }],
            ["c", { label: "C", count: 1 }],
            ["d", { label: "D", count: 1 }],
            [UNKNOWN.toLowerCase(), { label: UNKNOWN, count: 9 }],
        ]);
        expect(topBuckets(map, 2)).toEqual([
            { label: "A", count: 5 },
            { label: "B", count: 4 },
            { label: OTHER, count: 2 },
            { label: UNKNOWN, count: 9 },
        ]);
    });

    it("never names a horse or owner", () => {
        const keys = Object.keys(tallyHerd([{ finish_type: "OF" }]));
        expect(keys.some((k) => /name|owner|id$/i.test(k))).toBe(false);
    });
});

describe("windowCounts", () => {
    it("counts stamps inside 7, 30 and 90 trailing days", () => {
        const now = new Date("2026-10-10T12:00:00Z");
        const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
        const counts = windowCounts([day(1), day(8), day(29), day(45), day(100), null, "garbage"], [7, 30, 90], now);
        expect(counts).toEqual({ 7: 1, 30: 3, 90: 4 });
    });
});
