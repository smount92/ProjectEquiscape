import { describe, it, expect } from "vitest";
import {
    buildEditableFields,
    CATALOG_EDITABLE_FIELDS,
    changedFields,
    missingFieldLabels,
    type EditableSource,
} from "@/lib/catalog/editableFields";
import { CATALOG_GENDERS, RUN_TYPES } from "@/lib/catalog/taxonomy";

/* ──────────────────────────────────────────────────────
   The correction form's field list.

   The bug this module replaces: the form offered only attributes that
   were ALREADY FILLED, so the emptier a row was, the less a member could
   do about it. 45 of 51 suggestions ever were whole new entries; breed
   and gender sat on 0 of 10,945 rows despite being fully built. These
   tests hold the fix: an empty row offers MORE to do, not less.
   ────────────────────────────────────────────────────── */

const bareRow: EditableSource = {
    title: "Mystery Release",
    maker: "Breyer",
    scale: null,
    item_type: "plastic_release",
    attributes: {},
};

const fullRow: EditableSource = {
    title: "Alborozo",
    maker: "Breyer",
    scale: "Traditional (1:9)",
    item_type: "plastic_release",
    attributes: {
        model_number: "712053",
        color_description: "Dappled grey, shaded muzzle",
        release_year_start: 2008,
        material: "Plastic",
    },
};

describe("what an empty row offers", () => {
    it("offers the full curated set even when almost nothing is filled", () => {
        const fields = buildEditableFields(bareRow);
        const keys = fields.map((f) => f.key);
        for (const f of CATALOG_EDITABLE_FIELDS) expect(keys).toContain(f.key);
    });

    // The two fields that sat on zero rows because only the addition form
    // carried them.
    it("makes breed and gender reachable on an existing entry", () => {
        const keys = buildEditableFields(bareRow).map((f) => f.key);
        expect(keys).toContain("breed");
        expect(keys).toContain("gender");
    });

    it("marks unfilled fields as empty so the form can say add, not fix", () => {
        const fields = buildEditableFields(bareRow);
        expect(fields.find((f) => f.key === "color_description")?.isEmpty).toBe(true);
        expect(fields.find((f) => f.key === "title")?.isEmpty).toBe(false);
    });
});

describe("what a filled row offers", () => {
    it("carries existing values through as originals", () => {
        const fields = buildEditableFields(fullRow);
        expect(fields.find((f) => f.key === "model_number")?.original).toBe("712053");
        expect(fields.find((f) => f.key === "release_year_start")?.original).toBe("2008");
    });

    it("keeps attributes outside the curated set editable rather than losing them", () => {
        const withExtra = {
            ...fullRow,
            attributes: { ...fullRow.attributes, finish: "Glossy" },
        };
        const fields = buildEditableFields(withExtra);
        expect(fields.find((f) => f.key === "finish")?.original).toBe("Glossy");
    });

    it("never offers pipeline plumbing as an editable fact", () => {
        const withPlumbing = {
            ...fullRow,
            attributes: { ...fullRow.attributes, source: "iyb", source_id: "iyb:4674", source_note: "x" },
        };
        const keys = buildEditableFields(withPlumbing).map((f) => f.key);
        expect(keys).not.toContain("source");
        expect(keys).not.toContain("source_id");
        expect(keys).not.toContain("source_note");
    });
});

describe("what counts as a change", () => {
    // Without this rule, opening the form and submitting would propose
    // blanking every unfilled field on the row.
    it("does not treat an untouched empty field as a change", () => {
        const fields = buildEditableFields(bareRow);
        expect(changedFields(fields)).toHaveLength(0);
    });

    it("treats filling an empty field as a change", () => {
        const fields = buildEditableFields(bareRow);
        const colour = fields.find((f) => f.key === "color_description")!;
        colour.current = "Bay pinto, blaze";
        expect(changedFields(fields).map((f) => f.key)).toEqual(["color_description"]);
    });

    it("ignores whitespace-only edits", () => {
        const fields = buildEditableFields(fullRow);
        const num = fields.find((f) => f.key === "model_number")!;
        num.current = " 712053 ";
        expect(changedFields(fields)).toHaveLength(0);
    });
});

describe("the vocabularies come from the taxonomy, not from the form", () => {
    it("run_type offers exactly the canonical list", () => {
        const f = CATALOG_EDITABLE_FIELDS.find((x) => x.key === "run_type")!;
        expect(f.options).toEqual(RUN_TYPES);
    });

    it("gender reuses the horse forms' vocabulary verbatim", () => {
        const f = CATALOG_EDITABLE_FIELDS.find((x) => x.key === "gender")!;
        expect(f.options).toEqual(CATALOG_GENDERS);
    });

    // Breed is free text BY DECISION (no closed list is good enough);
    // a select here would mean someone made that product decision by
    // accident while editing this file.
    it("breed stays free text", () => {
        const f = CATALOG_EDITABLE_FIELDS.find((x) => x.key === "breed")!;
        expect(f.kind).toBe("text");
        expect(f.options).toBeUndefined();
    });
});

describe("missingFieldLabels", () => {
    it("names what an empty row lacks, for the nudge", () => {
        const missing = missingFieldLabels(bareRow);
        expect(missing).toContain("Colour and markings");
        expect(missing).toContain("Model number");
        expect(missing).not.toContain("Name");
    });

    it("shrinks as the row fills in", () => {
        expect(missingFieldLabels(fullRow).length)
            .toBeLessThan(missingFieldLabels(bareRow).length);
    });
});
