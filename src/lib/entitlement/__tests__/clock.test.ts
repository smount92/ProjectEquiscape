import { describe, it, expect } from "vitest";

import {
    addMonthsUtc,
    entitledTier,
    extendedPaidThrough,
    formatPaidThrough,
    hasUnparseablePaidThrough,
    isTermExpired,
    paidThroughMs,
    storedTier,
    PAID_THROUGH_KEY,
} from "@/lib/entitlement/clock";

// ── The entitlement clock ──
//
// This module decides whether every paying member on the site still has
// what they paid for, so the tests are weighted toward the two ways it
// could be catastrophically wrong:
//
//   1. reading "no expiry" as "expired" — which would cancel the entire
//      membership base, Stripe included, in one deploy;
//   2. reading "expired" as "still fine" — which would make a prepaid
//      term a permanent membership.
//
// Everything else is arithmetic, and the arithmetic is tested because a
// month is not 30 days.

const JAN_15 = Date.parse("2026-01-15T12:00:00.000Z");

describe("paidThroughMs — what counts as a clock", () => {
    it("reads a valid ISO instant", () => {
        expect(paidThroughMs({ [PAID_THROUGH_KEY]: "2026-06-01T00:00:00.000Z" })).toBe(
            Date.parse("2026-06-01T00:00:00.000Z"),
        );
    });

    // ── The one that matters ──
    it.each([
        ["absent", {}],
        ["null", { [PAID_THROUGH_KEY]: null }],
        ["undefined", { [PAID_THROUGH_KEY]: undefined }],
        ["empty", { [PAID_THROUGH_KEY]: "" }],
        ["blank", { [PAID_THROUGH_KEY]: "   " }],
        ["a number", { [PAID_THROUGH_KEY]: 1234567890 }],
        ["unparseable", { [PAID_THROUGH_KEY]: "next Tuesday" }],
        ["no metadata at all", null],
    ])("treats %s as no expiry, never as expired", (_label, metadata) => {
        expect(paidThroughMs(metadata as Record<string, unknown> | null)).toBeNull();
    });

    it("flags an unparseable date for a writer to shout about", () => {
        expect(hasUnparseablePaidThrough({ [PAID_THROUGH_KEY]: "banana" })).toBe(true);
        expect(hasUnparseablePaidThrough({ [PAID_THROUGH_KEY]: "2026-06-01T00:00:00Z" })).toBe(false);
        expect(hasUnparseablePaidThrough({})).toBe(false);
    });
});

describe("storedTier — the flag, before the clock", () => {
    it.each([
        ["pro", "pro"],
        ["studio", "studio"],
        ["free", "free"],
        ["nonsense", "free"],
        [undefined, "free"],
    ])("%s reads as %s", (input, expected) => {
        expect(storedTier({ tier: input })).toBe(expected);
    });
});

describe("entitledTier — READ-TIME EXPIRY", () => {
    it("a paid tier with no clock stands — this is every existing member", () => {
        expect(entitledTier({ tier: "pro" }, JAN_15)).toBe("pro");
        expect(entitledTier({ tier: "studio" }, JAN_15)).toBe("studio");
    });

    it("a tier whose term is still running stands", () => {
        expect(entitledTier({ tier: "pro", paid_through: "2026-03-01T00:00:00Z" }, JAN_15)).toBe("pro");
    });

    // ── The whole point of the feature ──
    it("a tier whose term has passed reads as free IMMEDIATELY, with no cron", () => {
        expect(entitledTier({ tier: "pro", paid_through: "2026-01-01T00:00:00Z" }, JAN_15)).toBe("free");
        expect(entitledTier({ tier: "studio", paid_through: "2026-01-14T23:59:59Z" }, JAN_15)).toBe(
            "free",
        );
    });

    it("expires exactly ON the boundary, not a moment after", () => {
        const at = "2026-01-15T12:00:00.000Z";
        expect(entitledTier({ tier: "pro", paid_through: at }, JAN_15)).toBe("free");
        expect(entitledTier({ tier: "pro", paid_through: at }, JAN_15 - 1)).toBe("pro");
    });

    it("keeps access when the date is garbled — our bug must not cost them their tier", () => {
        expect(entitledTier({ tier: "pro", paid_through: "not-a-date" }, JAN_15)).toBe("pro");
    });

    it("never promotes: a free tier with a future clock is still free", () => {
        expect(entitledTier({ tier: "free", paid_through: "2099-01-01T00:00:00Z" }, JAN_15)).toBe(
            "free",
        );
    });

    it("is free for an anonymous or metadata-less reader", () => {
        expect(entitledTier(null, JAN_15)).toBe("free");
        expect(entitledTier(undefined, JAN_15)).toBe("free");
        expect(entitledTier({}, JAN_15)).toBe("free");
    });

    it("isTermExpired agrees with it and is false whenever there is no clock", () => {
        expect(isTermExpired({ tier: "pro" }, JAN_15)).toBe(false);
        expect(isTermExpired({ paid_through: "2026-01-01T00:00:00Z" }, JAN_15)).toBe(true);
        expect(isTermExpired({ paid_through: "2026-02-01T00:00:00Z" }, JAN_15)).toBe(false);
    });
});

