import { describe, expect, it } from "vitest";
import {
    computeRevenue,
    isMissingRevenueSchema,
    normalizeSubscriptionStatus,
    NET_MONTHLY_PRICE,
} from "../revenue";

describe("NET_MONTHLY_PRICE", () => {
    it("is list price less Stripe's 2.9% + $0.30", () => {
        expect(NET_MONTHLY_PRICE.pro).toBeCloseTo(5 - 5 * 0.029 - 0.3, 5);
        expect(NET_MONTHLY_PRICE.studio).toBeCloseTo(10 - 10 * 0.029 - 0.3, 5);
    });
});

describe("computeRevenue", () => {
    it("is all zeroes with nothing to count", () => {
        for (const input of [[], null, undefined]) {
            const summary = computeRevenue(input);
            expect(summary.mrr).toBe(0);
            expect(summary.payingTotal).toBe(0);
            expect(summary.atRiskTotal).toBe(0);
            expect(summary.lapsedTotal).toBe(0);
            // Both paid tiers are always present, so the console never
            // has to decide what a missing row means.
            expect(summary.tiers.map((t) => t.tier)).toEqual(["pro", "studio"]);
        }
    });

    it("multiplies subscribers by the net price", () => {
        const summary = computeRevenue([
            { tier: "pro", status: "active", subscribers: 3 },
            { tier: "studio", status: "active", subscribers: 2 },
        ]);
        // Each tier is rounded to cents FIRST, then summed — so the total
        // always equals the two per-tier figures printed beside it on the
        // card. (3 x 4.555 = 13.665 → 13.67; 2 x 9.41 = 18.82.) Summing
        // the raw floats would give 32.485 and a card that does not add up.
        expect(summary.mrr).toBe(32.49);
        expect(summary.tiers.find((t) => t.tier === "pro")?.mrr).toBe(13.67);
        expect(summary.tiers.find((t) => t.tier === "studio")?.mrr).toBe(18.82);
        expect(summary.payingTotal).toBe(5);
    });

    it("rounds MRR to whole cents", () => {
        // 3 x 4.555 = 13.664999… in float; the card must not show that.
        const summary = computeRevenue([{ tier: "pro", status: "active", subscribers: 3 }]);
        expect(summary.mrr).toBe(13.67);
        expect(Number.isInteger(summary.mrr * 100)).toBe(true);
    });

    it("counts trialing as paying and past_due as at risk", () => {
        const summary = computeRevenue([
            { tier: "pro", status: "trialing", subscribers: 1 },
            { tier: "pro", status: "past_due", subscribers: 2 },
            { tier: "studio", status: "unpaid", subscribers: 1 },
        ]);
        expect(summary.payingTotal).toBe(1);
        expect(summary.atRiskTotal).toBe(3);
        // At-risk subscriptions are NOT revenue — the money stopped.
        expect(summary.mrr).toBe(4.56);
    });

    it("treats a downgraded row as lapsed, never as revenue", () => {
        const summary = computeRevenue([
            { tier: "free", status: "canceled", subscribers: 7 },
            { tier: "free", status: "active", subscribers: 1 },
        ]);
        expect(summary.mrr).toBe(0);
        expect(summary.lapsedTotal).toBe(8);
    });

    it("counts a canceled row still carrying a paid tier as lapsed", () => {
        const summary = computeRevenue([{ tier: "pro", status: "canceled", subscribers: 4 }]);
        expect(summary.mrr).toBe(0);
        expect(summary.payingTotal).toBe(0);
        expect(summary.lapsedTotal).toBe(4);
    });

    it("ignores tiers and statuses it has never heard of", () => {
        const summary = computeRevenue([
            { tier: "platinum", status: "active", subscribers: 100 },
            { tier: "pro", status: "quantum_superposition", subscribers: 50 },
        ]);
        expect(summary.mrr).toBe(0);
        expect(summary.payingTotal).toBe(0);
        // The unknown STATUS on a known paid tier is still a real row of
        // people, so it lands in lapsed rather than vanishing.
        expect(summary.lapsedTotal).toBe(50);
    });

    it("refuses negative and non-numeric subscriber counts", () => {
        const summary = computeRevenue([
            { tier: "pro", status: "active", subscribers: -5 },
            { tier: "studio", status: "active", subscribers: Number.NaN },
        ]);
        expect(summary.mrr).toBe(0);
        expect(summary.payingTotal).toBe(0);
    });

    it("sums buckets that share a tier", () => {
        const summary = computeRevenue([
            { tier: "pro", status: "active", subscribers: 2 },
            { tier: "pro", status: "trialing", subscribers: 1 },
        ]);
        expect(summary.tiers.find((t) => t.tier === "pro")?.paying).toBe(3);
    });
});

describe("normalizeSubscriptionStatus", () => {
    it("passes Stripe's own vocabulary through untouched", () => {
        for (const status of ["active", "trialing", "past_due", "canceled", "paused"]) {
            expect(normalizeSubscriptionStatus(status, true)).toBe(status);
        }
    });

    it("falls back to the caller's entitlement reading for anything else", () => {
        // A status the column's CHECK would reject must never be sent.
        expect(normalizeSubscriptionStatus("brand_new_stripe_status", true)).toBe("active");
        expect(normalizeSubscriptionStatus("brand_new_stripe_status", false)).toBe("canceled");
        expect(normalizeSubscriptionStatus(undefined, false)).toBe("canceled");
        expect(normalizeSubscriptionStatus(null, true)).toBe("active");
    });
});

describe("isMissingRevenueSchema", () => {
    it("recognises every shape of 'migration 176 is not pasted yet'", () => {
        for (const code of ["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]) {
            expect(isMissingRevenueSchema({ code })).toBe(true);
        }
        expect(
            isMissingRevenueSchema({ message: 'column users.last_seen_on does not exist' }),
        ).toBe(true);
        expect(
            isMissingRevenueSchema({ message: "Could not find the function in the schema cache" }),
        ).toBe(true);
    });

    it("does not swallow a real failure", () => {
        expect(isMissingRevenueSchema(null)).toBe(false);
        expect(isMissingRevenueSchema(undefined)).toBe(false);
        expect(isMissingRevenueSchema({ code: "42501", message: "permission denied" })).toBe(false);
        expect(isMissingRevenueSchema({ code: "23503", message: "foreign key violation" })).toBe(
            false,
        );
    });
});
