import { describe, it, expect } from "vitest";

import {
    WORK_TYPE_FOR_DISCIPLINE,
    dateOrderError,
    parseLooseDate,
    DISCIPLINE_PRESETS,
    LEGACY_STAGE_LABELS,
    MAX_STAGE_LABEL,
    creditLabel,
    groupByStage,
    isValidMakingPath,
    makingImagePrefix,
    stageLabel,
} from "@/lib/studio/making";

describe("discipline presets — the whole ecosystem, not just painters", () => {
    it("covers the hobby's relay: sculpt, cast, prep/paint, china, hair, tack, restoration", () => {
        const keys = DISCIPLINE_PRESETS.map((d) => d.key);
        for (const k of ["finishwork", "sculpture", "casting", "china", "hair", "tack", "restoration"]) {
            expect(keys).toContain(k);
        }
    });

    it("every preset ladder fits the stage-label cap", () => {
        for (const d of DISCIPLINE_PRESETS) {
            expect(d.stages.length).toBeGreaterThan(2);
            for (const s of d.stages) {
                expect(s.length).toBeGreaterThan(0);
                expect(s.length).toBeLessThanOrEqual(MAX_STAGE_LABEL);
            }
        }
    });
});

describe("stageLabel — legacy keys keep their words, artists keep theirs", () => {
    it("maps every 202-era enum value", () => {
        for (const k of ["blank", "prep", "base", "detail", "finished", "progress"]) {
            expect(stageLabel(k)).toBe(LEGACY_STAGE_LABELS[k]);
        }
    });
    it("passes an artist's own label straight through", () => {
        expect(stageLabel("Base coat 3 — dappling")).toBe("Base coat 3 — dappling");
        expect(stageLabel("Greenware")).toBe("Greenware");
    });
});

describe("groupByStage — the artist's order, not ours", () => {
    it("groups in first-appearance order", () => {
        const groups = groupByStage([
            { stage: "Armature" },
            { stage: "Bulked out" },
            { stage: "Armature" },
            { stage: "Refining" },
        ]);
        expect(groups.map(([s]) => s)).toEqual(["Armature", "Bulked out", "Refining"]);
        expect(groups[0][1]).toHaveLength(2);
    });

    it("floats the catch-all 'progress' bucket last", () => {
        const groups = groupByStage([
            { stage: "progress" },
            { stage: "Base coat" },
            { stage: "Finished" },
        ]);
        expect(groups.map(([s]) => s)).toEqual(["Base coat", "Finished", "progress"]);
    });

    it("leaves a progress-only reel alone", () => {
        expect(groupByStage([{ stage: "progress" }]).map(([s]) => s)).toEqual(["progress"]);
    });
});

describe("isValidMakingPath — the D5 lesson", () => {
    const horse = "abc-123";
    it("accepts exactly our prefix", () => {
        expect(isValidMakingPath(`${makingImagePrefix(horse)}17_base_0.webp`, horse)).toBe(true);
    });
    it("rejects other horses, traversal, and absolute URLs", () => {
        expect(isValidMakingPath("horses/other/making_1.webp", horse)).toBe(false);
        expect(isValidMakingPath(`horses/${horse}/making_../../avatars/x.webp`, horse)).toBe(false);
        expect(isValidMakingPath(`https://evil.example/horses/${horse}/making_1.webp`, horse)).toBe(false);
        expect(isValidMakingPath(`horses/${horse}/extra_detail_1.webp`, horse)).toBe(false);
    });
});

describe("creditLabel — a claim is labeled a claim", () => {
    it("counterparty confirmation verifies any record", () => {
        expect(
            creditLabel({ recordedBy: "artist", ownerConfirmedAt: "2026-09-01", artistIsOwner: false }),
        ).toEqual({ label: "Confirmed by owner", verified: true });
    });
    it("commission-born records are born verified", () => {
        expect(
            creditLabel({ recordedBy: "commission", ownerConfirmedAt: null, artistIsOwner: false }).verified,
        ).toBe(true);
    });
    it("the artist's own horse needs no counter-signature", () => {
        expect(
            creditLabel({ recordedBy: "artist", ownerConfirmedAt: null, artistIsOwner: true }).verified,
        ).toBe(true);
    });
    it("an unconfirmed artist claim on someone else's horse stays a claim", () => {
        const c = creditLabel({ recordedBy: "artist", ownerConfirmedAt: null, artistIsOwner: false });
        expect(c.verified).toBe(false);
        expect(c.label).toMatch(/awaiting owner/i);
    });
    it("an owner naming an artist is unverified until the artist confirms", () => {
        expect(
            creditLabel({ recordedBy: "owner", ownerConfirmedAt: null, artistIsOwner: false }).verified,
        ).toBe(false);
    });
});

describe("parseLooseDate", () => {
    const today = new Date("2026-09-18T12:00:00Z");
    it("takes a year, a year-month, or a full date", () => {
        expect(parseLooseDate("2011", today)).toEqual({ iso: "2011-01-01" });
        expect(parseLooseDate("2019-3", today)).toEqual({ iso: "2019-03-01" });
        expect(parseLooseDate("2019-03-14", today)).toEqual({ iso: "2019-03-14" });
        expect(parseLooseDate("  ", today)).toEqual({ iso: null });
        expect(parseLooseDate(null, today)).toEqual({ iso: null });
    });
    it("refuses nonsense and the future, with a sentence", () => {
        expect(parseLooseDate("March 2019", today).error).toMatch(/2019-03/);
        expect(parseLooseDate("2019-13", today).error).toMatch(/look right/);
        expect(parseLooseDate("2019-02-30", today).error).toMatch(/look right/);
        expect(parseLooseDate("2027", today).error).toMatch(/future/);
        expect(parseLooseDate("2026-09-19", today).iso).toBe("2026-09-19"); // tomorrow's date in another zone
    });
    it("catches started after finished", () => {
        expect(dateOrderError("2020-05-01", "2020-04-01")).toMatch(/after finished/);
        expect(dateOrderError("2020-04-01", "2020-05-01")).toBeNull();
        expect(dateOrderError(null, "2020-05-01")).toBeNull();
    });
    it("maps every ladder with a billable counterpart to a rate-card type", () => {
        expect(WORK_TYPE_FOR_DISCIPLINE.finishwork).toBe("Finishwork (repaint)");
        expect(WORK_TYPE_FOR_DISCIPLINE.hair).toBe("Hair / mane & tail");
        expect(WORK_TYPE_FOR_DISCIPLINE.casting).toBeUndefined();
    });
});
