import { describe, it, expect } from "vitest";
import { buildEntrantLedger } from "@/lib/shows/entrantLedger";
import { classNamesBreed } from "@/lib/shows/horsePicker";
import { BREEDS } from "@/lib/showbio/vocab";
import type { ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";

function horse(o: Partial<EntrantHorse> & { id: string; name: string }): EntrantHorse {
    return { thumbnailUrl: null, scale: null, finish: null, breed: null, gender: null, ...o };
}
function division(classes: { id: string; name: string; number: string; allowedScales?: string[] | null }[]): ConsoleDivision[] {
    return [
        {
            id: "d1",
            name: "Breed Halter",
            axis: "halter",
            sortOrder: 0,
            sections: [
                {
                    id: "s1",
                    name: "Light",
                    sortOrder: 0,
                    classes: classes.map((c, i) => ({
                        id: c.id,
                        name: c.name,
                        classNumber: c.number,
                        status: "scheduled",
                        maxPerEntrant: 3,
                        allowedScales: c.allowedScales ?? null,
                        allowedFinishes: null,
                        isQualifying: true,
                        sortOrder: i,
                        entryCount: 0,
                        exhibitorCount: 0,
                    })),
                },
            ],
        },
    ];
}
const entry = (classId: string, horseId: string): MyShowEntry => ({
    id: `${classId}-${horseId}`,
    classId,
    horseId,
    horseName: horseId,
    entryNumber: null,
    status: "entered",
    handlerAlias: null,
    photoId: null,
    place: null,
});

describe("entrant ledger — the three tiers", () => {
    const arab = horse({ id: "arab", name: "Zafirah", breed: "Arabian", scale: "Traditional" });
    const morgan = horse({ id: "morgan", name: "Lippitt", breed: "Morgan", scale: "Traditional" });
    const noBreed = horse({ id: "nb", name: "Mystery", scale: "Traditional" });
    const classic = horse({ id: "classic", name: "Little", breed: "Arabian", scale: "Classic" });

    it("a class that names a breed: match fits, other breed and no breed are maybes with a hint", () => {
        const l = buildEntrantLedger({ divisions: division([{ id: "c1", name: "Arabian", number: "101" }]), myEntries: [], horses: [arab, morgan, noBreed] });
        const c = l.byClass.c1;
        expect(c.breedNamed).toBe(true);
        expect(c.fits).toEqual(["arab"]);
        expect(c.maybe).toEqual(["morgan", "nb"]);
        expect(c.blocked).toEqual([]);
        const by = Object.fromEntries(c.verdicts.map((v) => [v.horseId, v]));
        expect(by.morgan.hint).toBe("Listed as Morgan");
        expect(by.nb.hint).toBe("Breed not set on this horse");
        expect(by.arab.hint).toBeNull();
    });

    it("a class that names no breed: every clean horse fits", () => {
        const l = buildEntrantLedger({ divisions: division([{ id: "c1", name: "Fall & Creative Scenes", number: "109" }]), myEntries: [], horses: [arab, morgan, noBreed] });
        expect(l.byClass.c1.breedNamed).toBe(false);
        expect(l.byClass.c1.fits).toEqual(["arab", "morgan", "nb"]);
        expect(l.byClass.c1.maybe).toEqual([]);
    });

    it("scale and finish doubts are maybes; certain refusals are blocked", () => {
        const l = buildEntrantLedger({
            divisions: division([
                { id: "c1", name: "Arabian", number: "101", allowedScales: ["Traditional (1:9)"] },
                { id: "c2", name: "Morgan", number: "103" },
            ]),
            myEntries: [entry("c2", "morgan")],
            horses: [arab, morgan, classic],
        });
        const c1 = l.byClass.c1;
        expect(c1.fits).toEqual(["arab"]); // "Traditional" fits "Traditional (1:9)"
        expect(c1.maybe).toEqual(["classic"]); // scale doubt
        expect(c1.blocked).toEqual(["morgan"]); // already in halter as 103 · Morgan
        const by = Object.fromEntries(c1.verdicts.map((v) => [v.horseId, v]));
        expect(by.morgan.tier).toBe("blocked");
        expect(by.morgan.reason).toBe("In halter as 103 · Morgan");
        expect(by.classic.tier).toBe("maybe");
        expect(by.classic.reason).toMatch(/this horse is Classic/);
    });

    it("classNamesBreed recognises breed words and ignores generic ones", () => {
        expect(classNamesBreed("101 Arabian", BREEDS)).toBe(true);
        expect(classNamesBreed("Thoroughbred/Standardbred", BREEDS)).toBe(true);
        expect(classNamesBreed("Other Light/Gaited", BREEDS)).toBe(false);
        expect(classNamesBreed("Vintage (Pre-1990)", BREEDS)).toBe(false);
        expect(classNamesBreed("", BREEDS)).toBe(false);
    });
});
