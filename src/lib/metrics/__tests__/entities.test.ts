import { describe, expect, it } from "vitest";
import {
    ENTITY_LABELS,
    ENTITY_TYPES,
    entityHref,
    isEntityType,
    isValidEntityId,
    MAX_ENTITY_ID_LENGTH,
} from "@/lib/metrics/entities";
import { isMissingMetricsSchema } from "@/lib/metrics/db";
import { entityKey } from "@/lib/metrics/resolve";
import { viewStatsLabel } from "@/lib/metrics/sellerViews";

describe("the entity allow-list", () => {
    it("is exactly the seven types migration 175 CHECKs", () => {
        // If these ever drift apart, the RPC silently drops writes the route
        // handler accepted. Keep this list and the SQL CHECK in lockstep.
        expect([...ENTITY_TYPES].sort()).toEqual([
            "barn",
            "horse",
            "listing",
            "profile",
            "reference",
            "show",
            "studio",
        ]);
    });

    it("labels every type, so the admin tab can never render undefined", () => {
        for (const type of ENTITY_TYPES) {
            expect(ENTITY_LABELS[type]?.many).toBeTruthy();
            expect(ENTITY_LABELS[type]?.emoji).toBeTruthy();
        }
    });

    it("accepts only listed types", () => {
        expect(isEntityType("horse")).toBe(true);
        expect(isEntityType("profile")).toBe(true);
        expect(isEntityType("user")).toBe(false);
        expect(isEntityType("_site")).toBe(false);
        expect(isEntityType("")).toBe(false);
        expect(isEntityType(null)).toBe(false);
        expect(isEntityType(7)).toBe(false);
    });
});

describe("isValidEntityId", () => {
    it("accepts a uuid and a slug", () => {
        expect(isValidEntityId("0f9e4b3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")).toBe(true);
        expect(isValidEntityId("breyer_traditional-01")).toBe(true);
    });

    it("rejects anything that is not a key", () => {
        expect(isValidEntityId("")).toBe(false);
        expect(isValidEntityId("has space")).toBe(false);
        expect(isValidEntityId("../../etc/passwd")).toBe(false);
        expect(isValidEntityId("<script>")).toBe(false);
        expect(isValidEntityId(null)).toBe(false);
        expect(isValidEntityId(42)).toBe(false);
    });

    it("bounds the length so a rollup key cannot become a payload", () => {
        expect(isValidEntityId("a".repeat(MAX_ENTITY_ID_LENGTH))).toBe(true);
        expect(isValidEntityId("a".repeat(MAX_ENTITY_ID_LENGTH + 1))).toBe(false);
    });
});

describe("entityHref", () => {
    it("routes a horse and its listing to the same passport", () => {
        expect(entityHref("horse", "h1")).toBe("/community/h1");
        expect(entityHref("listing", "h1")).toBe("/community/h1");
    });

    it("declines to guess for slug-routed types", () => {
        // These need a lookup; resolveEntityNames supplies the href instead.
        expect(entityHref("barn", "b1")).toBeNull();
        expect(entityHref("studio", "s1")).toBeNull();
    });
});

describe("entityKey", () => {
    it("keeps a horse and its listing in separate buckets", () => {
        expect(entityKey("horse", "abc")).not.toBe(entityKey("listing", "abc"));
    });
});

describe("isMissingMetricsSchema", () => {
    it("recognises the pre-migration error codes", () => {
        expect(isMissingMetricsSchema({ code: "42P01" })).toBe(true);
        expect(isMissingMetricsSchema({ code: "42883" })).toBe(true);
        expect(isMissingMetricsSchema({ code: "PGRST202" })).toBe(true);
        expect(isMissingMetricsSchema({ code: "PGRST205" })).toBe(true);
    });

    it("recognises the message forms PostgREST sends", () => {
        expect(
            isMissingMetricsSchema({ message: 'relation "object_view_daily" does not exist' }),
        ).toBe(true);
        expect(
            isMissingMetricsSchema({ message: "Could not find the function in the schema cache" }),
        ).toBe(true);
    });

    it("does not swallow a real failure", () => {
        // A permission error must surface, not be mistaken for "not pasted".
        expect(isMissingMetricsSchema({ code: "42501", message: "permission denied" })).toBe(false);
        expect(isMissingMetricsSchema(null)).toBe(false);
        expect(isMissingMetricsSchema(undefined)).toBe(false);
    });
});

describe("viewStatsLabel", () => {
    it("says nothing when there is nothing to say", () => {
        expect(viewStatsLabel(null)).toBeNull();
        // A brand-new horse reading "0 views this week" is a verdict, not
        // information — the line stays absent until it has content.
        expect(viewStatsLabel({ weekViews: 0, weekViewers: 0, allTimeViews: 0 })).toBeNull();
    });

    it("reads naturally for one view", () => {
        expect(viewStatsLabel({ weekViews: 1, weekViewers: 1, allTimeViews: 1 })).toBe(
            "1 view this week (1 all-time)",
        );
    });

    it("pairs a quiet week with the all-time total", () => {
        expect(viewStatsLabel({ weekViews: 0, weekViewers: 0, allTimeViews: 48 })).toBe(
            "0 views this week (48 all-time)",
        );
    });

    it("groups large numbers", () => {
        expect(viewStatsLabel({ weekViews: 12, weekViewers: 9, allTimeViews: 1234 })).toBe(
            "12 views this week (1,234 all-time)",
        );
    });
});
