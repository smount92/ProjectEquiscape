import { describe, it, expect } from "vitest";
import {
    normalizeFinishType,
    normalizeCondition,
    normalizePrice,
    validateCsvRows,
    matchScoreLabel,
    findDuplicateNames,
    CONDITION_GRADES,
    FINISH_TYPES,
    type CsvRowInput,
} from "@/lib/csv-import/validation";
import {
    conditionGradeValues,
    finishTypeValues,
    matchImportHeader,
} from "@/lib/forms/registry";

/* ──────────────────────────────────────────────────────
   CSV import pre-validation — pure logic tests.
   These rules mirror batch_import_horses_v2 (migration 144).
   ────────────────────────────────────────────────────── */

describe("normalizeFinishType", () => {
    it("passes canonical values through", () => {
        expect(normalizeFinishType("OF")).toBe("OF");
        expect(normalizeFinishType("Custom")).toBe("Custom");
        expect(normalizeFinishType("Artist Resin")).toBe("Artist Resin");
    });

    it("is case-insensitive", () => {
        expect(normalizeFinishType("of")).toBe("OF");
        expect(normalizeFinishType("CUSTOM")).toBe("Custom");
        expect(normalizeFinishType("artist resin")).toBe("Artist Resin");
    });

    it("maps the classic spreadsheet spellings", () => {
        // THE bug that used to abort whole imports:
        expect(normalizeFinishType("Original Finish")).toBe("OF");
        expect(normalizeFinishType("CM")).toBe("Custom");
        expect(normalizeFinishType("repaint")).toBe("Custom");
        expect(normalizeFinishType("Resin")).toBe("Artist Resin");
    });

    it("defaults empty to OF", () => {
        expect(normalizeFinishType("")).toBe("OF");
        expect(normalizeFinishType("   ")).toBe("OF");
    });

    it("returns null for unmappable values", () => {
        expect(normalizeFinishType("Chalky")).toBeNull();
        expect(normalizeFinishType("N/A")).toBeNull();
    });
});

describe("normalizeCondition", () => {
    it("passes known grades through, case-insensitively", () => {
        expect(normalizeCondition("Mint")).toBe("Mint");
        expect(normalizeCondition("near mint")).toBe("Near Mint");
        expect(normalizeCondition("BODY QUALITY")).toBe("Body Quality");
    });

    it("maps common shorthand", () => {
        expect(normalizeCondition("NM")).toBe("Near Mint");
        expect(normalizeCondition("vg")).toBe("Very Good");
        expect(normalizeCondition("body")).toBe("Body Quality");
    });

    it("defaults empty to Not Graded", () => {
        expect(normalizeCondition("")).toBe("Not Graded");
    });

    it("returns null for unknown grades", () => {
        expect(normalizeCondition("Pretty Good I Guess")).toBeNull();
    });
});

describe("normalizePrice", () => {
    it("accepts plain and decorated numbers", () => {
        expect(normalizePrice("45")).toEqual({ ok: true, value: "45" });
        expect(normalizePrice("$45.00")).toEqual({ ok: true, value: "45.00" });
        expect(normalizePrice("1,200.50")).toEqual({ ok: true, value: "1200.50" });
        expect(normalizePrice(" $1,200 ")).toEqual({ ok: true, value: "1200" });
    });

    it("treats empty as ok/null (optional field)", () => {
        expect(normalizePrice("")).toEqual({ ok: true, value: null });
        expect(normalizePrice("  ")).toEqual({ ok: true, value: null });
    });

    it("rejects non-numeric and negative values", () => {
        expect(normalizePrice("about 50").ok).toBe(false);
        expect(normalizePrice("N/A").ok).toBe(false);
        expect(normalizePrice("-20").ok).toBe(false);
    });
});

describe("validateCsvRows", () => {
    const goodRow: CsvRowInput = {
        name: "Midnight Dream",
        finish_type: "OF",
        condition: "Mint",
        purchase_price: "45.00",
        estimated_value: "$65",
    };

    it("returns no errors for clean rows", () => {
        expect(validateCsvRows([goodRow, { ...goodRow, name: "Prairie Rose" }])).toEqual([]);
    });

    it("numbers rows like the user's spreadsheet (header = row 1)", () => {
        const errors = validateCsvRows([
            goodRow,
            { ...goodRow, name: "Prairie Rose", finish_type: "Chalky" },
        ]);
        expect(errors).toHaveLength(1);
        expect(errors[0].rowNumber).toBe(3); // second data row
        expect(errors[0].name).toBe("Prairie Rose");
    });

    it("writes the plain-English finish message (no enum spew)", () => {
        const errors = validateCsvRows([{ ...goodRow, finish_type: "Glossy" }]);
        expect(errors[0].message).toBe(
            "Finish Type must be OF, Custom, or Artist Resin — got 'Glossy'.",
        );
    });

    it("flags unknown conditions with the allowed list", () => {
        const errors = validateCsvRows([{ ...goodRow, condition: "Okayish" }]);
        expect(errors[0].message).toContain("Condition must be one of");
        expect(errors[0].message).toContain(CONDITION_GRADES[0]);
        expect(errors[0].message).toContain("'Okayish'");
    });

    it("flags missing names and bad prices with row numbers", () => {
        const errors = validateCsvRows([
            { ...goodRow, name: " " },
            { ...goodRow, purchase_price: "cheap" },
        ]);
        expect(errors.map((e) => e.rowNumber)).toEqual([2, 3]);
        expect(errors[0].message).toContain("Name is required");
        expect(errors[1].message).toContain("Purchase Price must be a number");
    });

    it("collects multiple errors on the same row", () => {
        const errors = validateCsvRows([
            { ...goodRow, finish_type: "Nope", estimated_value: "lots" },
        ]);
        expect(errors).toHaveLength(2);
        expect(errors.every((e) => e.rowNumber === 2)).toBe(true);
    });

    it("accepts synonym values without erroring (they normalize)", () => {
        expect(
            validateCsvRows([
                { ...goodRow, finish_type: "Original Finish", condition: "NM" },
            ]),
        ).toEqual([]);
    });
});

