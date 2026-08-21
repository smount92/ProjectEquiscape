/**
 * The derived zod schema — the boundary the server actions never had.
 *
 * `createHorseRecord` and `updateHorseAction` validated nothing beyond a
 * column allow-list, so a hand-rolled fetch could set a condition grade of
 * "Sparkly", a 10,000-character name, or a negative price. Everything the
 * browser refused, the server accepted.
 *
 * Error messages are asserted verbatim in places — they are user-facing
 * copy, and "Invalid input: expected string, received number" is not.
 */

import { describe, expect, it } from "vitest";

import { getFieldSpec } from "@/lib/forms/registry";
import { ctx } from "@/lib/forms/rules";
import {
    firstProblemMessage,
    fromActionInput,
    normalizeValue,
    normalizeValues,
    toActionInput,
    validateCreateInput,
    validateForm,
    validateUpdateInput,
} from "@/lib/forms/schema";

const VALID_MODEL = {
    custom_name: "Midnight Star",
    finish_type: "OF",
    condition_grade: "Mint",
};

describe("normalizeValue", () => {
    const text = getFieldSpec("custom_name")!;
    const money = getFieldSpec("purchase_price")!;
    const chips = getFieldSpec("materials")!;
    const check = getFieldSpec("is_trade")!;

    it("trims text and treats blank as absent", () => {
        expect(normalizeValue(text, "  Star  ")).toBe("Star");
        expect(normalizeValue(text, "   ")).toBeUndefined();
        expect(normalizeValue(text, "")).toBeUndefined();
        expect(normalizeValue(text, null)).toBeUndefined();
    });

    it("parses numeric strings, and leaves junk alone so it can be reported", () => {
        expect(normalizeValue(money, "12.50")).toBe(12.5);
        expect(normalizeValue(money, " 40 ")).toBe(40);
        expect(normalizeValue(money, "")).toBeUndefined();
        expect(normalizeValue(money, "free")).toBe("free");
    });

    it("coerces a lone chip string into an array and drops empty arrays", () => {
        expect(normalizeValue(chips, "Vinyl")).toEqual(["Vinyl"]);
        expect(normalizeValue(chips, ["Vinyl", "", "Wire"])).toEqual(["Vinyl", "Wire"]);
        expect(normalizeValue(chips, [])).toBeUndefined();
    });

    it("normalises checkbox truthiness", () => {
        expect(normalizeValue(check, true)).toBe(true);
        expect(normalizeValue(check, "true")).toBe(true);
        expect(normalizeValue(check, false)).toBe(false);
    });
});

describe("normalizeValues", () => {
    it("drops keys the registry has never heard of", () => {
        const out = normalizeValues(ctx("model", "create-full"), {
            custom_name: "Star",
            owner_id: "someone-else",
            is_admin: true,
        });
        expect(out).toEqual({ custom_name: "Star" });
    });

    it("drops fields the current category doesn't offer", () => {
        const out = normalizeValues(ctx("tack", "create-full"), {
            custom_name: "Bridle",
            finishing_artist: "smuggled in",
            tack_type: "Bridle",
        });
        expect(out).toEqual({ custom_name: "Bridle", tack_type: "Bridle" });
    });
});

describe("validateForm — required fields", () => {
    it("accepts a complete model", () => {
        const result = validateForm(ctx("model", "create-full", VALID_MODEL), VALID_MODEL);
        expect(result.ok).toBe(true);
    });

    it("reports each missing required field in plain English", () => {
        const result = validateForm(ctx("model", "create-full", {}), {});
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems.map((p) => p.message)).toEqual([
            "Custom Name is required.",
            "Finish Type is required.",
            "Condition Grade is required.",
        ]);
    });

    it("uses the category's label in the message", () => {
        const result = validateForm(ctx("diorama", "create-full", {}), {});
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toBe("Scene Name is required.");
    });

    it("stops requiring a grade for a work in progress", () => {
        const values = { custom_name: "Star", finish_type: "Custom", life_stage: "in_progress" };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(true);
    });

    it("accepts a tack item with nothing but a name", () => {
        const values = { custom_name: "Show Halter" };
        expect(validateForm(ctx("tack", "create-full", values), values).ok).toBe(true);
    });
});

