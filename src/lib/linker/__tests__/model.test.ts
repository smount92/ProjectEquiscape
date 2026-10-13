import { describe, expect, it } from "vitest";
import {
    collapseSetPieces,
    commonOne,
    generationOf,
    identityLine,
    linkedLabel,
    markAmbiguous,
    mentionsMold,
    missingFacts,
    normalizeTerm,
    orderReleases,
    parseTerm,
    scaleMatches,
    setLabel,
    splitNumberFromTitle,
    stripGeneration,
    yearsLabel,
    type LinkerRelease,
} from "@/lib/linker/model";

function rel(over: Partial<LinkerRelease> & { id: string }): LinkerRelease {
    return { title: over.id, model: null, look: null, from: null, to: null, run: null, setName: null, isSetPiece: false, photo: null, scale: null, ...over };
}

describe("linker model", () => {
    it("reads a model number with or without a hash, and everything else as text", () => {
        expect(parseTerm("5022")).toEqual({ kind: "number", value: "5022" });
        expect(parseTerm("#5022")).toEqual({ kind: "number", value: "5022" });
        expect(parseTerm("B-EV-10722")).toEqual({ kind: "text", value: "B-EV-10722" });
        expect(parseTerm("Silky Sullivan")).toEqual({ kind: "text", value: "Silky Sullivan" });
        expect(parseTerm("  ")).toEqual({ kind: "empty", value: "" });
        expect(parseTerm("12")).toEqual({ kind: "text", value: "12" });
    });

    it("finds and strips a generation token", () => {
        expect(generationOf("Silky Sullivan (G1)")).toBe("G1");
        expect(generationOf("G1 Silky Sullivan")).toBe("G1");
        expect(generationOf("Thoroughbred (G2)")).toBe("G2");
        expect(generationOf("Silky Sullivan")).toBeNull();
        expect(stripGeneration("G1 Silky Sullivan")).toBe("Silky Sullivan");
        expect(stripGeneration("Morgan Stallion (G1)")).toBe("Morgan Stallion");
        expect(normalizeTerm("SM G1 Silky")).toBe("Silky");
    });

    it("prints one identity line and marks molds that share it", () => {
        const sm = { title: "Silky Sullivan", maker: "Breyer", scale: "Stablemate (1:32)", generation: null, sculptor: null, year: 1976 };
        expect(identityLine(sm)).toBe("Breyer · Stablemate · 1976");
        expect(identityLine({ ...sm, generation: "G1", sculptor: "Maureen Love" })).toBe("Breyer · Stablemate G1 · Maureen Love · 1976");
        const marked = markAmbiguous([sm, { ...sm }, { ...sm, scale: "Classic (1:12)", year: 1975 }]);
        expect(marked.map((m) => m.ambiguous)).toEqual([true, true, false]);
    });

    it("recognises set titles and which mold a set names", () => {
        const t = "12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Silky Sullivan, Swaps.";
        expect(setLabel(t)).toBe("12-Piece Stablemates Set");
        expect(setLabel("Andrew")).toBeNull();
        expect(setLabel("Classic Racehorse 3-Piece Set With Man O' War, Terrang")).toBe("Classic Racehorse 3-Piece Set");
        expect(mentionsMold(t, "Arabian Mare")).toBe(true);
        expect(mentionsMold(t, "Silky Sullivan")).toBe(true);
        expect(mentionsMold(t, "Proud Arabian Mare")).toBe(false);
        expect(mentionsMold("Arabian Mare and Foal Set With Proud Arabian Foal", "Arabian Mare")).toBe(false);
    });

    it("labels years and names the missing facts", () => {
        expect(yearsLabel({ from: 1976, to: 1988 })).toBe("1976–1988");
        expect(yearsLabel({ from: 2001, to: null })).toBe("2001–");
        expect(yearsLabel({ from: null, to: 1997 })).toBe("–1997");
        expect(yearsLabel({ from: null, to: null })).toBeNull();
        expect(missingFacts({ look: null, from: null, to: null, model: "5022" })).toEqual(["colour", "year"]);
        expect(missingFacts({ look: "bay", from: 1990, to: null, model: null })).toEqual(["model number"]);
    });

    it("orders singles before set pieces, known colours first, the regular run on top", () => {
        const ordered = orderReleases([
            rel({ id: "set", setName: "JCPenney set", look: "grey", model: "711096" }),
            rel({ id: "nocolour", model: "999" }),
            rel({ id: "later", look: "bay", model: "259", from: 1993 }),
            rel({ id: "regular", look: "chestnut", model: "5022", run: "Regular Run", from: 1976 }),
            rel({ id: "early", look: "black", model: "253", from: 1991 }),
            rel({ id: "nonumber", look: "dun", from: 1980 }),
        ]);
        expect(ordered.map((r) => r.id)).toEqual(["regular", "early", "later", "nonumber", "nocolour", "set"]);
        // A release whose own name was typed leads its group, even a set piece.
        const withHit = orderReleases([rel({ id: "regular", look: "chestnut", run: "Regular Run" }), rel({ id: "named", look: "bay", hit: true, setName: "Gift set" })]);
        expect(withHit.map((r) => r.id)).toEqual(["named", "regular"]);
        expect(commonOne([rel({ id: "hit", look: "bay", model: "9", hit: true }), rel({ id: "first", look: "grey", model: "1", from: 1980 })])).toBe("first");
        expect(commonOne(ordered)).toBe("regular");
        expect(commonOne([rel({ id: "a", look: "bay", model: "1" }), rel({ id: "b" })])).toBe("a");
        expect(commonOne([rel({ id: "b" })])).toBeNull();
    });

    it("collapses the same set number into one row and counts the copies", () => {
        const rows = collapseSetPieces([
            rel({ id: "a", model: "495600", setName: "Stablemates Assortment", isSetPiece: true }),
            rel({ id: "b", model: "495600", setName: "Stablemate Assortment", isSetPiece: true }),
            rel({ id: "c", model: "495600", setName: "Stablemates Assortment", isSetPiece: true }),
            rel({ id: "d", model: "495601", setName: "Stablemates Assortment II", isSetPiece: true }),
            rel({ id: "e", model: "5022", look: "chestnut" }),
        ]);
        expect(rows.map((r) => r.id)).toEqual(["a", "d", "e"]);
        expect(rows[0].copies).toBe(3);
        expect(rows[1].copies).toBeUndefined();
    });

    it("matches scale chips", () => {
        expect(scaleMatches("Stablemate (1:32)", "Stablemate (1:32)")).toBe(true);
        expect(scaleMatches("Classic (1:12)", "Stablemate (1:32)")).toBe(false);
        expect(scaleMatches(null, "any")).toBe(true);
        expect(scaleMatches(null, "Classic (1:12)")).toBe(false);
    });

    it("words the linked banner and splits a number out of a typed title", () => {
        const mold = { title: "Silky Sullivan", scale: "Stablemate (1:32)", generation: "G1" };
        expect(linkedLabel(mold, null)).toBe("Silky Sullivan (Stablemate G1), mold only");
        expect(linkedLabel(mold, rel({ id: "r", model: "5022", look: "dark chestnut" }))).toBe("Silky Sullivan (Stablemate G1) · #5022 · dark chestnut");
        expect(splitNumberFromTitle("#5022 Silky Sullivan")).toEqual({ title: "Silky Sullivan", model: "5022" });
        expect(splitNumberFromTitle("Andrew")).toEqual({ title: "Andrew", model: null });
    });
});