describe("matchScoreLabel", () => {
    it("labels near-exact scores as strong", () => {
        expect(matchScoreLabel(0)).toBe("Strong match");
        expect(matchScoreLabel(-50)).toBe("Strong match");
    });

    it("labels weak scores as possible (goodbye 'Score: -1207')", () => {
        expect(matchScoreLabel(-51)).toBe("Possible match");
        expect(matchScoreLabel(-1207)).toBe("Possible match");
    });
});

describe("findDuplicateNames", () => {
    const stable = ["Midnight Dream", "  prairie rose ", "Shadow Dancer"];

    it("matches case-insensitively and trims", () => {
        const result = findDuplicateNames(["MIDNIGHT dream", "Prairie Rose"], stable);
        expect(result.rowCount).toBe(2);
        expect(result.names).toEqual(["MIDNIGHT dream", "Prairie Rose"]);
    });

    it("counts every colliding CSV row but lists each name once", () => {
        const result = findDuplicateNames(
            ["Midnight Dream", "midnight dream", "New Horse"],
            stable,
        );
        expect(result.rowCount).toBe(2);
        expect(result.names).toEqual(["Midnight Dream"]);
    });

    it("returns empty when nothing collides", () => {
        expect(findDuplicateNames(["Fresh Import"], stable)).toEqual({
            names: [],
            rowCount: 0,
        });
    });

    it("ignores empty names on either side", () => {
        expect(findDuplicateNames(["", "  "], ["", "Midnight Dream"]).rowCount).toBe(0);
    });
});

/**
 * The importer used to keep its own condition list and its own finish
 * list. It kept nine grades where the Add/Edit dropdown offered ten, so a
 * spreadsheet row saying "Play Grade" — exactly what the control next to
 * it offered — was rejected as invalid. Both lists now come from the form
 * engine's registry.
 */
describe("one shared vocabulary with the forms", () => {
    it("knows all ten condition grades, not nine", () => {
        expect(CONDITION_GRADES).toHaveLength(10);
        expect(CONDITION_GRADES).toEqual(conditionGradeValues());
    });

    it("accepts the 'Play Grade' row it used to reject", () => {
        expect(normalizeCondition("Play Grade")).toBe("Play Grade");
        expect(normalizeCondition("play grade")).toBe("Play Grade");
        expect(normalizeCondition("play")).toBe("Play Grade");
    });

    it("imports a Play Grade row without an error", () => {
        const errors = validateCsvRows([
            {
                name: "Well Loved",
                finish_type: "OF",
                condition: "Play Grade",
                purchase_price: "",
                estimated_value: "",
            },
        ]);
        expect(errors).toEqual([]);
    });

    it("reads the finish enum from the same place the dropdown does", () => {
        expect(FINISH_TYPES).toEqual(finishTypeValues());
    });

    it("still rejects a grade that is on nobody's list", () => {
        expect(normalizeCondition("Sparkly")).toBeNull();
    });
});

describe("CSV header aliases come off the registry", () => {
    it("maps the common spreadsheet spellings onto field names", () => {
        expect(matchImportHeader("Name")).toBe("custom_name");
        expect(matchImportHeader("horse name")).toBe("custom_name");
        expect(matchImportHeader("Condition")).toBe("condition_grade");
        expect(matchImportHeader("grade")).toBe("condition_grade");
        expect(matchImportHeader("Finish Type")).toBe("finish_type");
        expect(matchImportHeader("cost")).toBe("purchase_price");
        expect(matchImportHeader("worth")).toBe("estimated_current_value");
        expect(matchImportHeader("notes")).toBe("public_notes");
    });

    it("is case- and whitespace-insensitive", () => {
        expect(matchImportHeader("  PURCHASE PRICE  ")).toBe("purchase_price");
    });

    it("returns undefined for a column it doesn't recognise", () => {
        expect(matchImportHeader("shelf position")).toBeUndefined();
    });
});
