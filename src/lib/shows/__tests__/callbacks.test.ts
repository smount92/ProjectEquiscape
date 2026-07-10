/**
 * Phase E2 — the callback ladder rules: candidate derivation
 * (section ← 1st places, division ← section champions, show ←
 * division champions), round gating, and pick validation.
 */

import { describe, expect, it } from "vitest";

import {
    buildCallbackLadder,
    findLadderRound,
    isJudgeableClassStatus,
    validateCallbackSelection,
    type CallbackRecord,
    type LadderClass,
    type LadderRound,
} from "../callbacks";

const SECTIONS = [
    { id: "sec-stock", name: "Stock", divisionId: "div-of" },
    { id: "sec-light", name: "Light", divisionId: "div-of" },
    { id: "sec-cm-stock", name: "Stock", divisionId: "div-cm" },
];
const DIVISIONS = [
    { id: "div-of", name: "OF Plastic Halter" },
    { id: "div-cm", name: "CM Halter" },
];

function cls(
    id: string,
    sectionId: string,
    status: LadderClass["status"],
    firsts: string[] = [],
): LadderClass {
    return {
        classId: id,
        sectionId,
        divisionId: SECTIONS.find((s) => s.id === sectionId)!.divisionId,
        status,
        entries: firsts.map((entryId) => ({ id: entryId, place: 1 })),
    };
}

function ladderOf(classes: LadderClass[], callbacks: CallbackRecord[] = []) {
    return buildCallbackLadder({
        classes,
        sections: SECTIONS,
        divisions: DIVISIONS,
        callbacks,
    });
}

describe("callbacks — buildCallbackLadder", () => {
    it("section round waits until every judgeable class is placed", () => {
        const ladder = ladderOf([
            cls("c1", "sec-stock", "placed", ["e1"]),
            cls("c2", "sec-stock", "judging"),
        ]);
        expect(ladder.sections[0].state).toBe("waiting");
    });

    it("cancelled and combined classes never gate the section round", () => {
        const ladder = ladderOf([
            cls("c1", "sec-stock", "placed", ["e1"]),
            cls("c2", "sec-stock", "cancelled"),
            cls("c3", "sec-stock", "combined"),
        ]);
        expect(ladder.sections[0].state).toBe("open");
        expect(ladder.sections[0].candidateEntryIds).toEqual(["e1"]);
        expect(isJudgeableClassStatus("cancelled")).toBe(false);
        expect(isJudgeableClassStatus("combined")).toBe(false);
    });

    it("section candidates are exactly the 1st-place entries", () => {
        const withSeconds: LadderClass = {
            ...cls("c1", "sec-stock", "placed"),
            entries: [
                { id: "e1", place: 1 },
                { id: "e2", place: 2 },
                { id: "e3", place: null },
            ],
        };
        const ladder = ladderOf([withSeconds, cls("c2", "sec-stock", "placed", ["e4"])]);
        expect(ladder.sections[0].candidateEntryIds).toEqual(["e1", "e4"]);
    });

    it("sections without judgeable classes produce no round", () => {
        const ladder = ladderOf([
            cls("c1", "sec-stock", "placed", ["e1"]),
            cls("c2", "sec-light", "cancelled"),
        ]);
        expect(ladder.sections.map((r) => r.scopeId)).toEqual(["sec-stock"]);
        // div-cm has no classes at all — no division round either.
        expect(ladder.divisions.map((r) => r.scopeId)).toEqual(["div-of"]);
    });

    it("division round waits until every section round is decided", () => {
        const classes = [
            cls("c1", "sec-stock", "placed", ["e1"]),
            cls("c2", "sec-light", "placed", ["e2"]),
        ];
        const open = ladderOf(classes, [
            {
                scope: "section",
                scopeId: "sec-stock",
                championEntryId: "e1",
                reserveEntryId: null,
            },
        ]);
        expect(open.divisions[0].state).toBe("waiting");

        const decided = ladderOf(classes, [
            { scope: "section", scopeId: "sec-stock", championEntryId: "e1", reserveEntryId: null },
            { scope: "section", scopeId: "sec-light", championEntryId: "e2", reserveEntryId: null },
        ]);
        expect(decided.divisions[0].state).toBe("open");
        // Division candidates = the section CHAMPIONS, nothing else.
        expect(decided.divisions[0].candidateEntryIds).toEqual(["e1", "e2"]);
    });

    it("show round candidates are the division champions", () => {
        const classes = [
            cls("c1", "sec-stock", "placed", ["e1"]),
            cls("c2", "sec-cm-stock", "placed", ["e9"]),
        ];
        const ladder = ladderOf(classes, [
            { scope: "section", scopeId: "sec-stock", championEntryId: "e1", reserveEntryId: null },
            { scope: "section", scopeId: "sec-cm-stock", championEntryId: "e9", reserveEntryId: null },
            { scope: "division", scopeId: "div-of", championEntryId: "e1", reserveEntryId: null },
            { scope: "division", scopeId: "div-cm", championEntryId: "e9", reserveEntryId: null },
        ]);
        expect(ladder.show).not.toBeNull();
        expect(ladder.show!.state).toBe("open");
        expect(ladder.show!.candidateEntryIds).toEqual(["e1", "e9"]);
    });

    it("a recorded champion marks the round decided (re-record stays possible)", () => {
        const ladder = ladderOf(
            [cls("c1", "sec-stock", "placed", ["e1", "e2"])],
            [
                {
                    scope: "section",
                    scopeId: "sec-stock",
                    championEntryId: "e1",
                    reserveEntryId: "e2",
                },
            ],
        );
        expect(ladder.sections[0].state).toBe("decided");
        expect(ladder.sections[0].championEntryId).toBe("e1");
        expect(ladder.sections[0].reserveEntryId).toBe("e2");
    });

    it("findLadderRound locates section/division/show rounds", () => {
        const ladder = ladderOf([cls("c1", "sec-stock", "placed", ["e1"])]);
        expect(findLadderRound(ladder, "section", "sec-stock")?.label).toBe("Stock");
        expect(findLadderRound(ladder, "section", "sec-unknown")).toBeNull();
        expect(findLadderRound(ladder, "division", "div-of")?.label).toBe(
            "OF Plastic Halter",
        );
        expect(findLadderRound(ladder, "show", null)).toBe(ladder.show);
    });
});

