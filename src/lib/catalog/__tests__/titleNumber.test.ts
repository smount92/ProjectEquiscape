import { describe, expect, it } from "vitest";
import {
    applyTitleNumberRule,
    leadingModelNumber,
    reconcileTitleNumber,
    titleNumberProblem,
} from "@/lib/catalog/titleNumber";

/**
 * MHH-079. A volunteer typed "#5038 Silky Sullivan" with 5038 in the Model
 * number box too, and the number stayed in the title. STANDARDS: a title
 * holds the name only; the number has its own field.
 */
describe("leadingModelNumber", () => {
    it("reads a number in front of the name, with or without # and a separator", () => {
        expect(leadingModelNumber("#5038 Silky Sullivan")).toEqual({ number: "5038", rest: "Silky Sullivan" });
        expect(leadingModelNumber("5038 Silky Sullivan")).toEqual({ number: "5038", rest: "Silky Sullivan" });
        expect(leadingModelNumber("#712 — Misty of Chincoteague")).toEqual({
            number: "712",
            rest: "Misty of Chincoteague",
        });
        expect(leadingModelNumber("#700615 - Smarty Jones")).toEqual({ number: "700615", rest: "Smarty Jones" });
        expect(leadingModelNumber("# 5022: Silky")).toEqual({ number: "5022", rest: "Silky" });
    });

    it("leaves a name alone when nothing or a year leads it", () => {
        expect(leadingModelNumber("Silky Sullivan")).toBeNull();
        expect(leadingModelNumber("2019 Holiday Horse")).toBeNull();
        expect(leadingModelNumber("12-Piece Stablemates Set")).toBeNull();
        expect(leadingModelNumber("5038")).toBeNull();
        // With a # it is a number, whatever it looks like.
        expect(leadingModelNumber("#1995 Andrew")).toEqual({ number: "1995", rest: "Andrew" });
    });
});

describe("reconcileTitleNumber", () => {
    it("strips the number when the box already holds it", () => {
        expect(reconcileTitleNumber("#5038 Silky Sullivan", "5038")).toEqual({
            ok: true,
            title: "Silky Sullivan",
            model: "5038",
        });
        expect(reconcileTitleNumber("5038 Silky Sullivan", "#5038")).toEqual({
            ok: true,
            title: "Silky Sullivan",
            model: "5038",
        });
    });

    it("moves the number into an empty box", () => {
        expect(reconcileTitleNumber("#5038 Silky Sullivan", "")).toEqual({
            ok: true,
            title: "Silky Sullivan",
            model: "5038",
        });
    });

    it("asks when the two disagree, and passes a clean title through", () => {
        expect(reconcileTitleNumber("#5038 Silky Sullivan", "5039")).toEqual({
            ok: false,
            title: "Silky Sullivan",
            inTitle: "5038",
            inBox: "5039",
        });
        expect(reconcileTitleNumber("Silky Sullivan", "5039")).toEqual({
            ok: true,
            title: "Silky Sullivan",
            model: "5039",
        });
        expect(reconcileTitleNumber("2019 Holiday Horse", "")).toEqual({
            ok: true,
            title: "2019 Holiday Horse",
            model: "",
        });
        expect(titleNumberProblem("5038", "5039")).toMatch(/#5038.*5039/);
    });
});

describe("applyTitleNumberRule (createSuggestion's last guard)", () => {
    const release = { hasModelNumber: true };

    it("cleans an addition's title and fills its number", () => {
        expect(applyTitleNumberRule({ title: "#5038 Silky Sullivan", model_number: "5038" }, release)).toEqual({
            ok: true,
            fieldChanges: { title: "Silky Sullivan", model_number: "5038" },
        });
        expect(applyTitleNumberRule({ title: "#5038 Silky Sullivan" }, release)).toEqual({
            ok: true,
            fieldChanges: { title: "Silky Sullivan", model_number: "5038" },
        });
        expect(applyTitleNumberRule({ title: "#5038 Silky", model_number: "5039" }, release)).toMatchObject({
            ok: false,
        });
    });

    it("cleans a title correction against the entry's own number", () => {
        expect(
            applyTitleNumberRule(
                { title: { from: "Silky", to: "#5038 Silky Sullivan" } },
                { hasModelNumber: true, currentModel: "5038" },
            ),
        ).toEqual({ ok: true, fieldChanges: { title: { from: "Silky", to: "Silky Sullivan" } } });
        expect(
            applyTitleNumberRule(
                { title: { from: "Silky", to: "#5038 Silky Sullivan" } },
                { hasModelNumber: true, currentModel: null },
            ),
        ).toEqual({
            ok: true,
            fieldChanges: {
                title: { from: "Silky", to: "Silky Sullivan" },
                model_number: { from: "", to: "5038" },
            },
        });
        expect(
            applyTitleNumberRule(
                { title: { from: "Silky", to: "#5038 Silky" } },
                { hasModelNumber: true, currentModel: "5039" },
            ),
        ).toMatchObject({ ok: false });
    });

    it("leaves molds, artist pieces and number-free titles as they are", () => {
        const fc = { title: "#5038 Silky Sullivan" };
        expect(applyTitleNumberRule(fc, { hasModelNumber: false })).toEqual({ ok: true, fieldChanges: fc });
        const plain = { title: "Silky Sullivan", model_number: "5038" };
        expect(applyTitleNumberRule(plain, release)).toEqual({ ok: true, fieldChanges: plain });
        const colour = { color_description: { from: "", to: "Bay" } };
        expect(applyTitleNumberRule(colour, release)).toEqual({ ok: true, fieldChanges: colour });
    });
});
