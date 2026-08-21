/**
 * The display taxonomy: kinds, icons and — most importantly — where a
 * notification row actually goes when someone clicks it.
 */

import { describe, it, expect } from "vitest";

import { NOTIFICATION_TYPE_PREF_KEYS } from "@/lib/notifications/prefs";
import {
    NOTIFICATION_KINDS,
    dayBucket,
    isSafeNotificationLink,
    notificationIcon,
    notificationKind,
    notificationKindMeta,
    resolveNotificationHref,
    timeAgo,
} from "@/components/notifications/notificationKinds";

const row = (over: Partial<Parameters<typeof resolveNotificationHref>[0]> = {}) => ({
    type: "system",
    actorAlias: null,
    horseId: null,
    conversationId: null,
    linkUrl: null,
    ...over,
});

describe("notificationKind", () => {
    it("files the known types under their domain", () => {
        expect(notificationKind("show_result")).toBe("shows");
        expect(notificationKind("offer")).toBe("market");
        expect(notificationKind("commission")).toBe("market");
        expect(notificationKind("comment")).toBe("social");
        expect(notificationKind("achievement")).toBe("account");
    });

    it("auto-files a show type nobody has told it about", () => {
        expect(notificationKind("show_something_invented_next_quarter")).toBe("shows");
    });

    it("never returns undefined for an unknown type", () => {
        expect(notificationKind("totally_unknown")).toBe("account");
        expect(notificationKindMeta(notificationKind("totally_unknown")).label).toBe("Account");
    });

    it("classifies every type the emission engine knows about", () => {
        // prefs.ts is the engine's own inventory of types; each must land
        // somewhere sensible in the reader's view.
        for (const type of Object.keys(NOTIFICATION_TYPE_PREF_KEYS)) {
            const kind = notificationKind(type);
            expect(NOTIFICATION_KINDS.map((k) => k.id)).toContain(kind);
        }
        // Spot-check that show types did not all fall into the catch-all.
        expect(notificationKind("show_handler")).toBe("shows");
        expect(notificationKind("transfer_claimed")).toBe("market");
        expect(notificationKind("demand_alert")).toBe("market");
    });
});

describe("notificationIcon", () => {
    it("uses the per-type icon when there is one", () => {
        expect(notificationIcon("show_result")).toBe("🏆");
        expect(notificationIcon("message")).toBe("✉️");
    });

    it("falls back to the kind's icon, never to nothing", () => {
        expect(notificationIcon("show_brand_new_type")).toBe("🏆"); // Shows
        expect(notificationIcon("who_knows")).toBe("🔔"); // Account
    });
});

describe("isSafeNotificationLink", () => {
    it("accepts in-app absolute paths", () => {
        expect(isSafeNotificationLink("/shows/abc")).toBe(true);
        expect(isSafeNotificationLink("/inbox/1?tab=deal")).toBe(true);
    });

    it("rejects anything that could leave the site", () => {
        expect(isSafeNotificationLink("https://evil.example/phish")).toBe(false);
        expect(isSafeNotificationLink("//evil.example")).toBe(false);
        expect(isSafeNotificationLink("javascript:alert(1)")).toBe(false);
        expect(isSafeNotificationLink("")).toBe(false);
        expect(isSafeNotificationLink(null)).toBe(false);
    });
});

describe("resolveNotificationHref — the deep link chain", () => {
    it("prefers the emitter's link_url above everything else", () => {
        expect(
            resolveNotificationHref(
                row({ linkUrl: "/shows/s1/classes/c2", horseId: "h1", conversationId: "c1" }),
            ),
        ).toBe("/shows/s1/classes/c2");
    });

    it("ignores an unsafe link_url and keeps falling back", () => {
        expect(resolveNotificationHref(row({ linkUrl: "https://evil.example", horseId: "h1" }))).toBe(
            "/community/h1",
        );
    });

    it("falls back to the horse passport", () => {
        expect(resolveNotificationHref(row({ horseId: "h9" }))).toBe("/community/h9");
    });

    it("falls back to the conversation thread", () => {
        expect(resolveNotificationHref(row({ type: "message", conversationId: "k3" }))).toBe(
            "/inbox/k3",
        );
    });

    it("sends a follow to the follower's profile", () => {
        expect(resolveNotificationHref(row({ type: "follow", actorAlias: "Amanda" }))).toBe(
            "/profile/Amanda",
        );
    });

    it("encodes an alias that needs it", () => {
        expect(resolveNotificationHref(row({ type: "follow", actorAlias: "a b&c" }))).toBe(
            "/profile/a%20b%26c",
        );
    });

    it("sends a linkless show row to the shows listing rather than nowhere", () => {
        expect(resolveNotificationHref(row({ type: "show_deadline" }))).toBe("/shows");
        expect(resolveNotificationHref(row({ type: "show_moderation" }))).toBe("/shows");
    });

    it("uses the actor's profile as the last real destination", () => {
        expect(resolveNotificationHref(row({ type: "achievement", actorAlias: "Bea" }))).toBe(
            "/profile/Bea",
        );
    });

    it("only self-links when there is genuinely nothing to open", () => {
        expect(resolveNotificationHref(row())).toBe("/notifications");
    });
});

describe("timeAgo", () => {
    const now = new Date("2026-08-21T12:00:00Z").getTime();
    const ago = (ms: number) => new Date(now - ms).toISOString();

    it("reads in units a person uses", () => {
        expect(timeAgo(ago(30_000), now)).toBe("Just now");
        expect(timeAgo(ago(5 * 60_000), now)).toBe("5m ago");
        expect(timeAgo(ago(3 * 3_600_000), now)).toBe("3h ago");
        expect(timeAgo(ago(4 * 86_400_000), now)).toBe("4d ago");
    });

    it("switches to a date past a month", () => {
        expect(timeAgo(ago(60 * 86_400_000), now)).toMatch(/[A-Z][a-z]{2} \d{1,2}/);
    });

    it("returns empty rather than 'NaN ago' for a bad timestamp", () => {
        expect(timeAgo("not-a-date", now)).toBe("");
    });
});

describe("dayBucket", () => {
    const now = new Date("2026-08-21T12:00:00").getTime();

    it("buckets today and yesterday by calendar day, not by 24h", () => {
        expect(dayBucket(new Date("2026-08-21T00:30:00").toISOString(), now)).toBe("Today");
        expect(dayBucket(new Date("2026-08-20T23:30:00").toISOString(), now)).toBe("Yesterday");
    });

    it("groups the rest of the week together", () => {
        expect(dayBucket(new Date("2026-08-18T09:00:00").toISOString(), now)).toBe("This week");
    });

    it("falls back to month and year for older rows", () => {
        expect(dayBucket(new Date("2026-06-02T09:00:00").toISOString(), now)).toBe("June 2026");
    });

    it("does not throw on a bad timestamp", () => {
        expect(dayBucket("nonsense", now)).toBe("Undated");
    });
});
