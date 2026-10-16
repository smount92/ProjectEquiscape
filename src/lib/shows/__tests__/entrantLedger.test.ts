import { describe, it, expect } from "vitest";
import { buildEntrantLedger, horseVerdict } from "@/lib/shows/entrantLedger";
import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";
import type { DivisionAxis } from "@/lib/shows/types";

function horse(overrides: Partial<EntrantHorse> & { id: string }): EntrantHorse {
    return {
        name: overrides.id,
        thumbnailUrl: null,
        scale: null,
        finish: null,
        breed: null,
        gender: null,
        ...overrides,
    };
}

function cls(overrides: Partial<ConsoleClass> & { id: string; name: string }): ConsoleClass {
    return {
        classNumber: null,
        status: "scheduled",
        maxPerEntrant: null,
        allowedScales: null,
        allowedFinishes: null,
        isQualifying: false,
        sortOrder: 0,
        entryCount: 0,
        exhibitorCount: 0,
        ...overrides,
    };
}

function division(id: string, axis: DivisionAxis, sortOrder: number, classes: ConsoleClass[]): ConsoleDivision {
    return {
        id,
        name: `Div ${id}`,
        axis,
        sortOrder,
        sections: [{ id: `${id}-s`, name: `Sec ${id}`, sortOrder: 0, classes }],
    };
}

let seq = 0;
function entry(classId: string, horseId: string, status: MyShowEntry["status"] = "entered"): MyShowEntry {
    seq += 1;
    return {
        id: `e${seq}`,
        classId,
        horseId,
        horseName: horseId,
        entryNumber: seq,
        status,
        handlerAlias: null,
        photoId: null,
        place: null,
    };
}

// A small program: halter (Arabian 101, Paint 112), performance (Western Pleasure, cap 2), workmanship (cancelled).
const arabian = cls({ id: "c-arab", name: "Arabian", classNumber: "101", sortOrder: 1 });
const paint = cls({ id: "c-paint", name: "Paint", classNumber: "112", sortOrder: 2 });
const wp = cls({ id: "c-wp", name: "Western Pleasure", classNumber: "201", maxPerEntrant: 2, sortOrder: 0 });
const cancelled = cls({ id: "c-cx", name: "Customs", classNumber: "301", status: "cancelled" });

const divisions: ConsoleDivision[] = [
    // Deliberately out of order — the ledger sorts by sortOrder.
    division("perf", "performance", 2, [wp]),
    division("halter", "halter", 1, [paint, arabian]),
    division("work", "workmanship", 3, [cancelled]),
];

const zafirah = horse({ id: "h-zaf", breed: "Arabian", scale: "Traditional" });
const chics = horse({ id: "h-chics", breed: "Quarter Horse", scale: "Traditional" });
const domino = horse({ id: "h-dom", breed: "Paint Horse", scale: "Classic" });
const horses = [chics, zafirah, domino];

