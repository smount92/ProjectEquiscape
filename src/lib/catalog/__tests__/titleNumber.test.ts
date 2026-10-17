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
    it("reads a number in front of the name, with or without # and a separator, and says which", () => {
        expect(leadingModelNumber("#5038 Silky Sullivan")).toEqual({
            number: "5038",
            rest: "Silky Sullivan",
            hash: true,
        });
        expect(leadingModelNumber("5038 Silky Sullivan")).toEqual({
            number: "5038",
            rest: "Silky Sullivan",
            hash: false,
        });
        expect(leadingModelNumber("#712 — Misty of Chincoteague")).toEqual({
            number: "712",
            rest: "Misty of Chincoteague",
            hash: true,
        });
        expect(leadingModelNumber("#700615 - Smarty Jones")).toEqual({
            number: "700615",
            rest: "Smarty Jones",
            hash: true,
        });
        expect(leadingModelNumber("# 5022: Silky")).toEqual({ number: "5022", rest: "Silky", hash: true });
    });

    it("leaves a name alone when nothing or a year leads it", () => {
        expect(leadingModelNumber("Silky Sullivan")).toBeNull();
        expect(leadingModelNumber("2019 Holiday Horse")).toBeNull();
        expect(leadingModelNumber("12-Piece Stablemates Set")).toBeNull();
        expect(leadingModelNumber("5038")).toBeNull();
        // With a # it is a number, whatever it looks like.
        expect(leadingModelNumber("#1995 Andrew")).toEqual({ number: "1995", rest: "Andrew", hash: true });
    });
});

describe("reconcileTitleNumber: a bare number with an empty box", () => {
    it("is left alone by default (the server guard), and is a question for the forms", () => {
        expect(reconcileTitleNumber("101 Dalmatians", "")).toEqual({ ok: true, title: "101 Dalmatians", model: "" });
        expect(reconcileTitleNumber("101 Dalmatians", "5038")).toEqual({
            ok: true,
            title: "101 Dalmatians",
            model: "5038",
        });
        expect(reconcileTitleNumber("101 Dalmatians", "", { bare: "ask" })).toEqual({
            ok: false,
            title: "Dalmatians",
            inTitle: "101",
            inBox: "",
        });
        // The forms still ask which is right when a bare number and the box disagree.
        expect(reconcileTitleNumber("5002 Pinto", "5003", { bare: "ask" })).toEqual({
            ok: false,
            title: "Pinto",
            inTitle: "5002",
            inBox: "5003",
        });
        // A # or the box's own number is never a question.
        expect(reconcileTitleNumber("#5038 Silky", "", { bare: "ask" })).toEqual({
            ok: true,
            title: "Silky",
            model: "5038",
        });
        expect(reconcileTitleNumber("5038 Silky", "5038", { bare: "ask" })).toEqual({
            ok: true,
            title: "Silky",
            model: "5038",
        });
        expect(titleNumberProblem("101", "")).toMatch(/starts with 101.*model number\?/);
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

    it("keeps the number when a correction moves it from the box into the title (review of MHH-079)", () => {
        // The member cleared the box and typed the number in front of the name instead.
        expect(
            applyTitleNumberRule(
                { title: { from: "Silky", to: "#5038 Silky" }, model_number: { from: "5038", to: "" } },
                { hasModelNumber: true, currentModel: "5038" },
            ),
        ).toEqual({
            ok: true,
            fieldChanges: {
                title: { from: "Silky", to: "Silky" },
                model_number: { from: "5038", to: "5038" },
            },
        });
        // A box cleared on purpose, with a title that holds no number, is left as filed.
        const cleared = { title: { from: "Silky", to: "Silky Sullivan" }, model_number: { from: "5038", to: "" } };
        expect(applyTitleNumberRule(cleared, { hasModelNumber: true, currentModel: "5038" })).toEqual({
            ok: true,
            fieldChanges: cleared,
        });
    });

    it("never moves a bare leading number silently; only a # or the box's own number (review of MHH-079)", () => {
        const dalmatians = { title: "101 Dalmatians" };
        expect(applyTitleNumberRule(dalmatians, release)).toEqual({ ok: true, fieldChanges: dalmatians });
        const boxed = { title: "101 Dalmatians", model_number: "5038" };
        expect(applyTitleNumberRule(boxed, release)).toEqual({ ok: true, fieldChanges: boxed });
        expect(
            applyTitleNumberRule(
                { title: { from: "Dalmatians", to: "101 Dalmatians" } },
                { hasModelNumber: true, currentModel: null },
            ),
        ).toEqual({ ok: true, fieldChanges: { title: { from: "Dalmatians", to: "101 Dalmatians" } } });
        // The same number as the box is still taken off the title.
        expect(applyTitleNumberRule({ title: "5038 Silky Sullivan", model_number: "5038" }, release)).toEqual({
            ok: true,
            fieldChanges: { title: "Silky Sullivan", model_number: "5038" },
        });
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
