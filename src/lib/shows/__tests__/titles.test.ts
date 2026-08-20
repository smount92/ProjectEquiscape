import { describe, it, expect } from "vitest";

import {
    CH_JUDGES_REQUIRED,
    CH_SHOWS_REQUIRED,
    ROM_POINTS,
    STAR_THRESHOLDS,
    SUPERIOR_POINTS,
    evaluateExhibitorDistinctions,
    evaluateHorseTitles,
    highestStar,
    horseTitleProgress,
    nextStarProgress,
    titlePrefix,
    type TitleCardInput,
} from "@/lib/shows/titles";

function card(showId: string, judgeIds: string[], status = "issued"): TitleCardInput {
    return { showId, judgeIds, status };
}

describe("evaluateHorseTitles — CH (3 cards / 3 shows / 2 judges)", () => {
    it("grants CH when all three bars clear", () => {
        const grants = evaluateHorseTitles({
            cards: [card("s1", ["j1"]), card("s2", ["j2"]), card("s3", ["j1"])],
            careerPoints: 0,
        });
        expect(grants.map((g) => g.code)).toEqual(["CH"]);
        expect(grants[0].evidence).toEqual({
            cards: 3,
            shows: CH_SHOWS_REQUIRED,
            judges: CH_JUDGES_REQUIRED,
        });
    });

    it("three cards from only two shows do not make a Champion", () => {
        const grants = evaluateHorseTitles({
            cards: [card("s1", ["j1"]), card("s1", ["j1"]), card("s2", ["j2"])],
            careerPoints: 0,
        });
        expect(grants).toEqual([]);
    });

    it("three shows under a single judge do not make a Champion", () => {
        const grants = evaluateHorseTitles({
            cards: [card("s1", ["j1"]), card("s2", ["j1"]), card("s3", ["j1"])],
            careerPoints: 0,
        });
        expect(grants).toEqual([]);
    });

    it("void cards never count; redeemed cards still do", () => {
        const voided = evaluateHorseTitles({
            cards: [card("s1", ["j1"], "void"), card("s2", ["j2"]), card("s3", ["j3"])],
            careerPoints: 0,
        });
        expect(voided).toEqual([]);
        const redeemed = evaluateHorseTitles({
            cards: [card("s1", ["j1"], "redeemed"), card("s2", ["j2"]), card("s3", ["j3"])],
            careerPoints: 0,
        });
        expect(redeemed.map((g) => g.code)).toEqual(["CH"]);
    });
});

describe("evaluateHorseTitles — career-point marks", () => {
    it(`ROM at ${ROM_POINTS}, Superior at ${SUPERIOR_POINTS} (both granted at 75+)`, () => {
        expect(evaluateHorseTitles({ cards: [], careerPoints: ROM_POINTS - 1 })).toEqual([]);
        expect(
            evaluateHorseTitles({ cards: [], careerPoints: ROM_POINTS }).map((g) => g.code),
        ).toEqual(["ROM"]);
        expect(
            evaluateHorseTitles({ cards: [], careerPoints: SUPERIOR_POINTS }).map((g) => g.code),
        ).toEqual(["ROM", "SUP"]);
    });
});

describe("titlePrefix — the name plaque", () => {
    it("CH outranks marks; SUP supersedes ROM", () => {
        expect(titlePrefix(["CH"])).toBe("CH");
        expect(titlePrefix(["ROM"])).toBe("ROM");
        expect(titlePrefix(["ROM", "SUP"])).toBe("SUP");
        expect(titlePrefix(["CH", "ROM", "SUP"])).toBe("CH SUP");
        expect(titlePrefix([])).toBe("");
    });
});

describe("horseTitleProgress — the ladder", () => {
    it("names exactly what CH is missing", () => {
        const progress = evaluateAndProgress(
            [card("s1", ["j1"]), card("s2", ["j1"])],
            10,
        );
        const ch = progress.find((p) => p.code === "CH")!;
        expect(ch.earned).toBe(false);
        expect(ch.remaining).toContain("1 more card");
        expect(ch.remaining).toContain("1 more show");
        expect(ch.remaining).toContain("a different judge");
        expect(ch.fraction).toBeGreaterThan(0);
        expect(ch.fraction).toBeLessThan(1);
    });

    it("points marks show the distance", () => {
        const progress = evaluateAndProgress([], 27);
        const rom = progress.find((p) => p.code === "ROM")!;
        expect(rom.remaining).toBe("3 more career points");
        expect(rom.fraction).toBeCloseTo(0.9);
    });

    it("earned titles read earned with full bars", () => {
        const progress = horseTitleProgress({
            cards: [],
            careerPoints: 100,
            grantedCodes: ["CH", "ROM", "SUP"],
        });
        expect(progress.every((p) => p.earned && p.fraction === 1 && p.remaining === null)).toBe(
            true,
        );
    });
});

function evaluateAndProgress(cards: TitleCardInput[], careerPoints: number) {
    return horseTitleProgress({ cards, careerPoints, grantedCodes: [] });
}

describe("nextStarProgress", () => {
    it("points at the first unearned tier", () => {
        const next = nextStarProgress({ careerPoints: 60, grantedCodes: ["STAR_1"] });
        expect(next).toMatchObject({ code: "STAR_2", pointsNeeded: 90 });
    });

    it("null at the top of the ladder", () => {
        expect(
            nextStarProgress({
                careerPoints: 9999,
                grantedCodes: STAR_THRESHOLDS.map((t) => t.code),
            }),
        ).toBeNull();
    });
});

describe("exhibitor distinctions — cumulative stars", () => {
    it("grants every threshold reached, in order", () => {
        expect(evaluateExhibitorDistinctions({ careerPoints: 49 })).toEqual([]);
        expect(
            evaluateExhibitorDistinctions({ careerPoints: 400 }).map((g) => g.code),
        ).toEqual(["STAR_1", "STAR_2", "STAR_3"]);
    });

    it("highestStar picks the top earned grade", () => {
        expect(highestStar([])).toBeNull();
        expect(highestStar(["STAR_1", "STAR_3"])).toBe("STAR_3");
        expect(highestStar(STAR_THRESHOLDS.map((t) => t.code))).toBe("STAR_5");
    });
});
