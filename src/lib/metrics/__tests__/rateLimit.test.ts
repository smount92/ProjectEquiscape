import { beforeEach, describe, expect, it } from "vitest";
import {
    allowBeacon,
    MAX_PER_WINDOW,
    MAX_TRACKED_KEYS,
    resetBeaconRateLimit,
    trackedKeyCount,
    WINDOW_MS,
} from "@/lib/metrics/rateLimit";

describe("allowBeacon", () => {
    beforeEach(() => {
        resetBeaconRateLimit();
    });

    it("allows a first request", () => {
        expect(allowBeacon("1.2.3.4", 1_000)).toBe(true);
    });

    it("allows exactly MAX_PER_WINDOW requests in a window", () => {
        for (let i = 0; i < MAX_PER_WINDOW; i++) {
            expect(allowBeacon("1.2.3.4", 1_000)).toBe(true);
        }
        expect(allowBeacon("1.2.3.4", 1_000)).toBe(false);
    });

    it("refuses for the rest of the window once the cap is hit", () => {
        for (let i = 0; i < MAX_PER_WINDOW; i++) allowBeacon("1.2.3.4", 1_000);
        expect(allowBeacon("1.2.3.4", 1_000 + WINDOW_MS - 1)).toBe(false);
    });

    it("forgives once the window rolls over", () => {
        for (let i = 0; i < MAX_PER_WINDOW; i++) allowBeacon("1.2.3.4", 1_000);
        expect(allowBeacon("1.2.3.4", 1_000 + WINDOW_MS)).toBe(true);
    });

    it("keeps separate budgets per key", () => {
        for (let i = 0; i < MAX_PER_WINDOW; i++) allowBeacon("1.2.3.4", 1_000);
        expect(allowBeacon("1.2.3.4", 1_000)).toBe(false);
        expect(allowBeacon("5.6.7.8", 1_000)).toBe(true);
    });

    it("bounds its memory rather than growing without limit", () => {
        for (let i = 0; i <= MAX_TRACKED_KEYS; i++) {
            allowBeacon(`ip-${i}`, 1_000);
        }
        // The wholesale drop means the map is small again, never unbounded.
        expect(trackedKeyCount()).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
    });

    it("never refuses a caller as a side effect of the overflow drop", () => {
        for (let i = 0; i <= MAX_TRACKED_KEYS; i++) allowBeacon(`ip-${i}`, 1_000);
        // Losing state is allowed to be permissive; it must not be punitive.
        expect(allowBeacon("fresh", 1_000)).toBe(true);
    });
});
