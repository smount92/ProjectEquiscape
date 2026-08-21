import { describe, it, expect } from "vitest";
import {
    DEFAULT_TERMS,
    coerceTerms,
    depositFor,
    formatMoney,
    killFeeFor,
    snapshotTerms,
    termsLines,
    turnaroundLabel,
} from "@/lib/studio/terms";
import {
    coerceServices,
    priceRangeLabel,
    serviceTypesOffered,
    studioPriceRange,
} from "@/lib/studio/services";

describe("coerceTerms", () => {
    it("returns the defaults for anything unusable", () => {
        // This is the feature-detection seam: before migration 170 the
        // columns do not exist, and every studio must still render.
        expect(coerceTerms(null)).toEqual(DEFAULT_TERMS);
        expect(coerceTerms(undefined)).toEqual(DEFAULT_TERMS);
        expect(coerceTerms("nonsense")).toEqual(DEFAULT_TERMS);
        expect(coerceTerms(42)).toEqual(DEFAULT_TERMS);
        expect(coerceTerms({})).toEqual(DEFAULT_TERMS);
    });

    it("reads both camelCase and snake_case, so DB rows and forms both work", () => {
        expect(coerceTerms({ deposit_percent: 30 }).depositPercent).toBe(30);
        expect(coerceTerms({ depositPercent: 30 }).depositPercent).toBe(30);
        expect(coerceTerms({ kill_fee_percent: 25 }).killFeePercent).toBe(25);
    });

    it("clamps percentages into range instead of trusting them", () => {
        expect(coerceTerms({ depositPercent: 250 }).depositPercent).toBe(100);
        expect(coerceTerms({ depositPercent: -10 }).depositPercent).toBe(0);
        expect(coerceTerms({ killFeePercent: 1000 }).killFeePercent).toBe(100);
    });

    it("keeps an explicit false rather than falling back to the default true", () => {
        expect(coerceTerms({ depositRefundableBeforeStart: false }).depositRefundableBeforeStart)
            .toBe(false);
        expect(coerceTerms({ clientShipsModel: false }).clientShipsModel).toBe(false);
    });

    it("preserves a deliberate zero-revision policy", () => {
        expect(coerceTerms({ revisionsIncluded: 0 }).revisionsIncluded).toBe(0);
    });

    it("carries a v1 terms_text blob forward as the free-text addendum", () => {
        expect(coerceTerms({ terms_text: "No rush orders, ever." }).extraNote)
            .toBe("No rush orders, ever.");
    });

    it("rejects nonsense turnarounds rather than rendering them", () => {
        expect(coerceTerms({ turnaroundMinDays: 0 }).turnaroundMinDays).toBeNull();
        expect(coerceTerms({ turnaroundMinDays: -5 }).turnaroundMinDays).toBeNull();
        expect(coerceTerms({ turnaroundMaxDays: "abc" }).turnaroundMaxDays).toBeNull();
    });
});

describe("depositFor / killFeeFor", () => {
    it("computes the deposit implied by a price and a percentage", () => {
        expect(depositFor(800, 50)).toBe(400);
        expect(depositFor(999, 30)).toBe(299.7);
    });

    it("returns nothing when there is no price or no policy", () => {
        expect(depositFor(null, 50)).toBeNull();
        expect(depositFor(0, 50)).toBeNull();
        expect(depositFor(800, 0)).toBeNull();
    });

    it("prices a kill fee off the agreed total", () => {
        expect(killFeeFor(1200, 50)).toBe(600);
    });
});

describe("snapshotTerms", () => {
    it("freezes the terms, the price and the implied deposit together", () => {
        const at = new Date("2026-08-19T12:00:00Z");
        const snap = snapshotTerms({ ...DEFAULT_TERMS, depositPercent: 40 }, 500, at);
        expect(snap.agreedPrice).toBe(500);
        expect(snap.depositPercent).toBe(40);
        expect(snap.depositAmount).toBe(200);
        expect(snap.snapshotAt).toBe(at.toISOString());
    });

    it("does not change when the studio's live terms change afterwards", () => {
        // The whole point of the snapshot: the artist may edit their
        // terms later, the agreement keeps the ones that were agreed.
        const live = { ...DEFAULT_TERMS, revisionsIncluded: 3 };
        const snap = snapshotTerms(live, 600);
        live.revisionsIncluded = 0;
        expect(snap.revisionsIncluded).toBe(3);
    });

    it("survives a commission with no agreed price", () => {
        const snap = snapshotTerms(DEFAULT_TERMS, null);
        expect(snap.agreedPrice).toBeNull();
        expect(snap.depositAmount).toBeNull();
    });
});

