import { describe, it, expect } from "vitest";
import { getShowRingPageSchema, showRingFiltersSchema } from "@/lib/showring/schemas";

describe("showRingFiltersSchema", () => {
    it("accepts a full valid filter set and defaults the sort", () => {
        const parsed = showRingFiltersSchema.parse({
            q: "valegro",
            finish: "Artist Resin",
            maker: "Stone",
            scale: "Traditional",
            trade: "Open to Offers",
        });
        expect(parsed.sort).toBe("newest");
        expect(parsed.maker).toBe("Stone");
    });

    it("rejects out-of-vocabulary finish values", () => {
        expect(showRingFiltersSchema.safeParse({ finish: "Chrome" }).success).toBe(false);
    });

    it("rejects trade statuses outside the marketplace pair", () => {
        expect(showRingFiltersSchema.safeParse({ trade: "Stolen/Missing" }).success).toBe(false);
        expect(showRingFiltersSchema.safeParse({ trade: "Not for Sale" }).success).toBe(false);
    });

    it("rejects the fake most-favorited sort (honest sorts only)", () => {
        expect(showRingFiltersSchema.safeParse({ sort: "most-favorited" }).success).toBe(false);
        expect(showRingFiltersSchema.safeParse({ sort: "oldest" }).success).toBe(true);
    });

    it("length-caps q, maker, and scale", () => {
        expect(showRingFiltersSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
        expect(showRingFiltersSchema.safeParse({ maker: "x".repeat(81) }).success).toBe(false);
        expect(showRingFiltersSchema.safeParse({ scale: "x".repeat(41) }).success).toBe(false);
    });

    it("rejects empty-string maker/scale (absent means not filtered)", () => {
        expect(showRingFiltersSchema.safeParse({ maker: "" }).success).toBe(false);
    });
});

describe("getShowRingPageSchema", () => {
    it("defaults offset 0 and the 24-card page size", () => {
        const parsed = getShowRingPageSchema.parse({});
        expect(parsed.offset).toBe(0);
        expect(parsed.limit).toBe(24);
    });

    it("caps the page size at 24", () => {
        expect(getShowRingPageSchema.safeParse({ limit: 25 }).success).toBe(false);
    });

    it("rejects negative offsets", () => {
        expect(getShowRingPageSchema.safeParse({ offset: -1 }).success).toBe(false);
    });
});
