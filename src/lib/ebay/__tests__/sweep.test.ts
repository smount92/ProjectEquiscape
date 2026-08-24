import { describe, it, expect, vi } from "vitest";
import { MIN_SAMPLE, median, summarise, sweep, type SweepTarget } from "@/lib/ebay/sweep";
import type { EbayListing } from "@/lib/ebay/client";

const TARGETS: SweepTarget[] = [
    { id: "alborozo", title: "Alborozo", maker: "Breyer", modelNumber: "712053", scale: "Traditional (1:9)" },
    { id: "notorious", title: "Notoriously Framed", maker: "Breyer", modelNumber: "712393", scale: "Traditional (1:9)" },
];

const listing = (price: number, title = "Breyer Alborozo 712053", over: Partial<EbayListing> = {}): EbayListing => ({
    itemId: `v1|${price}|0`, title, price, currency: "USD",
    condition: "Used", itemWebUrl: `https://ebay.com/itm/${price}`, itemAffiliateWebUrl: null, ...over,
});

describe("median", () => {
    it("handles odd and even counts", () => {
        expect(median([10, 20, 30])).toBe(20);
        expect(median([10, 20, 30, 40])).toBe(25);
    });
    it("is 0 for nothing, rather than NaN", () => {
        expect(median([])).toBe(0);
    });
});

describe("summarise", () => {
    it("builds a signal from enough listings", () => {
        const s = summarise("alborozo", [listing(100), listing(200), listing(300)], "model-number-and-maker");
        expect(s).toMatchObject({ askingLow: 100, askingMedian: 200, askingHigh: 300, sampleSize: 3 });
    });

    // One person's asking price is not a market reading.
    it("refuses a sample below the floor", () => {
        expect(summarise("alborozo", [listing(100)], "b")).toBeNull();
        expect(summarise("alborozo", [listing(100), listing(200)], "b")).toBeNull();
        expect(MIN_SAMPLE).toBe(3);
    });

    it("drops a foreign currency rather than averaging across rates we do not have", () => {
        const s = summarise("alborozo", [
            listing(100), listing(200), listing(300),
            listing(90, "Breyer Alborozo 712053", { currency: "GBP" }),
        ], "b");
        expect(s?.sampleSize).toBe(3);
        expect(s?.currency).toBe("USD");
    });

    it("returns null for no listings", () => {
        expect(summarise("alborozo", [], "b")).toBeNull();
    });
});

describe("sweep", () => {
    it("produces a signal per model from matching listings", async () => {
        const search = vi.fn(async () => [listing(100), listing(200), listing(300)]);
        const out = await sweep([TARGETS[0]], { search });
        expect(out.signals).toHaveLength(1);
        expect(out.signals[0]).toMatchObject({ catalogItemId: "alborozo", askingMedian: 200 });
        expect(out.searched).toBe(1);
    });

    // Search is fuzzy; matching is not. eBay happily returns a different
    // model for a model's own query.
    it("discards a listing that matches a DIFFERENT model than the one searched", async () => {
        const search = vi.fn(async () => [
            listing(100),
            listing(150, "Breyer Notoriously Framed 712393"),
            listing(200),
            listing(300),
        ]);
        const out = await sweep([TARGETS[0]], { search });
        expect(out.signals[0].sampleSize).toBe(3);
        expect(out.signals[0].askingMedian).toBe(200);
    });

    it("counts why listings were rejected instead of discarding the reason", async () => {
        const search = vi.fn(async () => [
            listing(100, "Breyer Alborozo 712053 CUSTOM repaint"),
            listing(120, "Lot of 4 Breyer horses 712053"),
            listing(140, "Breyer Traditional horse no number"),
        ]);
        const out = await sweep([TARGETS[0]], { search });
        expect(out.signals).toHaveLength(0);
        expect(out.rejections["not-the-original-model"]).toBe(1);
        expect(out.rejections["multi-item-lot"]).toBe(1);
        expect(out.rejections["no-model-number-in-listing"]).toBe(1);
    });

    it("records a below-floor sample as its own outcome, not a match failure", async () => {
        const search = vi.fn(async () => [listing(100), listing(200)]);
        const out = await sweep([TARGETS[0]], { search });
        expect(out.signals).toHaveLength(0);
        expect(out.rejections["below-min-sample"]).toBe(1);
    });

    it("keeps going after one model errors", async () => {
        const search = vi.fn()
            .mockRejectedValueOnce(new Error("eBay search failed (500)"))
            .mockResolvedValueOnce([
                listing(50, "Breyer Notoriously Framed 712393"),
                listing(60, "Breyer Notoriously Framed 712393"),
                listing(70, "Breyer Notoriously Framed 712393"),
            ]);
        const out = await sweep(TARGETS, { search });
        expect(out.errors).toHaveLength(1);
        expect(out.signals.map((s) => s.catalogItemId)).toEqual(["notorious"]);
    });

    // Every later call would fail identically; stopping keeps the partial
    // results instead of burning the slice on the same error.
    it("stops the whole run on a rate limit", async () => {
        const search = vi.fn().mockRejectedValue(new Error("eBay rate limit reached"));
        const out = await sweep(TARGETS, { search });
        expect(search).toHaveBeenCalledTimes(1);
        expect(out.errors).toHaveLength(1);
    });

    it("skips a target with no model number without calling eBay", async () => {
        const search = vi.fn(async () => []);
        const out = await sweep(
            [{ id: "x", title: "Mystery", maker: "Breyer", modelNumber: null, scale: null }],
            { search }
        );
        expect(search).not.toHaveBeenCalled();
        expect(out.signals).toHaveLength(0);
    });
});