describe("termsLines", () => {
    it("always produces a line for each term that matters", () => {
        const labels = termsLines(DEFAULT_TERMS).map((l) => l.label);
        expect(labels).toContain("Deposit");
        expect(labels).toContain("Revisions");
        expect(labels).toContain("If cancelled");
        expect(labels).toContain("Rush orders");
        expect(labels).toContain("Shipping");
    });

    it("says 'no deposit' rather than '0%'", () => {
        const line = termsLines({ ...DEFAULT_TERMS, depositPercent: 0 })
            .find((l) => l.label === "Deposit");
        expect(line?.value).toBe("No deposit required");
    });

    it("distinguishes a refundable deposit from a non-refundable one", () => {
        const refundable = termsLines(DEFAULT_TERMS).find((l) => l.label === "Deposit");
        const not = termsLines({ ...DEFAULT_TERMS, depositRefundableBeforeStart: false })
            .find((l) => l.label === "Deposit");
        expect(refundable?.value).toMatch(/refundable until work begins/);
        expect(not?.value).toMatch(/non-refundable/);
    });

    it("names the extra-revision fee when there is one", () => {
        const line = termsLines({ ...DEFAULT_TERMS, extraRevisionFee: 75 })
            .find((l) => l.label === "Revisions");
        expect(line?.value).toContain("$75");
    });

    it("omits turnaround entirely when the artist has not stated one", () => {
        const labels = termsLines(DEFAULT_TERMS).map((l) => l.label);
        expect(labels).not.toContain("Turnaround");
    });
});

describe("turnaroundLabel", () => {
    it("quotes long jobs in months, the way the hobby does", () => {
        expect(turnaroundLabel({ turnaroundMinDays: 30, turnaroundMaxDays: 120 }))
            .toBe("1–4 months");
    });

    it("uses weeks and days for shorter work", () => {
        expect(turnaroundLabel({ turnaroundMinDays: 3, turnaroundMaxDays: 10 }))
            .toBe("3 days – 10 days");
        expect(turnaroundLabel({ turnaroundMinDays: null, turnaroundMaxDays: 21 }))
            .toBe("Up to 3 weeks");
    });

    it("says so plainly when nothing is stated", () => {
        expect(turnaroundLabel({ turnaroundMinDays: null, turnaroundMaxDays: null }))
            .toBe("Not stated");
    });
});

describe("formatMoney", () => {
    it("drops cents when there are none and keeps them when there are", () => {
        expect(formatMoney(1200)).toBe("$1,200");
        expect(formatMoney(299.7)).toBe("$299.70");
    });

    it("renders a missing amount as a dash, never as $0", () => {
        expect(formatMoney(null)).toBe("—");
        expect(formatMoney(undefined)).toBe("—");
        expect(formatMoney(NaN)).toBe("—");
    });
});

describe("coerceServices", () => {
    it("returns nothing for anything that is not a list", () => {
        expect(coerceServices(null)).toEqual([]);
        expect(coerceServices({})).toEqual([]);
        expect(coerceServices("[]")).toEqual([]);
    });

    it("drops entries with no work type rather than rendering blanks", () => {
        expect(coerceServices([{ scale: "Traditional", priceMin: 500 }, { type: "Prep work" }]))
            .toHaveLength(1);
    });

    it("defaults an unspecified scale and treats services as open", () => {
        const [s] = coerceServices([{ type: "Prep work" }]);
        expect(s.scale).toBe("Any scale");
        expect(s.open).toBe(true);
    });

    it("honours a service the artist has closed", () => {
        expect(coerceServices([{ type: "Custom (sculpting)", open: false }])[0].open).toBe(false);
    });

    it("reads a backwards price range the way it was obviously meant", () => {
        const [s] = coerceServices([{ type: "Finishwork (repaint)", priceMin: 800, priceMax: 200 }]);
        expect(s.priceMin).toBe(200);
        expect(s.priceMax).toBe(800);
    });
});

describe("priceRangeLabel", () => {
    it("renders the shapes a rate card actually takes", () => {
        expect(priceRangeLabel(500, 1200)).toBe("$500 – $1,200");
        expect(priceRangeLabel(150, null)).toBe("From $150");
        expect(priceRangeLabel(null, 600)).toBe("Up to $600");
        expect(priceRangeLabel(400, 400)).toBe("$400");
        expect(priceRangeLabel(null, null)).toBe("Ask");
    });
});

describe("studioPriceRange", () => {
    it("derives the studio range from the services, so they cannot disagree", () => {
        const services = coerceServices([
            { type: "Prep work", scale: "Traditional", priceMin: 45, priceMax: 150 },
            { type: "Finishwork (repaint)", scale: "Traditional", priceMin: 600, priceMax: 1200 },
        ]);
        const range = studioPriceRange(services);
        expect(range.min).toBe(45);
        expect(range.max).toBe(1200);
        expect(range.label).toBe("$45 – $1,200");
    });

    it("reports nothing rather than zero when no service is priced", () => {
        const range = studioPriceRange(coerceServices([{ type: "Tack making" }]));
        expect(range.min).toBeNull();
        expect(range.label).toBe("Ask");
    });
});

describe("serviceTypesOffered", () => {
    it("lists distinct open work types for the directory filter", () => {
        const services = coerceServices([
            { type: "Prep work", scale: "Traditional" },
            { type: "Prep work", scale: "Classic" },
            { type: "Custom (sculpting)", open: false },
        ]);
        expect(serviceTypesOffered(services)).toEqual(["Prep work"]);
    });
});