describe("callbacks — validateCallbackSelection", () => {
    const openRound: LadderRound = {
        scope: "section",
        scopeId: "sec-stock",
        label: "Stock",
        divisionName: "OF Plastic Halter",
        state: "open",
        candidateEntryIds: ["e1", "e2"],
        championEntryId: null,
        reserveEntryId: null,
    };

    it("accepts a candidate champion with optional candidate reserve", () => {
        expect(validateCallbackSelection(openRound, "e1", null)).toEqual({ ok: true });
        expect(validateCallbackSelection(openRound, "e1", "e2")).toEqual({ ok: true });
    });

    it("refuses a waiting round", () => {
        const result = validateCallbackSelection(
            { ...openRound, state: "waiting" },
            "e1",
            null,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toMatch(/opens when every class/i);
    });

    it("refuses a champion that never placed 1st in the scope", () => {
        const result = validateCallbackSelection(openRound, "e99", null);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toMatch(/1st-place entries/i);
    });

    it("refuses a division champion who is not a section champion", () => {
        const divisionRound: LadderRound = {
            ...openRound,
            scope: "division",
            scopeId: "div-of",
            candidateEntryIds: ["e1"],
        };
        const result = validateCallbackSelection(divisionRound, "e2", null);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toMatch(/section champions/i);
    });

    it("refuses reserve === champion and non-candidate reserves", () => {
        const same = validateCallbackSelection(openRound, "e1", "e1");
        expect(same.ok).toBe(false);
        if (!same.ok) expect(same.reason).toMatch(/different entries/i);

        const stranger = validateCallbackSelection(openRound, "e1", "e99");
        expect(stranger.ok).toBe(false);
        if (!stranger.ok) expect(stranger.reason).toMatch(/same callback candidates/i);
    });
});
