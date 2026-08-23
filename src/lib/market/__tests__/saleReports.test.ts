import { describe, it, expect } from "vitest";
import {
    dropOutliers,
    marketplaceHost,
    MAX_AGE_DAYS,
    MIN_REPORTERS,
    MIN_REPORTS,
    summariseSales,
    validateSaleReport,
    type StoredReport,
} from "@/lib/market/saleReports";

/* ──────────────────────────────────────────────────────
   Member-reported sales.

   The threat these tests hold the line against is not spam — it is quiet
   price manipulation by someone with an interest in a model's value. So
   most of what follows checks that ONE motivated person cannot move a
   number on their own.
   ────────────────────────────────────────────────────── */

const NOW = new Date("2026-08-23T12:00:00Z");
const ok = {
    catalogItemId: "alborozo",
    sourceUrl: "https://www.ebay.com/itm/123456",
    price: 450,
    currency: "USD",
    soldOn: "2026-08-01",
};

describe("the source link", () => {
    it("accepts the marketplaces we can check", () => {
        expect(marketplaceHost("https://www.ebay.com/itm/1")).toBe("www.ebay.com");
        expect(marketplaceHost("https://modelhorsesalespages.com/x")).toBe("modelhorsesalespages.com");
        expect(marketplaceHost("https://www.etsy.com/listing/1")).toBe("www.etsy.com");
    });

    it("rejects anywhere we cannot", () => {
        expect(marketplaceHost("https://facebook.com/groups/1")).toBeNull();
        expect(marketplaceHost("https://my-own-site.example/receipt")).toBeNull();
    });

    it("rejects non-http schemes rather than trusting them", () => {
        expect(marketplaceHost("javascript:alert(1)")).toBeNull();
        expect(marketplaceHost("file:///etc/passwd")).toBeNull();
    });

    it("does not throw on nonsense", () => {
        expect(marketplaceHost("not a url")).toBeNull();
        expect(marketplaceHost("")).toBeNull();
    });
});

describe("validating one report", () => {
    it("accepts a well-formed report", () => {
        const out = validateSaleReport(ok, NOW);
        expect(out.ok).toBe(true);
        if (out.ok) {
            expect(out.report).toMatchObject({ price: 450, currency: "USD", host: "www.ebay.com" });
        }
    });

    it.each([
        ["missing catalog item", { ...ok, catalogItemId: null }, "missing-catalog-item"],
        ["missing url", { ...ok, sourceUrl: "" }, "missing-url"],
        ["a site we cannot check", { ...ok, sourceUrl: "https://facebook.com/x" }, "unsupported-marketplace"],
        ["not a url", { ...ok, sourceUrl: "i sold it to a friend" }, "malformed-url"],
        ["a non-numeric price", { ...ok, price: "four hundred" }, "price-not-a-number"],
        ["a zero price", { ...ok, price: 0 }, "price-out-of-range"],
        ["an absurd price", { ...ok, price: 250_000 }, "price-out-of-range"],
        ["a bad currency", { ...ok, currency: "dollars" }, "missing-currency"],
    ])("rejects %s", (_label, input, reason) => {
        const out = validateSaleReport(input as never, NOW);
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.reason).toBe(reason);
    });

    it("rejects a sale dated in the future", () => {
        const out = validateSaleReport({ ...ok, soldOn: "2027-01-01" }, NOW);
        expect(out.ok).toBe(false);
    });

    it("rejects a sale too old to be a current signal", () => {
        const old = new Date(NOW.getTime() - (MAX_AGE_DAYS + 30) * 86_400_000);
        const out = validateSaleReport({ ...ok, soldOn: old.toISOString() }, NOW);
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.reason).toBe("sold-date-too-old");
    });

    it("carries the self-reported declaration through", () => {
        const out = validateSaleReport({ ...ok, selfReported: true }, NOW);
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.report.selfReported).toBe(true);
    });
});

let saleSeq = 0;
const report = (over: Partial<StoredReport> = {}): StoredReport => ({
    reporterId: "member-1",
    // Distinct by default: each call is a different sale unless a test
    // deliberately shares a sourceUrl to mean "same listing".
    sourceUrl: `https://www.ebay.com/itm/${++saleSeq}`,
    price: 400, currency: "USD", selfReported: false, ...over,
});

