import { describe, it, expect } from "vitest";

import {
    CANONICAL_SCALES,
    CATALOG_CATEGORIES,
    CATEGORY_LABELS,
    attributionLabel,
    deriveAttribution,
    normalizeScale,
    sortScalesBySize,
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

describe("sortScalesBySize — largest model first, never alphabetical", () => {
    it("orders facet values by physical size", () => {
        const shuffled = [
            "Micro Mini",
            "Classic (1:12)",
            "Stablemate (1:32)",
            "Traditional (1:9)",
            "Mini Whinnies (1:64)",
        ];
        expect(sortScalesBySize(shuffled)).toEqual([
            "Traditional (1:9)",
            "Classic (1:12)",
            "Stablemate (1:32)",
            "Mini Whinnies (1:64)",
            "Micro Mini",
        ]);
    });

    it("ranks legacy spellings by their canonical size, unknowns last alphabetically", () => {
        expect(sortScalesBySize(["zebra size", "1:32", "Traditional", "aardvark size"])).toEqual([
            "Traditional",
            "1:32",
            "aardvark size",
            "zebra size",
        ]);
    });

    it("does not mutate its input", () => {
        const input = ["Micro Mini", "Traditional (1:9)"];
        sortScalesBySize(input);
        expect(input).toEqual(["Micro Mini", "Traditional (1:9)"]);
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

describe("attribution split — artist vs manufacturer", () => {
    it("labels the primary field by category", () => {
        expect(attributionLabel("artist_resin")).toBe("Artist");
        expect(attributionLabel("micro_mini")).toBe("Artist");
        expect(attributionLabel("medallion")).toBe("Artist");
        expect(attributionLabel("plastic_mold")).toBe("Manufacturer");
        expect(attributionLabel("factory_resin")).toBe("Manufacturer");
        expect(attributionLabel(null)).toBe("Manufacturer");
    });

    it("artist pieces: maker is the artist, manufacturer only if explicit", () => {
        expect(
            deriveAttribution({ item_type: "artist_resin", maker: "Sarah Rose" }),
        ).toEqual({ artist: "Sarah Rose", manufacturer: null });
        expect(
            deriveAttribution({
                item_type: "artist_resin",
                maker: "Sarah Rose",
                manufacturer: "Resins by Randy",
            }),
        ).toEqual({ artist: "Sarah Rose", manufacturer: "Resins by Randy" });
    });

    it("factory pieces: maker is the manufacturer, sculptor credit is the artist", () => {
        expect(
            deriveAttribution({
                item_type: "plastic_mold",
                maker: "North Light",
                sculptor: "Guy Pocock",
            }),
        ).toEqual({ artist: "Guy Pocock", manufacturer: "North Light" });
        expect(deriveAttribution({ item_type: "plastic_release", maker: "Breyer" })).toEqual({
            artist: null,
            manufacturer: "Breyer",
        });
    });

    it("explicit column values (post-156 corrections) beat derivation", () => {
        expect(
            deriveAttribution({
                item_type: "plastic_mold",
                maker: "Breyer",
                sculptor: "Chris Hess",
                artist: "Kathleen Moody",
            }),
        ).toEqual({ artist: "Kathleen Moody", manufacturer: "Breyer" });
    });

    it("blank strings degrade to null, never to empty credit lines", () => {
        expect(
            deriveAttribution({ item_type: "artist_resin", maker: "  ", sculptor: " " }),
        ).toEqual({ artist: null, manufacturer: null });
    });
});
