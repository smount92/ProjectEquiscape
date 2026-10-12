import { describe, it, expect } from "vitest";
import {
    deleteStableViewSchema,
    getStablePageSchema,
    saveStableViewSchema,
    savedViewParamsSchema,
} from "@/lib/stable/schemas";

const COLLECTION_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("getStablePageSchema", () => {
    it("defaults page/per/sort", () => {
        const parsed = getStablePageSchema.parse({});
        expect(parsed).toMatchObject({ page: 1, per: 48, sort: "newest" });
    });

    it("accepts a fully-loaded filter set", () => {
        const parsed = getStablePageSchema.parse({
            q: "valegro",
            finish: "Artist Resin",
            maker: "Breyer",
            scale: "Traditional",
            category: "diorama",
            trade: "Stolen/Missing",
            collection: COLLECTION_ID,
            hasRecords: true,
            sort: "name-za",
            page: 3,
            per: 96,
        });
        expect(parsed.collection).toBe(COLLECTION_ID);
        expect(parsed.hasRecords).toBe(true);
        expect(parsed).toMatchObject({ page: 3, per: 96 });
    });

    it("caps the page size at 192", () => {
        expect(getStablePageSchema.safeParse({ per: 192 }).success).toBe(true);
        expect(getStablePageSchema.safeParse({ per: 193 }).success).toBe(false);
        expect(getStablePageSchema.safeParse({ per: 0 }).success).toBe(false);
    });

    it("rejects page numbers below 1 or fractional", () => {
        expect(getStablePageSchema.safeParse({ page: 0 }).success).toBe(false);
        expect(getStablePageSchema.safeParse({ page: -1 }).success).toBe(false);
        expect(getStablePageSchema.safeParse({ page: 1.5 }).success).toBe(false);
    });

    it("rejects finish values outside the enum", () => {
        expect(getStablePageSchema.safeParse({ finish: "Chrome" }).success).toBe(false);
    });

    it("rejects a malformed collection UUID", () => {
        expect(getStablePageSchema.safeParse({ collection: "abc" }).success).toBe(false);
    });

    it("rejects an over-long search query", () => {
        expect(getStablePageSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    });
});

describe("saveStableViewSchema", () => {
    it("accepts a named view with known param keys", () => {
        const parsed = saveStableViewSchema.parse({
            name: "For-sale Breyers",
            params: { finish: "OF", maker: "Breyer", trade: "For Sale" },
        });
        expect(parsed.name).toBe("For-sale Breyers");
    });

    it("trims and rejects empty names", () => {
        expect(saveStableViewSchema.safeParse({ name: "   ", params: {} }).success).toBe(false);
    });

    it("rejects names over 60 characters", () => {
        expect(saveStableViewSchema.safeParse({ name: "x".repeat(61), params: {} }).success).toBe(false);
    });

    it("rejects unknown param keys (no smuggled JSON)", () => {
        expect(savedViewParamsSchema.safeParse({ finish: "OF", __proto__x: "boom" }).success).toBe(false);
        expect(savedViewParamsSchema.safeParse({ anything: "else" }).success).toBe(false);
    });

    it("accepts a stored page size but not a page number", () => {
        expect(savedViewParamsSchema.safeParse({ finish: "OF", per: "96" }).success).toBe(true);
        expect(savedViewParamsSchema.safeParse({ finish: "OF", page: "3" }).success).toBe(false);
    });

    it("rejects non-string param values", () => {
        expect(savedViewParamsSchema.safeParse({ finish: 42 }).success).toBe(false);
    });
});

describe("deleteStableViewSchema", () => {
    it("requires a UUID id", () => {
        expect(deleteStableViewSchema.safeParse({ id: "nope" }).success).toBe(false);
        expect(deleteStableViewSchema.safeParse({ id: COLLECTION_ID }).success).toBe(true);
    });
});
