import { describe, it, expect } from "vitest";

import {
    RUBRIC_TEMPLATES,
    anchorFor,
    classAverages,
    cleanScores,
    isComplete,
    orderByScore,
    parseRubric,
    rubricTemplate,
    templateForAxis,
    weightedTotal,
} from "@/lib/shows/rubrics";

describe("the templates", () => {
    it("every template's weights sum to exactly 100", () => {
        for (const r of RUBRIC_TEMPLATES) {
            const sum = r.criteria.reduce((n, c) => n + c.weight, 0);
            expect(sum, r.key).toBe(100);
        }
    });

    it("covers every division axis the show system speaks", () => {
        for (const axis of ["halter", "performance", "workmanship", "collectibility", "other"] as const) {
            expect(templateForAxis(axis)).toBeTruthy();
        }
        // "other" generalizes to the themed ladder, not a crash.
        expect(templateForAxis("other").key).toBe("themed");
    });

    it("criterion keys are unique within a rubric", () => {
        for (const r of RUBRIC_TEMPLATES) {
            const keys = r.criteria.map((c) => c.key);
            expect(new Set(keys).size, r.key).toBe(keys.length);
        }
    });
});

describe("anchors — a 7 means the same thing at entry #38", () => {
    it("bands cover 1..10 with no gaps", () => {
        for (let s = 1; s <= 10; s++) expect(anchorFor(s), String(s)).not.toBeNull();
    });
    it("labels the bands as designed", () => {
        expect(anchorFor(2)?.label).toBe("Developing");
        expect(anchorFor(5)?.label).toBe("Solid");
        expect(anchorFor(8)?.label).toBe("Excellent");
        expect(anchorFor(10)?.label).toBe("Exceptional");
    });
});

describe("scoring math", () => {
    const themed = rubricTemplate("themed")!;

    it("computes the mockup's number: Apparition = 83.5", () => {
        // theme 9×30, execution 8×25, craft 8×20, presentation 9×15, condition 7×10
        const total = weightedTotal(themed, {
            theme: 9, execution: 8, craft: 8, presentation: 9, condition: 7,
        });
        expect(total).toBe(83.5);
    });

    it("a partial sheet never ranks", () => {
        expect(weightedTotal(themed, { theme: 9 })).toBeNull();
        expect(isComplete(themed, { theme: 9 })).toBe(false);
    });

    it("cleanScores drops junk keys, out-of-band and non-integer values", () => {
        const cleaned = cleanScores(themed, {
            theme: 9, execution: 11, craft: 0, presentation: 7.5, condition: 7,
            evil_key: 10,
        });
        expect(cleaned).toEqual({ theme: 9, condition: 7 });
    });
});

describe("the tray suggestion", () => {
    it("ranks by total and flags ties instead of breaking them", () => {
        const order = orderByScore([
            { entryId: "a", total: 79.5 },
            { entryId: "b", total: 86.5 },
            { entryId: "c", total: null },
            { entryId: "d", total: 79.5 },
        ]);
        expect(order.map((o) => o.entryId)).toEqual(["b", "a", "d"]);
        expect(order[1].tiedWithPrev).toBe(false);
        expect(order[2].tiedWithPrev).toBe(true);
    });
});

describe("parseRubric — what a class row can hand back", () => {
    it("round-trips a template", () => {
        const r = rubricTemplate("halter")!;
        expect(parseRubric(JSON.parse(JSON.stringify(r)))).toEqual(r);
    });
    it("refuses malformed shapes", () => {
        expect(parseRubric(null)).toBeNull();
        expect(parseRubric({ key: "x", name: "y", criteria: "no" })).toBeNull();
        expect(parseRubric({ key: "x", name: "y", criteria: [{ key: "a" }] })).toBeNull();
    });
});

describe("classAverages", () => {
    it("averages per criterion across the sheets that scored it", () => {
        const themed = rubricTemplate("themed")!;
        const avg = classAverages(themed, [
            { theme: 8, execution: 6, craft: 7, presentation: 6, condition: 7 },
            { theme: 6, execution: 7, craft: 7, presentation: 7, condition: 7 },
        ]);
        expect(avg.theme).toBe(7);
        expect(avg.craft).toBe(7);
        expect(avg.execution).toBe(6.5);
    });
});