describe("validateForm — value constraints", () => {
    it("rejects a condition grade that isn't on the ladder", () => {
        const values = { ...VALID_MODEL, condition_grade: "Sparkly" };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toContain("Condition Grade must be one of:");
        expect(result.problems[0].message).toContain("Play Grade");
    });

    it("accepts every grade the dropdown offers — Play Grade included", () => {
        for (const grade of ["Mint", "Body Quality", "Play Grade", "Not Graded"]) {
            const values = { ...VALID_MODEL, condition_grade: grade };
            expect(validateForm(ctx("model", "create-full", values), values).ok, grade).toBe(true);
        }
    });

    it("rejects a finish type outside the enum", () => {
        const values = { ...VALID_MODEL, finish_type: "Original Finish" };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toBe(
            "Finish Type must be one of: OF, Custom, Artist Resin.",
        );
    });

    it("enforces the length caps the browser showed but the server ignored", () => {
        const values = { ...VALID_MODEL, custom_name: "x".repeat(101) };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toBe(
            "Custom Name is too long (max 100 characters).",
        );
    });

    it("caps public notes at 500", () => {
        const values = { ...VALID_MODEL, public_notes: "x".repeat(501) };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toContain("Public Notes is too long");
    });

    it("refuses a negative price", () => {
        const values = { ...VALID_MODEL, trade_status: "For Sale", listing_price: -5 };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toBe("Listing Price cannot be negative.");
    });

    it("refuses a price that isn't a number", () => {
        const values = { ...VALID_MODEL, purchase_price: "about forty quid" };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toBe("Purchase Price must be a number.");
    });

    it("refuses a malformed purchase date", () => {
        const values = { ...VALID_MODEL, purchase_date: "last tuesday" };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toBe("Purchase Date must be a date (YYYY-MM-DD).");
    });

    it("rejects a material that isn't in the vocabulary", () => {
        const values = { custom_name: "Bridle", materials: ["Unobtainium"] };
        const result = validateForm(ctx("tack", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toContain("Materials must be one of:");
    });

    it("rejects a visibility value outside the tri-state", () => {
        const values = { ...VALID_MODEL, visibility: "semi-public" };
        const result = validateForm(ctx("model", "create-full", values), values);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toBe(
            "Visibility must be one of: public, unlisted, private.",
        );
    });

    it("never reports one field twice", () => {
        const result = validateForm(ctx("model", "create-full", {}), { custom_name: "" });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        const fields = result.problems.map((p) => p.field);
        expect(new Set(fields).size).toBe(fields.length);
    });
});

describe("firstProblemMessage", () => {
    it("is empty for a clean form", () => {
        expect(firstProblemMessage([])).toBe("");
    });

    it("passes a lone problem through unchanged", () => {
        expect(firstProblemMessage([{ field: "a", label: "A", message: "A is required." }])).toBe(
            "A is required.",
        );
    });

    it("counts the rest without listing them", () => {
        const problems = [
            { field: "a", label: "A", message: "A is required." },
            { field: "b", label: "B", message: "B is required." },
            { field: "c", label: "C", message: "C is required." },
        ];
        expect(firstProblemMessage(problems)).toBe("A is required. (2 more problems to fix)");
        expect(firstProblemMessage(problems.slice(0, 2))).toBe(
            "A is required. (1 more problem to fix)",
        );
    });
});

describe("action-payload projection", () => {
    it("maps camelCase action keys onto registry names", () => {
        const values = fromActionInput({
            customName: "Star",
            conditionGrade: "Mint",
            estimatedValue: 250,
            assetCategory: "model",
            somethingElse: "ignored",
        });
        expect(values).toEqual({
            custom_name: "Star",
            condition_grade: "Mint",
            estimated_current_value: 250,
        });
    });

    it("round-trips back to the action shape", () => {
        const payload = { customName: "Star", conditionGrade: "Mint", purchasePrice: 40 };
        expect(toActionInput(fromActionInput(payload))).toEqual(payload);
    });
});

describe("validateCreateInput — the create boundary", () => {
    it("accepts what the wizard actually sends", () => {
        const result = validateCreateInput({
            customName: "Midnight Star",
            finishType: "OF",
            conditionGrade: "Mint",
            assetCategory: "model",
            visibility: "public",
        });
        expect(result.ok).toBe(true);
    });

    it("defaults to the model category when none is given", () => {
        const result = validateCreateInput({ customName: "Star" });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems.map((p) => p.field)).toEqual(["finish_type", "condition_grade"]);
    });

    it("blocks the forged condition grade the old action would have written", () => {
        const result = validateCreateInput({
            customName: "Star",
            finishType: "OF",
            conditionGrade: "Flawless Diamond Tier",
            assetCategory: "model",
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].field).toBe("condition_grade");
    });

    it("blocks an over-long name from a raw call", () => {
        const result = validateCreateInput({
            customName: "x".repeat(5000),
            finishType: "OF",
            conditionGrade: "Mint",
            assetCategory: "model",
        });
        expect(result.ok).toBe(false);
    });

    it("does not demand a finish type for tack", () => {
        const result = validateCreateInput({ customName: "Show Halter", assetCategory: "tack" });
        expect(result.ok).toBe(true);
    });

    it("accepts a condition grade on tack — owner decision 6", () => {
        const result = validateCreateInput({
            customName: "Show Halter",
            assetCategory: "tack",
            conditionGrade: "Very Good",
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.condition_grade).toBe("Very Good");
    });

    it("still rejects a bogus grade on tack", () => {
        const result = validateCreateInput({
            customName: "Show Halter",
            assetCategory: "tack",
            conditionGrade: "Shiny",
        });
        expect(result.ok).toBe(false);
    });

    it("honours the work-in-progress exemption end to end", () => {
        const result = validateCreateInput({
            customName: "Star",
            finishType: "Custom",
            lifeStage: "in_progress",
            assetCategory: "model",
        });
        expect(result.ok).toBe(true);
    });
});

describe("validateUpdateInput — the edit boundary", () => {
    it("accepts a partial update that omits required fields entirely", () => {
        const result = validateUpdateInput("model", { public_notes: "Comes with box" }, null);
        expect(result.ok).toBe(true);
    });

    it("rejects clearing a required field it does send", () => {
        const result = validateUpdateInput("model", { custom_name: "" }, null);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].message).toBe("Custom Name is required.");
    });

    it("validates vault values alongside horse columns", () => {
        const result = validateUpdateInput("model", { custom_name: "Star" }, {
            purchase_price: -10,
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems[0].field).toBe("purchase_price");
    });

    it("blocks an out-of-enum trade status", () => {
        const result = validateUpdateInput("model", { trade_status: "Auction" }, null);
        expect(result.ok).toBe(false);
    });

    it("accepts the three legal trade statuses and the stolen flag", () => {
        for (const status of ["Not for Sale", "For Sale", "Open to Offers", "Stolen/Missing"]) {
            expect(validateUpdateInput("model", { trade_status: status }, null).ok, status).toBe(
                true,
            );
        }
    });

    it("silently drops a column the registry doesn't own", () => {
        const result = validateUpdateInput("model", { owner_id: "attacker" }, null);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data).toEqual({});
    });
});
