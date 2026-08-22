import { describe, it, expect, vi, afterEach } from "vitest";

import {
    MEMBERSHIP_TERMS,
    TERM_CURRENCY,
    fixedTermTotal,
    prepaidTermsEnabled,
    termByKey,
    termForPlanId,
    termPlanId,
    termsForTier,
} from "@/lib/billing/terms";

// ── The owner-editable catalogue ──
//
// config/membership-terms.json is the one file the owner edits, which
// makes it the one file a typo can reach. The rule this module holds is
// that a malformed row becomes "not for sale" rather than a 500 on the
// page where members go to pay — and, because checkout looks terms up in
// this same list, a dropped row genuinely cannot be bought.

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("the shipped catalogue", () => {
    it("offers three terms per tier", () => {
        expect(termsForTier("pro").map((t) => t.key)).toEqual(["pro-3", "pro-6", "pro-12"]);
        expect(termsForTier("studio").map((t) => t.key)).toEqual([
            "studio-3",
            "studio-6",
            "studio-12",
        ]);
    });

    it("prices every term as a two-decimal string, which is what PayPal wants", () => {
        for (const term of MEMBERSHIP_TERMS) {
            expect(term.prepaidPrice).toMatch(/^\d+\.\d{2}$/);
            expect(term.monthlyPrice).toMatch(/^\d+\.\d{2}$/);
        }
    });

    it("matches the owner's documented annual targets", () => {
        expect(termByKey("pro-12")?.prepaidPrice).toBe("50.00");
        expect(termByKey("studio-12")?.prepaidPrice).toBe("100.00");
    });

    it("never prices a longer term above a shorter one", () => {
        for (const tier of ["pro", "studio"] as const) {
            const prices = termsForTier(tier).map((t) => Number(t.prepaidPrice));
            const perMonth = termsForTier(tier).map((t) => Number(t.prepaidPrice) / t.months);
            expect(prices).toEqual([...prices].sort((a, b) => a - b));
            // Longer terms are never worse value per month.
            expect(perMonth).toEqual([...perMonth].sort((a, b) => b - a));
        }
    });

    it("sells in USD", () => {
        expect(TERM_CURRENCY).toBe("USD");
    });
});

describe("termByKey — the only door into a purchase", () => {
    it("finds a configured term", () => {
        expect(termByKey("pro-6")).toMatchObject({ tier: "pro", months: 6, prepaidPrice: "27.00" });
    });

    it("is null for anything not in the config", () => {
        expect(termByKey("pro-99")).toBeNull();
        expect(termByKey("")).toBeNull();
        expect(termByKey(null)).toBeNull();
        expect(termByKey(undefined)).toBeNull();
    });

    it("tolerates surrounding whitespace", () => {
        expect(termByKey("  pro-3  ")?.key).toBe("pro-3");
    });
});

describe("fixed-term plan ids — dark until the owner creates the plans", () => {
    it("is null while the env var is unset", () => {
        expect(termPlanId(termByKey("pro-3")!)).toBeNull();
    });

    it("resolves once the owner pastes the id", () => {
        vi.stubEnv("PAYPAL_PRO_3MO_PLAN_ID", "P-PRO-3MO");
        expect(termPlanId(termByKey("pro-3")!)).toBe("P-PRO-3MO");
        expect(termForPlanId("P-PRO-3MO")?.key).toBe("pro-3");
    });

    it("treats a blank env var as unset", () => {
        vi.stubEnv("PAYPAL_PRO_3MO_PLAN_ID", "   ");
        expect(termPlanId(termByKey("pro-3")!)).toBeNull();
    });

    // Refusing to guess is what stops a fixed-term plan being mistaken
    // for an open-ended one, and vice versa.
    it("is null for a plan id nobody configured", () => {
        expect(termForPlanId("P-WHO-KNOWS")).toBeNull();
        expect(termForPlanId(null)).toBeNull();
        expect(termForPlanId("")).toBeNull();
    });
});

describe("fixedTermTotal", () => {
    it("multiplies in whole cents, so it cannot drift", () => {
        expect(fixedTermTotal(termByKey("pro-6")!)).toBe("30.00");
        expect(fixedTermTotal(termByKey("pro-12")!)).toBe("60.00");
        expect(fixedTermTotal(termByKey("studio-12")!)).toBe("120.00");
    });

    // Spreading the cost is not the discounted option — the discount is
    // what you get for paying up front. This asserts the product
    // decision, so changing it has to be deliberate.
    it("costs more in total than prepaying, for every term of 6 months or more", () => {
        for (const term of MEMBERSHIP_TERMS.filter((t) => t.months >= 6)) {
            expect(Number(fixedTermTotal(term))).toBeGreaterThan(Number(term.prepaidPrice));
        }
    });
});

describe("prepaidTermsEnabled — only the literal 1", () => {
    it.each([
        ["1", true],
        ["0", false],
        ["true", false],
        ["", false],
        [undefined, false],
    ])("%s → %s", (value, expected) => {
        if (value === undefined) vi.stubEnv("NEXT_PUBLIC_PREPAID_TERMS", "");
        else vi.stubEnv("NEXT_PUBLIC_PREPAID_TERMS", value);
        expect(prepaidTermsEnabled()).toBe(expected);
    });
});
