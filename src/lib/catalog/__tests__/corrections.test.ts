import { describe, it, expect } from "vitest";
import {
    CATALOG_REAL_COLUMNS,
    SILVER_AUTO_FIELDS,
    buildCorrectionUpdate,
    correctionTouchesAttributes,
    fieldValueProblem,
} from "@/lib/catalog/corrections";

const change = (from: unknown, to: unknown) => ({ from, to });

describe("buildCorrectionUpdate", () => {
    it("routes real columns to columnUpdates, leaves attributes null", () => {
        const { columnUpdates, attributes } = buildCorrectionUpdate(
            {
                title: change("Old", "New"),
                maker: change("Breyer", "Stone"),
                scale: change("Traditional", "Classic"),
            },
            { color_description: "Bay" },
        );

        expect(columnUpdates).toEqual({
            title: "New",
            maker: "Stone",
            scale: "Classic (1:12)", // the list spelling
        });
        // No attribute keys touched → JSONB left untouched.
        expect(attributes).toBeNull();
    });

    it("merges attribute keys into existing attributes instead of clobbering", () => {
        const { columnUpdates, attributes } = buildCorrectionUpdate(
            {
                color_description: change("Bay", "Dark Bay"),
                material: change("resin", "plastic"),
            },
            {
                color_description: "Bay",
                release_year_start: 1998,
                model_number: "1100",
            },
        );

        expect(columnUpdates).toEqual({});
        // Untouched keys survive; touched keys are overwritten; new keys added.
        expect(attributes).toEqual({
            color_description: "Dark Bay",
            release_year_start: 1998,
            model_number: "1100",
            material: "Plastic", // the list spelling
        });
    });

    it("handles a mixed correction (column + attribute) in one pass", () => {
        const { columnUpdates, attributes } = buildCorrectionUpdate(
            {
                maker: change("Breyer", "Peter Stone"),
                release_year_start: change(1998, 1999),
            },
            { release_year_start: 1998 },
        );

        expect(columnUpdates).toEqual({ maker: "Peter Stone" });
        expect(attributes).toEqual({ release_year_start: 1999 });
    });

    it("treats missing existing attributes as an empty object", () => {
        const { attributes } = buildCorrectionUpdate({ cast_medium: change(null, "resin") }, null);
        expect(attributes).toEqual({ cast_medium: "resin" });
    });

    it("ignores malformed field changes without a `to`", () => {
        const { columnUpdates, attributes } = buildCorrectionUpdate(
            {
                title: change("A", "B"),
                junk: "not-an-object",
                empty: null,
            } as Record<string, unknown>,
            {},
        );
        expect(columnUpdates).toEqual({ title: "B" });
        expect(attributes).toBeNull();
    });
});

describe("correctionTouchesAttributes", () => {
    it("is false when only real columns change", () => {
        expect(
            correctionTouchesAttributes({
                title: change("a", "b"),
                maker: change("c", "d"),
            }),
        ).toBe(false);
    });

    it("is true when any attribute key changes", () => {
        expect(
            correctionTouchesAttributes({
                title: change("a", "b"),
                color_description: change("Bay", "Chestnut"),
            }),
        ).toBe(true);
    });
});

describe("catalog column/attribute vocabulary", () => {
    it("keeps the real-column set to the actual catalog_items columns", () => {
        expect([...CATALOG_REAL_COLUMNS].sort()).toEqual([
            "artist", // migration 156
            "item_type",
            "maker",
            "manufacturer", // migration 156
            "parent_id",
            "scale",
            "title",
        ]);
    });

    it("SILVER_AUTO_FIELDS uses attribute keys, not human labels", () => {
        // These must match the keys SuggestEditModal emits (raw attribute
        // names), otherwise silver auto-approve silently never fires.
        expect(SILVER_AUTO_FIELDS.has("color_description")).toBe(true);
        expect(SILVER_AUTO_FIELDS.has("release_year_start")).toBe(true);
        expect(SILVER_AUTO_FIELDS.has("color")).toBe(false);
        expect(SILVER_AUTO_FIELDS.has("year")).toBe(false);
    });
});

describe("fieldValueProblem (the Registry writer's value rules, in words)", () => {
    it("accepts well-formed values and empty ones", () => {
        expect(fieldValueProblem("title", "Lady Phase")).toBeNull();
        expect(fieldValueProblem("release_year_start", 1955)).toBeNull();
        expect(fieldValueProblem("run_count", "2500")).toBeNull();
        expect(fieldValueProblem("retail_price", "59.99")).toBeNull();
        expect(fieldValueProblem("color_description", "")).toBeNull();
        expect(fieldValueProblem("sculptor", "Anyone at all")).toBeNull();
    });

    it("refuses in sentences a person can act on", () => {
        expect(fieldValueProblem("title", "lady phase")).toMatch(/capital letter/);
        expect(fieldValueProblem("maker", "Breyer;")).toMatch(/punctuation/);
        expect(fieldValueProblem("release_year_start", "the 80s")).toMatch(/four digits/);
        expect(fieldValueProblem("release_year_end", "1850")).toMatch(/Years run from 1900/);
        expect(fieldValueProblem("run_count", "2,500")).toMatch(/no commas/);
        expect(fieldValueProblem("retail_price", "$59")).toContain("no $ sign");
        expect(fieldValueProblem("run_type", "Limited")).toMatch(/run type from the list/);
        expect(fieldValueProblem("scale", "Huge")).toMatch(/scale from the list/);
        expect(fieldValueProblem("gender", "mare")).toMatch(/gender from the list/);
    });

    it("lets a year Silver's fast path would not (1900 to next year and one more)", () => {
        expect(fieldValueProblem("release_year_start", "1925")).toBeNull();
    });
});