describe("addMonthsUtc — a month is not thirty days", () => {
    it("adds whole calendar months", () => {
        expect(new Date(addMonthsUtc(Date.parse("2026-01-15T12:00:00Z"), 3)).toISOString()).toBe(
            "2026-04-15T12:00:00.000Z",
        );
        expect(new Date(addMonthsUtc(Date.parse("2026-01-15T12:00:00Z"), 12)).toISOString()).toBe(
            "2027-01-15T12:00:00.000Z",
        );
    });

    // Without clamping, setUTCMonth rolls 31 January into 3 March and
    // quietly hands out three extra days.
    it("clamps to the end of a shorter month instead of rolling over", () => {
        expect(new Date(addMonthsUtc(Date.parse("2026-01-31T00:00:00Z"), 1)).toISOString()).toBe(
            "2026-02-28T00:00:00.000Z",
        );
        expect(new Date(addMonthsUtc(Date.parse("2026-08-31T00:00:00Z"), 1)).toISOString()).toBe(
            "2026-09-30T00:00:00.000Z",
        );
    });

    it("lands on 29 February in a leap year", () => {
        expect(new Date(addMonthsUtc(Date.parse("2028-01-31T00:00:00Z"), 1)).toISOString()).toBe(
            "2028-02-29T00:00:00.000Z",
        );
    });

    it("keeps the time of day", () => {
        expect(new Date(addMonthsUtc(Date.parse("2026-03-10T07:45:31Z"), 6)).toISOString()).toBe(
            "2026-09-10T07:45:31.000Z",
        );
    });

    it("crosses a year boundary", () => {
        expect(new Date(addMonthsUtc(Date.parse("2026-11-30T00:00:00Z"), 3)).toISOString()).toBe(
            "2027-02-28T00:00:00.000Z",
        );
    });
});

describe("extendedPaidThrough — STACKING", () => {
    it("starts from now when there is no term yet", () => {
        expect(extendedPaidThrough({}, 6, JAN_15)).toBe("2026-07-15T12:00:00.000Z");
    });

    // ── Buying a second term while one is running ──
    it("extends from the EXISTING end date, not from now", () => {
        const withTwoMonthsLeft = { tier: "pro", paid_through: "2026-03-15T12:00:00.000Z" };
        expect(extendedPaidThrough(withTwoMonthsLeft, 6, JAN_15)).toBe("2026-09-15T12:00:00.000Z");
    });

    it("stacks repeatedly — three 3-month terms are nine months", () => {
        const first = extendedPaidThrough({}, 3, JAN_15);
        const second = extendedPaidThrough({ paid_through: first }, 3, JAN_15);
        const third = extendedPaidThrough({ paid_through: second }, 3, JAN_15);
        expect(third).toBe("2026-10-15T12:00:00.000Z");
    });

    it("starts from now for a LAPSED term — nobody pays for the gap they were away", () => {
        const lapsed = { tier: "free", paid_through: "2025-11-01T00:00:00.000Z" };
        expect(extendedPaidThrough(lapsed, 3, JAN_15)).toBe("2026-04-15T12:00:00.000Z");
    });

    it("starts from now when the existing date is garbage", () => {
        expect(extendedPaidThrough({ paid_through: "soon" }, 3, JAN_15)).toBe(
            "2026-04-15T12:00:00.000Z",
        );
    });
});

describe("formatPaidThrough", () => {
    it("renders a plain date, fixed to UTC", () => {
        expect(formatPaidThrough("2027-02-22T23:30:00.000Z")).toBe("22 February 2027");
    });

    it("is null for nothing and for nonsense", () => {
        expect(formatPaidThrough(null)).toBeNull();
        expect(formatPaidThrough(undefined)).toBeNull();
        expect(formatPaidThrough("")).toBeNull();
        expect(formatPaidThrough("whenever")).toBeNull();
    });
});
