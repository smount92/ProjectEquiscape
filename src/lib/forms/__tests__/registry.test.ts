/**
 * The registry is a contract, not a convenience.
 *
 * Two things in here would be silent breakages if they regressed:
 *   1. Every DOM id the hand-written forms emitted. `e2e/inventory.spec.ts`
 *      drives the whole create wizard by id and nothing else asserts them.
 *   2. Owner decision 6 — tack, props, dioramas and other models get a
 *      condition grade. That is the one deliberate behaviour change, so it
 *      is pinned rather than left to be re-litigated by accident.
 */

import { describe, expect, it } from "vitest";

import {
    ALL_CATEGORIES,
    CONDITION_GRADE_OPTIONS,
    FINISH_TYPE_OPTIONS,
    HORSE_FIELDS,
    conditionGradeValues,
    finishTypeValues,
    getAttributeFields,
    getAttributeKeys,
    getColumnFields,
    getFieldSpec,
    resolveLabel,
} from "@/lib/forms/registry";
import { CONDITION_GRADES } from "@/lib/conditionGrades";
import type { AssetCategory } from "@/lib/types/database";

describe("registry integrity", () => {
    it("has unique field names", () => {
        const names = HORSE_FIELDS.map((f) => f.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it("gives every field a label, a type, a group and at least one category", () => {
        for (const spec of HORSE_FIELDS) {
            expect(spec.label, spec.name).toBeTruthy();
            expect(spec.type, spec.name).toBeTruthy();
            expect(spec.group, spec.name).toBeTruthy();
            expect(spec.categories.length, spec.name).toBeGreaterThan(0);
        }
    });

    it("keeps emoji out of labels so error messages read as English", () => {
        // "🐾 Life Stage is required." was the alternative.
        const emoji = /\p{Extended_Pictographic}/u;
        for (const spec of HORSE_FIELDS) {
            expect(emoji.test(spec.label), `${spec.name} label`).toBe(false);
            for (const label of Object.values(spec.labels ?? {})) {
                expect(emoji.test(label), `${spec.name} label override`).toBe(false);
            }
        }
    });

    it("stores every field either in a column or in the attributes bag, never both", () => {
        for (const spec of HORSE_FIELDS) {
            const hasTable = Boolean(spec.table);
            const hasAttr = Boolean(spec.attributeKey);
            expect(hasTable !== hasAttr, `${spec.name} storage`).toBe(true);
        }
    });

    it("only offers select/segmented/chips fields with options", () => {
        for (const spec of HORSE_FIELDS) {
            if (spec.type === "select" || spec.type === "segmented" || spec.type === "chips") {
                expect(spec.options?.length ?? 0, spec.name).toBeGreaterThan(0);
            }
        }
    });

    it("gives every option list unique values", () => {
        for (const spec of HORSE_FIELDS) {
            const values = (spec.options ?? []).map((o) => o.value);
            expect(new Set(values).size, spec.name).toBe(values.length);
        }
    });

    it("resolves a per-category label, falling back to the default", () => {
        const name = getFieldSpec("custom_name")!;
        expect(resolveLabel(name, "model")).toBe("Custom Name");
        expect(resolveLabel(name, "tack")).toBe("Item Name");
        expect(resolveLabel(name, "prop")).toBe("Item Name");
        expect(resolveLabel(name, "diorama")).toBe("Scene Name");
        expect(resolveLabel(name, "other_model")).toBe("Custom Name");
    });
});

describe("DOM ids — the e2e contract", () => {
    /**
     * Harvested from the three legacy forms. `e2e/inventory.spec.ts` uses
     * the starred ones directly; the rest are muscle memory and existing
     * bookmarks. None of them may ever change.
     */
    const LEGACY_IDS: Record<string, { mode: "create-full" | "edit" | "create-quick"; id: string }[]> = {
        custom_name: [
            { mode: "create-full", id: "custom-name" }, // * e2e
            { mode: "edit", id: "edit-name" },
        ],
        sculptor: [
            { mode: "create-full", id: "sculptor" },
            { mode: "edit", id: "edit-sculptor" },
        ],
        finishing_artist: [
            { mode: "create-full", id: "finishing-artist" },
            { mode: "edit", id: "edit-finishing-artist" },
        ],
        finish_type: [
            { mode: "create-full", id: "finish-type" }, // * e2e
            { mode: "edit", id: "edit-finish" },
            { mode: "create-quick", id: "quick-finish" },
        ],
        finish_details: [
            { mode: "create-full", id: "finish-details" },
            { mode: "edit", id: "edit-finish-details" },
        ],
        condition_grade: [
            { mode: "create-full", id: "condition-grade" }, // * e2e
            { mode: "edit", id: "edit-condition" },
            { mode: "create-quick", id: "quick-condition" },
        ],
        life_stage: [
            { mode: "create-full", id: "life-stage" },
            { mode: "edit", id: "edit-life-stage" },
        ],
        public_notes: [
            { mode: "create-full", id: "public-notes" },
            { mode: "edit", id: "edit-public-notes" },
        ],
        assigned_breed: [
            { mode: "create-full", id: "assigned-breed" },
            { mode: "edit", id: "edit-assigned-breed" },
        ],
        assigned_gender: [
            { mode: "create-full", id: "assigned-gender" },
            { mode: "edit", id: "edit-assigned-gender" },
        ],
        assigned_age: [
            { mode: "create-full", id: "assigned-age" },
            { mode: "edit", id: "edit-assigned-age" },
        ],
        regional_id: [
            { mode: "create-full", id: "regional-id" },
            { mode: "edit", id: "edit-regional-id" },
        ],
        trade_status: [
            { mode: "create-full", id: "trade-status" },
            { mode: "edit", id: "edit-trade-status" },
        ],
        listing_price: [
            { mode: "create-full", id: "listing-price" },
            { mode: "edit", id: "edit-listing-price" },
        ],
        marketplace_notes: [
            { mode: "create-full", id: "marketplace-notes" },
            { mode: "edit", id: "edit-marketplace-notes" },
        ],
        is_trade: [
            { mode: "create-full", id: "is-trade" },
            { mode: "edit", id: "is-trade" },
        ],
        purchase_price: [
            { mode: "create-full", id: "purchase-price" },
            { mode: "edit", id: "edit-price" },
        ],
        purchase_date: [
            { mode: "create-full", id: "purchase-date" },
            { mode: "edit", id: "edit-date" },
        ],
        purchase_date_text: [
            { mode: "create-full", id: "purchase-date-text" },
            { mode: "edit", id: "edit-purchase-date-text" },
        ],
        estimated_current_value: [
            { mode: "create-full", id: "estimated-value" },
            { mode: "edit", id: "edit-value" },
        ],
        insurance_notes: [
            { mode: "create-full", id: "insurance-notes" },
            { mode: "edit", id: "edit-insurance" },
        ],
    };

    it.each(Object.entries(LEGACY_IDS))("preserves every %s id", (name, entries) => {
        const spec = getFieldSpec(name);
        expect(spec, `${name} missing from registry`).toBeDefined();
        for (const { mode, id } of entries) {
            expect(spec!.domIds?.[mode], `${name} in ${mode}`).toBe(id);
        }
    });

    it("never reuses one id for two different fields in the same mode", () => {
        for (const mode of ["create-full", "create-quick", "edit"] as const) {
            const seen = new Map<string, string>();
            for (const spec of HORSE_FIELDS) {
                const id = spec.domIds?.[mode];
                if (!id) continue;
                expect(seen.has(id), `${id} claimed by ${seen.get(id)} and ${spec.name}`).toBe(false);
                seen.set(id, spec.name);
            }
        }
    });
});

describe("condition grades — owner decision 6", () => {
    it("offers a condition grade in every asset category, not just models", () => {
        const spec = getFieldSpec("condition_grade")!;
        for (const category of ALL_CATEGORIES) {
            expect(spec.categories.includes(category), category).toBe(true);
        }
    });

    it("labels it 'Condition' for the non-model categories", () => {
        const spec = getFieldSpec("condition_grade")!;
        expect(resolveLabel(spec, "model")).toBe("Condition Grade");
        expect(resolveLabel(spec, "tack")).toBe("Condition");
        expect(resolveLabel(spec, "prop")).toBe("Condition");
        expect(resolveLabel(spec, "diorama")).toBe("Condition");
        expect(resolveLabel(spec, "other_model")).toBe("Condition Grade");
    });

    it("serves all ten grades — including the 'Play Grade' the importer was missing", () => {
        const values = conditionGradeValues();
        expect(values).toHaveLength(10);
        expect(values).toContain("Play Grade");
        expect(values).toContain("Not Graded");
        // and it is genuinely the shared list, not a copy
        expect(values).toEqual(CONDITION_GRADES.map((g) => g.value));
    });

    it("carries each grade's gloss as the option hint", () => {
        const mint = CONDITION_GRADE_OPTIONS.find((o) => o.value === "Mint")!;
        expect(mint.hint).toBe("Flawless, like new");
        expect(mint.label).toBe("Mint — Flawless, like new");
    });
});

describe("finish types", () => {
    it("serves exactly the migration-001 enum", () => {
        expect(finishTypeValues()).toEqual(["OF", "Custom", "Artist Resin"]);
    });

    it("keeps the long option labels the forms showed", () => {
        expect(FINISH_TYPE_OPTIONS[0].label).toBe("OF (Original Finish)");
    });
});

describe("attribute fields per category", () => {
    const EXPECTED: Record<AssetCategory, string[]> = {
        model: [],
        tack: ["tack_type", "discipline", "materials", "fits_molds", "working_parts"],
        prop: ["prop_category", "dimensions", "terrain_setting", "materials"],
        diorama: [
            "scene_theme",
            "discipline",
            "components",
            "base_dimensions",
            "documentation_notes",
        ],
        other_model: ["species", "breed", "manufacturer", "model_number"],
    };

    it.each(Object.entries(EXPECTED))(
        "%s owns exactly the keys the old CATEGORY_KEYS set did",
        (category, keys) => {
            const actual = getAttributeKeys(category as AssetCategory);
            expect([...actual].sort()).toEqual([...keys].sort());
        },
    );

    it("gives models no attributes bag at all", () => {
        expect(getAttributeFields("model")).toHaveLength(0);
    });

    it("routes every column field to a real table", () => {
        for (const category of ALL_CATEGORIES) {
            for (const spec of getColumnFields(category)) {
                expect(["user_horses", "financial_vault"]).toContain(spec.table);
            }
        }
    });
});
