/**
 * The JSONB attributes bag.
 *
 * The add form built this by hand (`add:471-475`) and the edit form took it
 * apart by hand in a different file (`edit:294-318`), as exact inverses
 * maintained by nobody. The property test at the bottom is the one that
 * would have caught a drift between them.
 */

import { describe, expect, it } from "vitest";

import { cleanAttributeBag, packAttributes, unpackAttributes } from "@/lib/forms/attributes";
import { validateAttributes } from "@/lib/config/assetFields";
import type { AssetCategory } from "@/lib/types/database";

describe("packAttributes", () => {
    it("builds a tack bag from form values", () => {
        expect(
            packAttributes("tack", {
                tack_type: "Saddle",
                discipline: "Western",
                materials: ["Real Leather", "Metal Hardware"],
                fits_molds: "Traditional Breyer",
                working_parts: ["Working Buckles"],
            }),
        ).toEqual({
            tack_type: "Saddle",
            discipline: "Western",
            materials: ["Real Leather", "Metal Hardware"],
            fits_molds: "Traditional Breyer",
            working_parts: ["Working Buckles"],
        });
    });

    it("omits empty values instead of storing blanks", () => {
        expect(
            packAttributes("prop", {
                prop_category: "Jump/Standard",
                dimensions: "",
                terrain_setting: "   ",
                materials: [],
            }),
        ).toEqual({ prop_category: "Jump/Standard" });
    });

    it("ignores values belonging to another category", () => {
        expect(packAttributes("prop", { tack_type: "Saddle", dimensions: "6 inches" })).toEqual({
            dimensions: "6 inches",
        });
    });

    it("gives a model an empty bag — models have no attributes", () => {
        expect(packAttributes("model", { tack_type: "Saddle" })).toEqual({});
    });

    it("trims the strings it keeps", () => {
        expect(packAttributes("other_model", { manufacturer: "  Schleich  " })).toEqual({
            manufacturer: "Schleich",
        });
    });
});

describe("unpackAttributes", () => {
    it("restores form values from a stored bag", () => {
        expect(
            unpackAttributes("diorama", {
                scene_theme: "Trail Ride",
                discipline: "Western",
                components: "Two models, one jump",
                base_dimensions: "12x18",
                documentation_notes: "Based on a 1987 photo",
            }),
        ).toEqual({
            scene_theme: "Trail Ride",
            discipline: "Western",
            components: "Two models, one jump",
            base_dimensions: "12x18",
            documentation_notes: "Based on a 1987 photo",
        });
    });

    it("fills every field the category owns, even absent ones", () => {
        expect(unpackAttributes("tack", {})).toEqual({
            tack_type: "",
            discipline: "",
            materials: [],
            fits_molds: "",
            working_parts: [],
        });
    });

    it("survives a null bag", () => {
        expect(unpackAttributes("prop", null).materials).toEqual([]);
        expect(unpackAttributes("prop", undefined).dimensions).toBe("");
    });

    it("coerces a stored bare string back into a chip array", () => {
        expect(unpackAttributes("tack", { materials: "Vinyl" }).materials).toEqual(["Vinyl"]);
    });

    it("ignores a stored value of the wrong type", () => {
        expect(unpackAttributes("tack", { fits_molds: 42 }).fits_molds).toBe("");
        expect(unpackAttributes("tack", { materials: 42 }).materials).toEqual([]);
    });
});

describe("pack ∘ unpack is the identity on stored bags", () => {
    const CASES: [AssetCategory, Record<string, unknown>][] = [
        ["tack", { tack_type: "Bridle", materials: ["Faux Leather"], fits_molds: "Stone ISH" }],
        ["prop", { prop_category: "Fence/Gate", dimensions: "8in", terrain_setting: "Pasture/Field" }],
        ["diorama", { scene_theme: "Racing", components: "Three models" }],
        ["other_model", { species: "Cattle", breed: "Holstein", manufacturer: "CollectA" }],
        ["model", {}],
    ];

    it.each(CASES)("%s round-trips unchanged", (category, bag) => {
        expect(packAttributes(category, unpackAttributes(category, bag))).toEqual(bag);
    });
});

describe("cleanAttributeBag — the untrusted-input path", () => {
    it("strips keys the category does not own", () => {
        const { cleaned } = cleanAttributeBag("tack", {
            tack_type: "Saddle",
            prop_category: "Fence/Gate",
            owner_id: "attacker",
        });
        expect(cleaned).toEqual({ tack_type: "Saddle" });
    });

    it("drops empty and null values", () => {
        const { cleaned } = cleanAttributeBag("prop", {
            dimensions: "",
            terrain_setting: null,
            prop_category: "Barrel/Pole",
        });
        expect(cleaned).toEqual({ prop_category: "Barrel/Pole" });
    });

    it("coerces a bare string into an array for the chip fields", () => {
        expect(cleanAttributeBag("tack", { materials: "Vinyl" }).cleaned).toEqual({
            materials: ["Vinyl"],
        });
    });

    it("filters non-strings out of a chip array", () => {
        expect(
            cleanAttributeBag("tack", { working_parts: ["Working Buckles", 7, null] }).cleaned,
        ).toEqual({ working_parts: ["Working Buckles"] });
    });

    it("returns an empty bag for models, whatever it is handed", () => {
        expect(cleanAttributeBag("model", { anything: "at all" }).cleaned).toEqual({});
    });

    it("drops a non-string value on a text field rather than coercing it", () => {
        expect(cleanAttributeBag("prop", { dimensions: { nested: "object" } }).cleaned).toEqual({});
    });
});

describe("assetFields.validateAttributes still behaves exactly as before", () => {
    // The legacy forms call this on every submit. It is now an alias for
    // cleanAttributeBag, so this pins the behaviour they depend on.
    it("is the same function by another name", () => {
        const input = { tack_type: "Saddle", materials: "Vinyl", bogus: "x" };
        expect(validateAttributes("tack", input)).toEqual(cleanAttributeBag("tack", input));
    });

    it("always reports valid, as it always did", () => {
        expect(validateAttributes("tack", { nonsense: 1 }).valid).toBe(true);
        expect(validateAttributes("model", {}).valid).toBe(true);
    });
});
