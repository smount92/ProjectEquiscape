import { describe, expect, it } from "vitest";
import { fieldLabel, humanizeChangeSummary } from "@/lib/catalog/editableFields";
import { CANONICAL_SCALES, normalizeScale, sortScalesBySize } from "@/lib/catalog/taxonomy";

describe("changelog labels", () => {
    it("names fields the way the edit form does", () => {
        expect(fieldLabel("color_description")).toBe("Colour and markings");
        expect(fieldLabel("release_year_start")).toBe("First released");
        expect(fieldLabel("some_new_key")).toBe("Some new key");
    });

    it("rewrites raw keys in old and new summaries, and leaves prose alone", () => {
        expect(humanizeChangeSummary("🔧 Correction: color_description: dun, chocolate points → Black")).toBe(
            "🔧 Correction: Colour and markings: dun, chocolate points → Black",
        );
        expect(
            humanizeChangeSummary(
                "🔧 Correction: model_number: 5022 → 5023, scale: Classic (1:12) → Stablemate (1:32)",
            ),
        ).toBe("🔧 Correction: Model number: 5022 → 5023, Scale: Classic (1:12) → Stablemate (1:32)");
        expect(humanizeChangeSummary("📗 New entry added: Silky Sullivan")).toBe("📗 New entry added: Silky Sullivan");
    });
});

describe("1:20 scale", () => {
    it("is a listed scale between Pebbles and Paddock Pal", () => {
        expect(CANONICAL_SCALES).toContain("1:20");
        expect(normalizeScale("1:20")).toBe("1:20");
        expect(sortScalesBySize(["Paddock Pal (1:24)", "1:20", "Pebbles (1:18)"])).toEqual([
            "Pebbles (1:18)",
            "1:20",
            "Paddock Pal (1:24)",
        ]);
    });
});
