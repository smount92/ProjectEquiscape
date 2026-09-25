import { describe, it, expect } from "vitest";
import { deriveShowFocus, focusChips, EMPTY_FOCUS } from "@/lib/shows/focus";

const cls = (allowedFinishes: string[] | null, allowedScales: string[] | null = null, status = "open") => ({
    allowedFinishes,
    allowedScales,
    status,
});

describe("show focus, derived from the program", () => {
    it("reads finishes, axes and scales off the classes in hobby order", () => {
        const focus = deriveShowFocus([
            { axis: "performance", classes: [cls(["AR", "CM"]), cls(null)] },
            { axis: "halter", classes: [cls(["OF"], ["Traditional (1:9)"]), cls(["OF"], ["Stablemate (1:32)"])] },
        ]);
        expect(focus.finishes).toEqual(["OF", "CM", "AR"]);
        expect(focus.axes).toEqual(["halter", "performance"]);
        expect(focus.scales).toEqual(["Stablemate (1:32)", "Traditional (1:9)"]);
        expect(focus.classCount).toBe(4);
        expect(focusChips(focus)).toEqual(["OF", "CM", "AR", "Halter", "Performance", "Stablemate", "Traditional"]);
    });

    it("claims no finish when no class restricts one, and nothing at all for an empty program", () => {
        const open = deriveShowFocus([{ axis: "halter", classes: [cls(null), cls([])] }]);
        expect(focusChips(open)).toEqual(["Halter"]);
        expect(focusChips(EMPTY_FOCUS)).toEqual([]);
        expect(focusChips(undefined)).toEqual([]);
        expect(focusChips(deriveShowFocus([{ axis: "halter", classes: [] }]))).toEqual([]);
    });

    it("ignores cancelled and combined classes and the 'other' axis", () => {
        const focus = deriveShowFocus([
            { axis: "other", classes: [cls(["OF"])] },
            { axis: "halter", classes: [cls(["CM"], null, "cancelled"), cls(["AR"], null, "combined")] },
        ]);
        expect(focus.axes).toEqual([]);
        expect(focus.finishes).toEqual(["OF"]);
        expect(focus.classCount).toBe(1);
    });

    it("caps the scale chips", () => {
        const focus = deriveShowFocus([
            { axis: "halter", classes: [cls(null, ["Traditional (1:9)", "Classic (1:12)", "Stablemate (1:32)", "Mini Whinnie (1:64)", "Pebbles (1:18)"])] },
        ]);
        const chips = focusChips(focus);
        expect(chips.slice(0, 1)).toEqual(["Halter"]);
        expect(chips.at(-1)).toBe("+2 scales");
    });
});
