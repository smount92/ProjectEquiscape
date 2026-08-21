import { describe, it, expect } from "vitest";

import {
    CREATABLE_EVENT_TYPES,
    EVENT_TYPE_DB_FALLBACK,
    EVENT_TYPE_META,
    eventTypeIcon,
    eventTypeLabel,
    isCreatableEventType,
    isLegacyShowEvent,
    LEGACY_SHOW_TYPES,
} from "@/components/events/eventTypes";
import { linkHost, safeExternalUrl } from "@/components/events/EventLinkOut";

describe("event type catalog", () => {
    it("never offers the two values wired into the legacy show system", () => {
        // live_show / photo_show are read by shows.ts, the
        // transition-shows cron and profile stats. Offering them in the
        // events form is what made events a fake show system.
        for (const legacy of LEGACY_SHOW_TYPES) {
            expect(isCreatableEventType(legacy)).toBe(false);
            expect(CREATABLE_EVENT_TYPES.map((t) => t.value)).not.toContain(legacy);
        }
    });

    it("recognises legacy show rows so they can still render", () => {
        expect(isLegacyShowEvent("live_show")).toBe(true);
        expect(isLegacyShowEvent("photo_show")).toBe(true);
        expect(isLegacyShowEvent("external_show")).toBe(false);
        expect(isLegacyShowEvent("meetup")).toBe(false);
    });

    it("labels every legacy value, so old rows never render a raw enum", () => {
        for (const legacy of LEGACY_SHOW_TYPES) {
            expect(EVENT_TYPE_META[legacy]).toBeDefined();
            expect(eventTypeLabel(legacy)).toMatch(/legacy/i);
        }
    });

    it("falls back to the raw value for types it has never heard of", () => {
        expect(eventTypeLabel("wormhole")).toBe("wormhole");
        expect(eventTypeIcon("wormhole")).toBe("📌");
    });

    it("has unique values and complete metadata", () => {
        const values = CREATABLE_EVENT_TYPES.map((t) => t.value);
        expect(new Set(values).size).toBe(values.length);
        for (const t of CREATABLE_EVENT_TYPES) {
            expect(t.label.length).toBeGreaterThan(0);
            expect(t.icon.length).toBeGreaterThan(0);
            expect(t.blurb.length).toBeGreaterThan(0);
        }
    });

    it("maps every post-168 value to a pre-168 value the CHECK already allows", () => {
        // Values legal in migration 046's constraint.
        const pre168 = new Set([
            "live_show", "photo_show", "swap_meet", "meetup",
            "breyerfest", "studio_opening", "auction", "workshop", "other",
        ]);

        for (const t of CREATABLE_EVENT_TYPES) {
            if (pre168.has(t.value)) {
                // Already legal — must NOT have a fallback, or we'd
                // silently rewrite a perfectly good type.
                expect(EVENT_TYPE_DB_FALLBACK[t.value]).toBeUndefined();
            } else {
                // New value — needs a legal landing spot pre-migration.
                const fallback = EVENT_TYPE_DB_FALLBACK[t.value];
                expect(fallback, `${t.value} needs a fallback`).toBeDefined();
                expect(pre168.has(fallback)).toBe(true);
            }
        }
    });
});

describe("safeExternalUrl", () => {
    it("passes http and https through, normalised", () => {
        expect(safeExternalUrl("https://example.com/show")).toBe("https://example.com/show");
        expect(safeExternalUrl("  http://example.com  ")).toBe("http://example.com/");
    });

    it("blocks non-http schemes in stored URLs", () => {
        expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
        expect(safeExternalUrl("data:text/html,<script>")).toBeNull();
        expect(safeExternalUrl("mailto:a@b.com")).toBeNull();
    });

    it("blocks junk and empties", () => {
        expect(safeExternalUrl("not a url")).toBeNull();
        expect(safeExternalUrl("   ")).toBeNull();
        expect(safeExternalUrl(null)).toBeNull();
        expect(safeExternalUrl(undefined)).toBeNull();
    });
});

describe("linkHost", () => {
    it("shows people where they're about to go", () => {
        expect(linkHost("https://www.facebook.com/events/123")).toBe("facebook.com");
        expect(linkHost("https://mepsa.org/shows")).toBe("mepsa.org");
    });

    it("degrades to the raw string rather than throwing", () => {
        expect(linkHost("nonsense")).toBe("nonsense");
    });
});
