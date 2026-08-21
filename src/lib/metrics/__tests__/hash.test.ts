import { describe, expect, it } from "vitest";
import { dailySalt, hashViewer, utcDay, viewerHash, viewerKey } from "@/lib/metrics/hash";

/**
 * These tests are the privacy claim, written as assertions. If the "rotates
 * daily" or "reveals nothing without the secret" properties ever regress,
 * the honest paragraph on /privacy stops being true — so they are checked
 * here rather than trusted to the comment above the function.
 */

const SECRET = "test-secret";

describe("utcDay", () => {
    it("is the UTC calendar date, not the local one", () => {
        // 23:30 UTC on the 3rd is still the 3rd, even from a timezone that
        // has already rolled over. Getting this wrong would smear a day's
        // rollup across two rows.
        expect(utcDay(new Date("2026-08-03T23:30:00Z"))).toBe("2026-08-03");
        expect(utcDay(new Date("2026-08-04T00:00:00Z"))).toBe("2026-08-04");
    });

    it("formats as YYYY-MM-DD, the shape Postgres DATE accepts", () => {
        expect(utcDay(new Date("2026-01-09T12:00:00Z"))).toBe("2026-01-09");
    });
});

describe("dailySalt", () => {
    it("is stable within a day", () => {
        expect(dailySalt(SECRET, "2026-08-03")).toBe(dailySalt(SECRET, "2026-08-03"));
    });

    it("changes when the day changes", () => {
        expect(dailySalt(SECRET, "2026-08-03")).not.toBe(dailySalt(SECRET, "2026-08-04"));
    });

    it("changes when the secret changes", () => {
        expect(dailySalt(SECRET, "2026-08-03")).not.toBe(dailySalt("other", "2026-08-03"));
    });
});

describe("viewerKey", () => {
    it("prefers the user id when signed in", () => {
        expect(viewerKey({ userId: "abc", ip: "1.2.3.4", userAgent: "Firefox" })).toBe("u:abc");
    });

    it("falls back to IP and user agent when signed out", () => {
        expect(viewerKey({ ip: "1.2.3.4", userAgent: "Firefox" })).toBe("a:1.2.3.4|Firefox");
    });

    it("does not collapse two anonymous browsers on one address", () => {
        const a = viewerKey({ ip: "1.2.3.4", userAgent: "Firefox" });
        const b = viewerKey({ ip: "1.2.3.4", userAgent: "Safari" });
        expect(a).not.toBe(b);
    });

    it("tolerates missing pieces rather than throwing on a beacon path", () => {
        expect(viewerKey({})).toBe("a:unknown|unknown");
        expect(viewerKey({ ip: null, userAgent: null })).toBe("a:unknown|unknown");
    });

    it("never puts a member and an anonymous visitor in the same namespace", () => {
        // The u:/a: prefixes exist so an IP that happens to look like a uuid
        // cannot collide with a real account.
        expect(viewerKey({ userId: "1.2.3.4" })).not.toBe(viewerKey({ ip: "1.2.3.4" }));
    });
});

describe("viewerHash", () => {
    const day = "2026-08-03";

    it("is deterministic for the same viewer on the same day", () => {
        expect(viewerHash(SECRET, day, "u:abc")).toBe(viewerHash(SECRET, day, "u:abc"));
    });

    it("is a different value for the same viewer tomorrow", () => {
        // This is what makes a two-day trail impossible even if a purge
        // were missed: yesterday's row cannot be matched to today's.
        expect(viewerHash(SECRET, day, "u:abc")).not.toBe(
            viewerHash(SECRET, "2026-08-04", "u:abc"),
        );
    });

    it("separates two viewers on the same day", () => {
        expect(viewerHash(SECRET, day, "u:abc")).not.toBe(viewerHash(SECRET, day, "u:def"));
    });

    it("contains no trace of the input it was built from", () => {
        const hash = viewerHash(SECRET, day, "u:abc-the-user-id");
        expect(hash).not.toContain("abc");
        expect(hash).not.toContain("u:");
    });

    it("is 32 lowercase hex characters, matching the RPC's length guard", () => {
        expect(viewerHash(SECRET, day, "u:abc")).toMatch(/^[0-9a-f]{32}$/);
    });

    it("cannot be reproduced without the secret", () => {
        expect(viewerHash(SECRET, day, "u:abc")).not.toBe(viewerHash("guess", day, "u:abc"));
    });
});

describe("hashViewer", () => {
    it("composes key and hash so the route handler makes one call", () => {
        const day = "2026-08-03";
        expect(hashViewer({ userId: "abc" }, day, SECRET)).toBe(
            viewerHash(SECRET, day, viewerKey({ userId: "abc" })),
        );
    });

    it("gives a signed-in and signed-out view of the same person different tokens", () => {
        const day = "2026-08-03";
        const signedIn = hashViewer({ userId: "abc", ip: "1.2.3.4" }, day, SECRET);
        const signedOut = hashViewer({ ip: "1.2.3.4", userAgent: "Firefox" }, day, SECRET);
        expect(signedIn).not.toBe(signedOut);
    });
});