describe("entrantLedger — buildEntrantLedger", () => {
    it("flattens classes in program order", () => {
        const l = buildEntrantLedger({ divisions, myEntries: [], horses });
        expect(l.classes.map((c) => c.classId)).toEqual(["c-arab", "c-paint", "c-wp", "c-cx"]);
        expect(l.byClass["c-wp"].divisionName).toBe("Div perf");
        expect(l.byClass["c-wp"].sectionName).toBe("Sec perf");
        expect(l.byClass["c-wp"].axis).toBe("performance");
    });

    it("counts ignore scratched entries", () => {
        const l = buildEntrantLedger({
            divisions,
            myEntries: [
                entry("c-wp", "h-chics", "scratched"),
                entry("c-wp", "h-zaf"),
                entry("c-paint", "h-dom", "scratched"),
            ],
            horses,
        });
        expect(l.liveEntries).toBe(1);
        expect(l.byClass["c-wp"].mineLive).toBe(1);
        expect(l.byClass["c-wp"].myHorseIds).toEqual(["h-zaf"]);
        expect(l.byClass["c-paint"].mineLive).toBe(0);
        expect(l.byHorse["h-dom"].halterClassId).toBeNull();
        expect(l.byHorse["h-chics"].classIds).toEqual([]);
        // A scratched row does not block re-entry.
        expect(l.byClass["c-wp"].verdicts.find((v) => v.horseId === "h-chics")!.code).toBe("ok");
    });

    it("in_this_class blocks the horse already entered", () => {
        const l = buildEntrantLedger({ divisions, myEntries: [entry("c-wp", "h-zaf")], horses });
        const v = l.byClass["c-wp"].verdicts.find((x) => x.horseId === "h-zaf")!;
        expect(v.code).toBe("in_this_class");
        expect(v.blocked).toBe(true);
        expect(v.reason).toBe("Already entered in this class");
    });

    it("in_other_halter names the other class by number and name", () => {
        const l = buildEntrantLedger({ divisions, myEntries: [entry("c-paint", "h-dom")], horses });
        const v = l.byClass["c-arab"].verdicts.find((x) => x.horseId === "h-dom")!;
        expect(v.code).toBe("in_other_halter");
        expect(v.blocked).toBe(true);
        expect(v.otherClassId).toBe("c-paint");
        expect(v.reason).toBe("In halter as 112 · Paint");
        // The same horse is free for performance.
        expect(l.byClass["c-wp"].verdicts.find((x) => x.horseId === "h-dom")!.code).toBe("ok");
        // In the halter class it is already in, the stronger code wins.
        expect(l.byClass["c-paint"].verdicts.find((x) => x.horseId === "h-dom")!.code).toBe("in_this_class");
    });

    it("class_full_for_you and state full at the cap", () => {
        const l = buildEntrantLedger({
            divisions,
            myEntries: [entry("c-wp", "h-zaf"), entry("c-wp", "h-dom")],
            horses,
        });
        const wpL = l.byClass["c-wp"];
        expect(wpL.mineLive).toBe(2);
        expect(wpL.remaining).toBe(0);
        expect(wpL.state).toBe("full");
        const chicsV = wpL.verdicts.find((x) => x.horseId === "h-chics")!;
        expect(chicsV.code).toBe("class_full_for_you");
        expect(chicsV.blocked).toBe(true);
        // Already-entered horses keep the higher-precedence code.
        expect(wpL.verdicts.find((x) => x.horseId === "h-zaf")!.code).toBe("in_this_class");
        expect(wpL.applicable).toEqual([]);
    });

    it("remaining counts down under the cap and is null when uncapped", () => {
        const l = buildEntrantLedger({
            divisions,
            myEntries: [entry("c-wp", "h-zaf"), entry("c-arab", "h-zaf")],
            horses,
        });
        expect(l.byClass["c-wp"].remaining).toBe(1);
        expect(l.byClass["c-wp"].state).toBe("open");
        expect(l.byClass["c-arab"].remaining).toBeNull();
        expect(l.byClass["c-arab"].maxPerEntrant).toBeNull();
    });

    it("a cancelled class is closed", () => {
        const l = buildEntrantLedger({ divisions, myEntries: [], horses });
        expect(l.byClass["c-cx"].state).toBe("closed");
        expect(l.byClass["c-cx"].status).toBe("cancelled");
    });

    it("applicable puts breed matches first, then input order; other lists blocked before soft", () => {
        const l = buildEntrantLedger({ divisions, myEntries: [], horses });
        expect(l.byClass["c-arab"].applicable).toEqual(["h-zaf", "h-chics", "h-dom"]);
        expect(l.byClass["c-paint"].applicable).toEqual(["h-dom", "h-chics", "h-zaf"]);

        const restricted = [
            division("halter", "halter", 1, [
                cls({ id: "c-trad", name: "Arabian", allowedScales: ["Traditional (1:9)"] }),
            ]),
        ];
        const l2 = buildEntrantLedger({ divisions: restricted, myEntries: [entry("c-trad", "h-chics")], horses });
        const trad = l2.byClass["c-trad"];
        expect(trad.applicable).toEqual(["h-zaf"]);
        // h-chics is blocked (already in), h-dom is a soft scale mismatch.
        expect(trad.other).toEqual(["h-chics", "h-dom"]);
        expect(trad.verdicts.map((v) => v.horseId)).toEqual(["h-chics", "h-zaf", "h-dom"]);
    });

    it("byHorse records live classes and the halter class", () => {
        const l = buildEntrantLedger({
            divisions,
            myEntries: [entry("c-wp", "h-zaf"), entry("c-arab", "h-zaf")],
            horses,
        });
        expect(l.byHorse["h-zaf"].classIds).toEqual(["c-wp", "c-arab"]);
        expect(l.byHorse["h-zaf"].halterClassId).toBe("c-arab");
        expect(l.byHorse["h-chics"].halterClassId).toBeNull();
        expect(l.horses.map((h) => h.horseId)).toEqual(["h-chics", "h-zaf", "h-dom"]);
    });

    it("classesWithRoom counts open classes where some horse is not blocked", () => {
        const empty = buildEntrantLedger({ divisions, myEntries: [], horses });
        // arab, paint, wp open; cancelled class never counts.
        expect(empty.classesWithRoom).toBe(3);

        const full = buildEntrantLedger({
            divisions,
            myEntries: [entry("c-wp", "h-zaf"), entry("c-wp", "h-dom")],
            horses,
        });
        expect(full.classesWithRoom).toBe(2);

        const noHorses = buildEntrantLedger({ divisions, myEntries: [], horses: [] });
        expect(noHorses.classesWithRoom).toBe(0);
    });
});

