import { describe, it, expect } from "vitest";

import {
    CANONICAL_SCALES,
    CATALOG_CATEGORIES,
    CATEGORY_LABELS,
    normalizeScale,
    suggestionItemTypeToDb,
} from "@/lib/catalog/taxonomy";

describe("normalizeScale — one vocabulary to rule them all", () => {
    it("canonical forms pass through unchanged (case-insensitively)", () => {
        expect(normalizeScale("Traditional (1:9)")).toBe("Traditional (1:9)");
        expect(normalizeScale("traditional (1:9)")).toBe("Traditional (1:9)");
        expect(normalizeScale("Micro Mini")).toBe("Micro Mini");
    });

    it("maps every legacy bare form to the parenthesized canonical", () => {
        expect(normalizeScale("Traditional")).toBe("Traditional (1:9)");
        expect(normalizeScale("classic")).toBe("Classic (1:12)");
        expect(normalizeScale("Stablemate")).toBe("Stablemate (1:32)");
        expect(normalizeScale("Stablemates")).toBe("Stablemate (1:32)");
        expect(normalizeScale("Mini Whinnies")).toBe("Mini Whinnies (1:64)");
    });

    it("maps bare ratios (the old quick-chip vocabulary)", () => {
        expect(normalizeScale("1:9")).toBe("Traditional (1:9)");
        expect(normalizeScale("1:12")).toBe("Classic (1:12)");
        expect(normalizeScale("1:32")).toBe("Stablemate (1:32)");
    });

    it("fixes the Paddock Pal/Pals split and importer aliases", () => {
        expect(normalizeScale("Paddock Pal")).toBe("Paddock Pal (1:24)");
        expect(normalizeScale("Paddock Pals")).toBe("Paddock Pal (1:24)");
        expect(normalizeScale("Paddock Pals (1:24)")).toBe("Paddock Pal (1:24)");
        expect(normalizeScale("Little Bit")).toBe("Paddock Pal (1:24)");
        expect(normalizeScale("animal traditional")).toBe("Traditional (1:9)");
        expect(normalizeScale("Gallery Crystal")).toBe("Traditional (1:9)");
    });

    it("unknown values pass through trimmed, not bucketed", () => {
        expect(normalizeScale("  1:6 chalkware  ")).toBe("1:6 chalkware");
    });

    it("empty input returns null", () => {
        expect(normalizeScale("")).toBeNull();
        expect(normalizeScale("   ")).toBeNull();
        expect(normalizeScale(null)).toBeNull();
        expect(normalizeScale(undefined)).toBeNull();
    });

    it("every canonical scale normalizes to itself (vocabulary is closed)", () => {
        for (const s of CANONICAL_SCALES) expect(normalizeScale(s)).toBe(s);
    });
});

describe("categories — the Taxonomy v2 item_type vocabulary", () => {
    it("includes the community-requested types and NO custom category", () => {
        const values = CATALOG_CATEGORIES.map((c) => c.value);
        expect(values).toContain("factory_resin");
        expect(values).toContain("china");
        expect(values).toContain("micro_mini"); // Maggie Bennett rows, previously unfilterable
        expect(values.some((v) => /custom/i.test(v))).toBe(false);
        expect(CATEGORY_LABELS.plastic_mold).toBe("Mold");
    });

    it("suggestionItemTypeToDb accepts canonical values and legacy short forms", () => {
        expect(suggestionItemTypeToDb("plastic_release")).toBe("plastic_release");
        expect(suggestionItemTypeToDb("factory_resin")).toBe("factory_resin");
        // Legacy values from pre-v2 pending suggestions:
        expect(suggestionItemTypeToDb("release")).toBe("plastic_release");
        expect(suggestionItemTypeToDb("mold")).toBe("plastic_mold");
        expect(suggestionItemTypeToDb("resin")).toBe("artist_resin");
        expect(suggestionItemTypeToDb("tack")).toBe("tack");
    });

    it("rejects unknown types instead of silently minting molds", () => {
        expect(suggestionItemTypeToDb("sasquatch")).toBeNull();
        expect(suggestionItemTypeToDb("")).toBeNull();
        expect(suggestionItemTypeToDb(undefined)).toBeNull();
    });
});
