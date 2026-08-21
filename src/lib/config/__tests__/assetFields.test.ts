/**
 * `assetFields.ts` had no test file at all. It has one now, because it
 * stopped being hand-written: the per-category field map is derived from
 * `@/lib/forms/registry`, and the three legacy forms still read it.
 *
 * The table below is the OLD literal, copied verbatim from the file as it
 * stood before the form engine. Every cell the derivation produces must
 * match it, except the deliberate deltas listed at the bottom — which is
 * exactly the drift the engine exists to end.
 */

import { describe, expect, it } from "vitest";

import {
    getAssetConfig,
    getCategoryLabel,
    getCategoryPageTitle,
    getFieldLabel,
    getGallerySlots,
    getSteps,
    isFieldVisible,
} from "@/lib/config/assetFields";
import type { AssetCategory } from "@/lib/types/database";

type LegacyDef = { visible: boolean; label: string; required: boolean };

/** The literal that lived in `makeFields()` before the engine. */
const LEGACY: Record<AssetCategory, Record<string, LegacyDef>> = {
    model: {
        custom_name: { visible: true, label: "Custom Name", required: true },
        sculptor: { visible: true, label: "Sculptor / Artist", required: false },
        finishing_artist: { visible: true, label: "Finishing Artist", required: false },
        edition_info: { visible: true, label: "Edition Info", required: false },
        finish_type: { visible: true, label: "Finish Type", required: true },
        finish_details: { visible: true, label: "Finish Details", required: false },
        condition_grade: { visible: true, label: "Condition Grade", required: true },
        life_stage: { visible: true, label: "Life Stage", required: false },
        show_bio: { visible: true, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
    },
    tack: {
        custom_name: { visible: true, label: "Item Name", required: true },
        sculptor: { visible: true, label: "Maker / Artist", required: false },
        finishing_artist: { visible: false, label: "Finishing Artist", required: false },
        edition_info: { visible: false, label: "Edition Info", required: false },
        finish_type: { visible: false, label: "Finish Type", required: false },
        finish_details: { visible: false, label: "Finish Details", required: false },
        condition_grade: { visible: true, label: "Condition", required: false },
        life_stage: { visible: false, label: "Life Stage", required: false },
        show_bio: { visible: false, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
    },
    prop: {
        custom_name: { visible: true, label: "Item Name", required: true },
        sculptor: { visible: true, label: "Maker / Artist", required: false },
        finishing_artist: { visible: false, label: "Finishing Artist", required: false },
        edition_info: { visible: false, label: "Edition Info", required: false },
        finish_type: { visible: false, label: "Finish Type", required: false },
        finish_details: { visible: false, label: "Finish Details", required: false },
        condition_grade: { visible: true, label: "Condition", required: false },
        life_stage: { visible: false, label: "Life Stage", required: false },
        show_bio: { visible: false, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
    },
    diorama: {
        custom_name: { visible: true, label: "Scene Name", required: true },
        sculptor: { visible: true, label: "Maker / Artist", required: false },
        finishing_artist: { visible: false, label: "Finishing Artist", required: false },
        edition_info: { visible: false, label: "Edition Info", required: false },
        finish_type: { visible: false, label: "Finish Type", required: false },
        finish_details: { visible: false, label: "Finish Details", required: false },
        condition_grade: { visible: false, label: "Condition", required: false },
        life_stage: { visible: false, label: "Life Stage", required: false },
        show_bio: { visible: false, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
    },
    other_model: {
        custom_name: { visible: true, label: "Custom Name", required: true },
        sculptor: { visible: false, label: "Sculptor", required: false },
        finishing_artist: { visible: false, label: "Finishing Artist", required: false },
        edition_info: { visible: false, label: "Edition Info", required: false },
        finish_type: { visible: true, label: "Finish Type", required: false },
        finish_details: { visible: false, label: "Finish Details", required: false },
        condition_grade: { visible: true, label: "Condition Grade", required: false },
        life_stage: { visible: true, label: "Life Stage", required: false },
        show_bio: { visible: false, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
    },
};

/**
 * Every cell where the derived map deliberately disagrees with the old
 * literal. Each one is a decision, not an accident.
 */
const DELTAS: Record<string, { was: boolean; now: boolean; why: string }> = {
    // OWNER DECISION 6 — the config always promised these a grade and both
    // forms hard-coded the control to models only. Diorama was the one
    // category the config ALSO denied; it joins the rest.
    "diorama.condition_grade": {
        was: false,
        now: true,
        why: "owner decision 6 — dioramas get a condition grade",
    },
    // The forms render Finish Details unconditionally for every category.
    // Honouring the config here would REMOVE a control users can fill in
    // today, which nobody asked for.
    "tack.finish_details": { was: false, now: true, why: "the forms already render it" },
    "prop.finish_details": { was: false, now: true, why: "the forms already render it" },
    "diorama.finish_details": { was: false, now: true, why: "the forms already render it" },
    "other_model.finish_details": { was: false, now: true, why: "the forms already render it" },
    // The reverse case: the config claims other models get a finish type and
    // a life stage, but both forms gate them on a hardcoded `isModel`, so no
    // user has ever seen them. The engine keeps today's behaviour and the
    // disagreement is an open question for the owner, not a silent change.
    "other_model.finish_type": { was: true, now: false, why: "no form has ever shown it" },
    "other_model.life_stage": { was: true, now: false, why: "no form has ever shown it" },
};

const CATEGORIES = Object.keys(LEGACY) as AssetCategory[];

describe("derived field map matches the old literal", () => {
    it.each(CATEGORIES)("%s", (category) => {
        const derived = getAssetConfig(category).fields;
        for (const [key, expected] of Object.entries(LEGACY[category])) {
            const actual = derived[key];
            expect(actual, `${category}.${key} missing`).toBeDefined();

            const delta = DELTAS[`${category}.${key}`];
            const expectedVisible = delta ? delta.now : expected.visible;
            expect(actual.visible, `${category}.${key}.visible`).toBe(expectedVisible);

            expect(actual.required, `${category}.${key}.required`).toBe(expected.required);

            // Labels are only meaningful where the field is shown.
            if (expectedVisible && expected.visible) {
                expect(actual.label, `${category}.${key}.label`).toBe(expected.label);
            }
        }
    });

    it("adds no keys the legacy consumers don't expect", () => {
        for (const category of CATEGORIES) {
            expect(Object.keys(getAssetConfig(category).fields).sort()).toEqual(
                Object.keys(LEGACY[category]).sort(),
            );
        }
    });

    it("has a documented reason for every delta", () => {
        for (const [cell, delta] of Object.entries(DELTAS)) {
            expect(delta.why, cell).toBeTruthy();
            expect(delta.was, cell).not.toBe(delta.now);
        }
    });
});

describe("isFieldVisible — the three keys the legacy forms actually call", () => {
    // add-horse and edit only route sculptor, finishing_artist and
    // edition_info through this helper. If these drift, two live forms
    // change shape.
    it("sculptor: every maker category except other models", () => {
        expect(isFieldVisible("model", "sculptor")).toBe(true);
        expect(isFieldVisible("tack", "sculptor")).toBe(true);
        expect(isFieldVisible("prop", "sculptor")).toBe(true);
        expect(isFieldVisible("diorama", "sculptor")).toBe(true);
        expect(isFieldVisible("other_model", "sculptor")).toBe(false);
    });

    it("finishing_artist: models only", () => {
        expect(isFieldVisible("model", "finishing_artist")).toBe(true);
        for (const c of ["tack", "prop", "diorama", "other_model"] as AssetCategory[]) {
            expect(isFieldVisible(c, "finishing_artist"), c).toBe(false);
        }
    });

    it("edition_info: models only", () => {
        expect(isFieldVisible("model", "edition_info")).toBe(true);
        for (const c of ["tack", "prop", "diorama", "other_model"] as AssetCategory[]) {
            expect(isFieldVisible(c, "edition_info"), c).toBe(false);
        }
    });

    it("returns false for a key nobody has heard of", () => {
        expect(isFieldVisible("model", "warp_core_alignment")).toBe(false);
    });
});

describe("getFieldLabel", () => {
    it("gives the maker credit its per-category wording", () => {
        expect(getFieldLabel("model", "sculptor")).toBe("Sculptor / Artist");
        expect(getFieldLabel("tack", "sculptor")).toBe("Maker / Artist");
        expect(getFieldLabel("prop", "sculptor")).toBe("Maker / Artist");
        expect(getFieldLabel("diorama", "sculptor")).toBe("Maker / Artist");
    });

    it("falls back to the key itself when unknown", () => {
        expect(getFieldLabel("model", "nope")).toBe("nope");
    });
});

describe("layout config is untouched by the derivation", () => {
    it("keeps the model's five gallery slots with the primary first", () => {
        const slots = getGallerySlots("model");
        expect(slots).toHaveLength(5);
        expect(slots[0].angle).toBe("Primary_Thumbnail");
        expect(slots[0].primary).toBe(true);
    });

    it("gives every category a primary slot", () => {
        for (const c of CATEGORIES) {
            expect(getGallerySlots(c).filter((s) => s.primary), c).toHaveLength(1);
        }
    });

    it("keeps the model's four steps and everyone else's three", () => {
        expect(getSteps("model")).toHaveLength(4);
        expect(getSteps("other_model")).toHaveLength(4);
        for (const c of ["tack", "prop", "diorama"] as AssetCategory[]) {
            expect(getSteps(c), c).toHaveLength(3);
        }
    });

    it("shows the reference step for the two model-like categories only", () => {
        expect(getAssetConfig("model").showReferenceStep).toBe(true);
        expect(getAssetConfig("other_model").showReferenceStep).toBe(true);
        for (const c of ["tack", "prop", "diorama"] as AssetCategory[]) {
            expect(getAssetConfig(c).showReferenceStep, c).toBe(false);
        }
    });

    it("falls back to the model config for an unknown category", () => {
        const bogus = "unicorn" as AssetCategory;
        expect(getAssetConfig(bogus).label).toBe("Model Horse");
        expect(getGallerySlots(bogus)).toHaveLength(5);
        expect(getSteps(bogus)).toHaveLength(4);
    });

    it("names each category for the passport heading", () => {
        expect(getCategoryPageTitle("model")).toBe("Model Passport");
        expect(getCategoryPageTitle("tack")).toBe("Tack Details");
        expect(getCategoryLabel("diorama")).toBe("Diorama");
    });
});
