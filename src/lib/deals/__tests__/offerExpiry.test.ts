import { describe, expect, it } from "vitest";

import { OFFER_EXPIRY_HOURS, offerCountdown, offerExpiresAt } from "../offerExpiry";

const MADE = "2026-08-01T12:00:00.000Z";
const at = (iso: string) => new Date(iso);

describe("OFFER_EXPIRY_HOURS", () => {
    it("matches the window cleanup_system_garbage() actually enforces", () => {
        // INTERVAL '7 days' in migration 175's definition. If this
        // assertion is changed, the SQL must change in the same breath.
        expect(OFFER_EXPIRY_HOURS).toBe(168);
    });
});

describe("offerExpiresAt", () => {
    it("is the offer's creation plus the enforced window", () => {
        expect(offerExpiresAt(MADE)?.toISOString()).toBe("2026-08-08T12:00:00.000Z");
    });

    it("returns null for a missing or unparseable timestamp", () => {
        expect(offerExpiresAt(null)).toBeNull();
        expect(offerExpiresAt(undefined)).toBeNull();
        expect(offerExpiresAt("not a date")).toBeNull();
    });
});

describe("offerCountdown", () => {
    it("counts whole days while there are days left", () => {
        expect(offerCountdown(MADE, at("2026-08-01T12:30:00Z"))?.label).toBe("6 days");
        expect(offerCountdown(MADE, at("2026-08-06T12:00:00Z"))?.label).toBe("2 days");
        expect(offerCountdown(MADE, at("2026-08-07T11:00:00Z"))?.label).toBe("1 day");
    });

    it("switches to hours inside the last day, and singularises", () => {
        expect(offerCountdown(MADE, at("2026-08-07T13:00:00Z"))?.label).toBe("23 hours");
        expect(offerCountdown(MADE, at("2026-08-08T10:30:00Z"))?.label).toBe("1 hour");
    });

    it("switches to minutes inside the last hour, never showing zero", () => {
        expect(offerCountdown(MADE, at("2026-08-08T11:48:00Z"))?.label).toBe("12 minutes");
        expect(offerCountdown(MADE, at("2026-08-08T11:59:30Z"))?.label).toBe("1 minute");
    });

    it("says nothing once the deadline has passed", () => {
        // The row is doomed but still 'offer_made' until the 06:00 sweep.
        // A ticker reading "0 minutes" would be theatre.
        expect(offerCountdown(MADE, at("2026-08-08T12:00:00Z"))).toBeNull();
        expect(offerCountdown(MADE, at("2026-08-09T06:00:00Z"))).toBeNull();
    });

    it("reports hours left so the caller can mark a lapsing offer urgent", () => {
        expect(offerCountdown(MADE, at("2026-08-07T18:00:00Z"))?.hoursLeft).toBe(18);
        expect(offerCountdown(MADE, at("2026-08-01T12:00:00Z"))?.hoursLeft).toBe(168);
    });

    it("hands back the deadline for a tooltip", () => {
        expect(offerCountdown(MADE, at("2026-08-02T12:00:00Z"))?.expiresAt).toBe(
            "2026-08-08T12:00:00.000Z",
        );
    });

    it("returns null rather than guessing when there is no timestamp", () => {
        expect(offerCountdown(null)).toBeNull();
    });
});