describe("summarising into a sold price", () => {
    it("summarises when the evidence is there", () => {
        const s = summariseSales([
            report({ reporterId: "a", price: 400 }),
            report({ reporterId: "b", price: 450 }),
            report({ reporterId: "c", price: 500 }),
        ]);
        expect(s).toMatchObject({ low: 400, median: 450, high: 500, sampleSize: 3, reporterCount: 3 });
    });

    it("refuses fewer reports than the floor", () => {
        expect(summariseSales([report({ reporterId: "a" }), report({ reporterId: "b" })])).toBeNull();
        expect(MIN_REPORTS).toBe(3);
    });

    // The single most important rule here.
    it("refuses when one person filed every report", () => {
        const s = summariseSales([
            report({ reporterId: "solo", price: 400 }),
            report({ reporterId: "solo", price: 5000 }),
            report({ reporterId: "solo", price: 5200 }),
        ]);
        expect(s).toBeNull();
        expect(MIN_REPORTERS).toBe(2);
    });

    it("never prices from a seller's account of their own sale", () => {
        const s = summariseSales([
            report({ reporterId: "a", price: 9000, selfReported: true }),
            report({ reporterId: "b", price: 400 }),
            report({ reporterId: "c", price: 420 }),
        ]);
        // Only two usable reports remain, so there is no summary at all.
        expect(s).toBeNull();
    });

    it("keeps a self-reported sale out of an otherwise sufficient sample", () => {
        const s = summariseSales([
            report({ reporterId: "a", price: 400 }),
            report({ reporterId: "b", price: 420 }),
            report({ reporterId: "c", price: 440 }),
            report({ reporterId: "d", price: 9000, selfReported: true }),
        ]);
        expect(s?.sampleSize).toBe(3);
        expect(s?.high).toBe(440);
    });

    // Three witnesses to one transaction are not three transactions.
    // Without this, brigading a single listing would set a model's price
    // and would be easier than finding real evidence.
    it("counts one listing as one sale however many people report it", () => {
        const SAME = "https://www.ebay.com/itm/999";
        const s = summariseSales([
            report({ reporterId: "a", sourceUrl: SAME, price: 5000 }),
            report({ reporterId: "b", sourceUrl: SAME, price: 5000 }),
            report({ reporterId: "c", sourceUrl: SAME, price: 5000 }),
        ]);
        expect(s).toBeNull();
    });

    it("treats witnesses to the same sale as corroboration, not extra sales", () => {
        const SAME = "https://www.ebay.com/itm/777";
        const s = summariseSales([
            report({ reporterId: "a", sourceUrl: SAME, price: 400 }),
            report({ reporterId: "b", sourceUrl: SAME, price: 400 }),
            report({ reporterId: "c", price: 420 }),
            report({ reporterId: "d", price: 440 }),
        ]);
        // Three distinct sales: the shared listing plus two others.
        expect(s?.sampleSize).toBe(3);
        expect(s?.reporterCount).toBe(4);
    });

    it("takes the median when witnesses disagree about the figure", () => {
        const SAME = "https://www.ebay.com/itm/555";
        const s = summariseSales([
            report({ reporterId: "a", sourceUrl: SAME, price: 400 }),
            report({ reporterId: "b", sourceUrl: SAME, price: 500 }),
            report({ reporterId: "c", sourceUrl: SAME, price: 600 }),
            report({ reporterId: "d", price: 1000 }),
            report({ reporterId: "e", price: 1100 }),
        ]);
        // The contested sale resolves to 500, not 400 or 600.
        expect(s?.low).toBe(500);
        expect(s?.sampleSize).toBe(3);
    });

    it("matches URLs case-insensitively, so casing cannot fake a second sale", () => {
        const s = summariseSales([
            report({ reporterId: "a", sourceUrl: "https://www.ebay.com/itm/ABC", price: 400 }),
            report({ reporterId: "b", sourceUrl: "https://www.ebay.com/itm/abc", price: 400 }),
            report({ reporterId: "c", sourceUrl: "https://WWW.EBAY.COM/itm/abc", price: 400 }),
        ]);
        expect(s).toBeNull();
    });

    it("prices in the dominant currency, not whichever came first", () => {
        const s = summariseSales([
            report({ reporterId: "a", price: 300, currency: "GBP" }),
            report({ reporterId: "b", price: 400, currency: "USD" }),
            report({ reporterId: "c", price: 420, currency: "USD" }),
            report({ reporterId: "d", price: 440, currency: "USD" }),
        ]);
        expect(s?.sampleSize).toBe(3);
        expect(s?.low).toBe(400);
    });
});

describe("outlier rejection", () => {
    it("drops a figure far from the middle", () => {
        const kept = dropOutliers([400, 410, 420, 430, 30_000]);
        expect(kept).not.toContain(30_000);
        expect(kept).toHaveLength(4);
    });

    // Standard deviation would be inflated by the very value it is meant
    // to catch; median absolute deviation is not.
    it("catches an outlier that would survive a standard-deviation test", () => {
        const values = [400, 410, 420, 430, 30_000];
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
        // The outlier is inside 3 standard deviations — it would pass.
        expect(Math.abs(30_000 - mean) / sd).toBeLessThan(3);
        // MAD catches it anyway.
        expect(dropOutliers(values)).not.toContain(30_000);
    });

    it("leaves a small sample alone rather than guessing", () => {
        expect(dropOutliers([400, 9000, 410])).toHaveLength(3);
    });

    it("does not treat identical values as outliers", () => {
        expect(dropOutliers([400, 400, 400, 400])).toHaveLength(4);
    });

    it("reports how many it dropped instead of hiding it", () => {
        const s = summariseSales([
            report({ reporterId: "a", price: 400 }),
            report({ reporterId: "b", price: 410 }),
            report({ reporterId: "c", price: 420 }),
            report({ reporterId: "d", price: 430 }),
            report({ reporterId: "e", price: 30_000 }),
        ]);
        expect(s?.outliersDropped).toBe(1);
        expect(s?.high).toBe(430);
    });
});
