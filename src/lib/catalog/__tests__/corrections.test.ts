import { describe, it, expect } from "vitest";
import {
    CATALOG_REAL_COLUMNS,
    SILVER_AUTO_FIELDS,
    buildCorrectionUpdate,
    correctionTouchesAttributes,
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
            { color_description: "Bay" }
        );

        expect(columnUpdates).toEqual({
            title: "New",
            maker: "Stone",
            scale: "Classic",
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
            }
        );

        expect(columnUpdates).toEqual({});
        // Untouched keys survive; touched keys are overwritten; new keys added.
        expect(attributes).toEqual({
            color_description: "Dark Bay",
            release_year_start: 1998,
            model_number: "1100",
            material: "plastic",
        });
    });

    it("handles a mixed correction (column + attribute) in one pass", () => {
        const { columnUpdates, attributes } = buildCorrectionUpdate(
            {
                maker: change("Breyer", "Peter Stone"),
                release_year_start: change(1998, 1999),
            },
            { release_year_start: 1998 }
        );

        expect(columnUpdates).toEqual({ maker: "Peter Stone" });
        expect(attributes).toEqual({ release_year_start: 1999 });
    });

    it("treats missing existing attributes as an empty object", () => {
        const { attributes } = buildCorrectionUpdate(
            { cast_medium: change(null, "resin") },
            null
        );
        expect(attributes).toEqual({ cast_medium: "resin" });
    });

    it("ignores malformed field changes without a `to`", () => {
        const { columnUpdates, attributes } = buildCorrectionUpdate(
            {
                title: change("A", "B"),
                junk: "not-an-object",
                empty: null,
            } as Record<string, unknown>,
            {}
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
            })
        ).toBe(false);
    });

    it("is true when any attribute key changes", () => {
        expect(
            correctionTouchesAttributes({
                title: change("a", "b"),
                color_description: change("Bay", "Chestnut"),
            })
        ).toBe(true);
    });
});

describe("catalog column/attribute vocabulary", () => {
    it("keeps the real-column set to the actual catalog_items columns", () => {
        expect([...CATALOG_REAL_COLUMNS].sort()).toEqual([
            "item_type",
            "maker",
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
