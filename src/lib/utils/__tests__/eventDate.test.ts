/**
 * The one-day-early bug: a DATE column value parsed as UTC renders as the
 * previous evening for every reader west of UTC. It is how one show result
 * came to be dated Aug 24 in the trophy case and Aug 23 in the Hoofprint
 * on the same passport.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { formatEventDate } from "@/lib/utils/eventDate";

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
    // A negative-offset zone is where the bug shows; UTC would hide it.
    process.env.TZ = "America/New_York";
});
afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
});

describe("formatEventDate", () => {
    it("keeps the calendar day of a date-only value", () => {
        expect(formatEventDate("2026-08-24")).toBe("Aug 24, 2026");
    });

    it("does not slip to the previous day at the start of a month", () => {
        expect(formatEventDate("2026-01-01")).toBe("Jan 1, 2026");
    });

    it("agrees with the trophy case, which pins local midnight itself", () => {
        const trophyCase = new Date("2026-08-24T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
        expect(formatEventDate("2026-08-24")).toBe(trophyCase);
    });

    it("leaves a full timestamp alone — its offset already means something", () => {
        // Midday UTC is the same calendar day on both sides of the Atlantic,
        // so this asserts the value is rendered, not shifted by our helper.
        expect(formatEventDate("2026-08-24T12:00:00Z")).toBe("Aug 24, 2026");
    });

    it("returns empty for missing or unparseable values instead of Invalid Date", () => {
        expect(formatEventDate(null)).toBe("");
        expect(formatEventDate(undefined)).toBe("");
        expect(formatEventDate("")).toBe("");
        expect(formatEventDate("not a date")).toBe("");
    });

    it("accepts custom format options", () => {
        expect(formatEventDate("2026-08-24", { month: "long", year: "numeric" })).toContain(
            "August",
        );
    });
});