describe("entrantLedger — horseVerdict", () => {
    const base = {
        id: "c1",
        name: "Arabian",
        axis: "halter" as DivisionAxis,
        maxPerEntrant: null,
        allowedScales: null,
        allowedFinishes: null,
    };

    it('scale passes when "Traditional" meets "Traditional (1:9)" (normalized both sides)', () => {
        const v = horseVerdict({
            horse: { id: "h", scale: "Traditional", finish: "OF" },
            cls: { ...base, allowedScales: ["Traditional (1:9)"] },
            myLive: [],
        });
        expect(v.code).toBe("ok");
        expect(v.reason).toBeNull();
    });

    it("a scale mismatch is soft, with plain words", () => {
        const v = horseVerdict({
            horse: { id: "h", scale: "Classic", finish: "OF" },
            cls: { ...base, allowedScales: ["Traditional"] },
            myLive: [],
        });
        expect(v.code).toBe("scale");
        expect(v.blocked).toBe(false);
        expect(v.reason).toBe("Traditional (1:9) only · this horse is Classic");
    });

    it("finish is exact and soft", () => {
        const v = horseVerdict({
            horse: { id: "h", scale: null, finish: "CM" },
            cls: { ...base, allowedFinishes: ["OF"] },
            myLive: [],
        });
        expect(v.code).toBe("finish");
        expect(v.blocked).toBe(false);
    });

    it("certain codes outrank soft ones", () => {
        const v = horseVerdict({
            horse: { id: "h", scale: "Classic", finish: "CM" },
            cls: { ...base, allowedScales: ["Traditional"], allowedFinishes: ["OF"] },
            myLive: [{ classId: "c9", horseId: "h", axis: "halter" }],
        });
        expect(v.code).toBe("in_other_halter");
        expect(v.reason).toBe("Already in another halter class");
    });

    it("breedMatch uses the class name", () => {
        const v = horseVerdict({
            horse: { id: "h", scale: null, finish: null, breed: "Part-Arabian" },
            cls: base,
            myLive: [],
        });
        expect(v.breedMatch).toBe(true);
    });
});
