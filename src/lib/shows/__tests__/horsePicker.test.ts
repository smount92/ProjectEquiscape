import { describe, it, expect } from "vitest";
import {
    annotateHorse,
    filterAndRankHorses,
    matchesQuery,
    type PickerClassRestrictions,
} from "@/lib/shows/horsePicker";
import type { EntrantHorse } from "@/lib/shows/public";

function horse(overrides: Partial<EntrantHorse> & { id: string; name: string }): EntrantHorse {
    return { thumbnailUrl: null, scale: null, finish: null, ...overrides };
}

const traditionalOF = horse({ id: "h1", name: "Duns Blazing", scale: "Traditional", finish: "OF" });
const classicCM = horse({ id: "h2", name: "Silver Aspen", scale: "Classic", finish: "CM" });
const unknownBoth = horse({ id: "h3", name: "Mystery Colt" });

const openClass: PickerClassRestrictions = { allowedScales: null, allowedFinishes: null };
const traditionalOnly: PickerClassRestrictions = {
    allowedScales: ["Traditional"],
    allowedFinishes: null,
};
const ofOnly: PickerClassRestrictions = { allowedScales: null, allowedFinishes: ["OF"] };

describe("horsePicker — matchesQuery", () => {
    it("empty and whitespace queries match everything", () => {
        expect(matchesQuery(traditionalOF, "")).toBe(true);
        expect(matchesQuery(traditionalOF, "   ")).toBe(true);
    });

    it("matches case-insensitive substrings of the name", () => {
        expect(matchesQuery(traditionalOF, "blaz")).toBe(true);
        expect(matchesQuery(traditionalOF, "DUNS")).toBe(true);
        expect(matchesQuery(traditionalOF, "aspen")).toBe(false);
    });
});

describe("horsePicker — annotateHorse (mirrors server semantics, soft)", () => {
    it("no restrictions → everything fits", () => {
        for (const h of [traditionalOF, classicCM, unknownBoth]) {
            expect(annotateHorse(h, openClass).fitsClass).toBe(true);
            expect(annotateHorse(h, {}).fitsClass).toBe(true);
        }
    });

    it("empty restriction arrays behave like no restriction (server parity)", () => {
        const emptyLists: PickerClassRestrictions = { allowedScales: [], allowedFinishes: [] };
        expect(annotateHorse(unknownBoth, emptyLists).fitsClass).toBe(true);
    });

    it("exact-match scale restriction, unknown scale counts as a mismatch", () => {
        expect(annotateHorse(traditionalOF, traditionalOnly).fitsClass).toBe(true);
        expect(annotateHorse(classicCM, traditionalOnly).fitsClass).toBe(false);
        // Server treats null scale as ineligible when a list exists — hint agrees.
        expect(annotateHorse(unknownBoth, traditionalOnly).fitsClass).toBe(false);
    });

    it("finish restriction is independent of scale", () => {
        expect(annotateHorse(traditionalOF, ofOnly).fitsClass).toBe(true);
        const both = annotateHorse(classicCM, {
            allowedScales: ["Traditional"],
            allowedFinishes: ["OF"],
        });
        expect(both.fitsClass).toBe(false);
        expect(both.mismatches).toEqual(["Traditional scale only", "OF finish only"]);
    });

    it("comparison is exact, not fuzzy (no case folding — server parity)", () => {
        const lower = horse({ id: "h4", name: "Lowercase", scale: "traditional" });
        expect(annotateHorse(lower, traditionalOnly).fitsClass).toBe(false);
    });
});

describe("horsePicker — filterAndRankHorses", () => {
    const stable = [classicCM, traditionalOF, unknownBoth];

    it("keeps server order when the class has no restrictions", () => {
        const out = filterAndRankHorses(stable, openClass, "");
        expect(out.map((p) => p.horse.id)).toEqual(["h2", "h1", "h3"]);
        expect(out.every((p) => p.fitsClass)).toBe(true);
    });

    it("floats likely-fits first but PRESERVES order inside each group (stable partition)", () => {
        const out = filterAndRankHorses(stable, traditionalOnly, "");
        expect(out.map((p) => p.horse.id)).toEqual(["h1", "h2", "h3"]);
        expect(out.map((p) => p.fitsClass)).toEqual([true, false, false]);
    });

    it("never drops a mismatching horse — soft ordering only", () => {
        const out = filterAndRankHorses(stable, traditionalOnly, "");
        expect(out).toHaveLength(stable.length);
    });

    it("applies the name filter before ranking", () => {
        const out = filterAndRankHorses(stable, traditionalOnly, "silver");
        expect(out.map((p) => p.horse.id)).toEqual(["h2"]);
        expect(out[0].fitsClass).toBe(false);
    });

    it("scales: 500 horses rank without reordering surprises", () => {
        const big: EntrantHorse[] = Array.from({ length: 500 }, (_, i) =>
            horse({
                id: `b${i}`,
                name: `Horse ${String(i).padStart(3, "0")}`,
                scale: i % 3 === 0 ? "Traditional" : "Classic",
                finish: "OF",
            }),
        );
        const out = filterAndRankHorses(big, traditionalOnly, "");
        expect(out).toHaveLength(500);
        const fits = out.filter((p) => p.fitsClass);
        // Every third horse fits; they arrive first, still in input order.
        expect(fits).toHaveLength(167);
        expect(fits[0].horse.id).toBe("b0");
        expect(fits[1].horse.id).toBe("b3");
        expect(out[167].fitsClass).toBe(false);
        expect(out[167].horse.id).toBe("b1");
    });
});
