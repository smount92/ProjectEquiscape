import { describe, expect, it } from "vitest";
import {
    collapseSetPieces,
    commonOne,
    factCorrection,
    generationOf,
    identityLine,
    linkedLabel,
    markAmbiguous,
    mentionsMold,
    missingFacts,
    normalizeTerm,
    orderReleases,
    parseTerm,
    releaseName,
    releaseYearFields,
    rosterPrefilterPatterns,
    rosterPrefilterWords,
    scaleMatches,
    setLabel,
    splitNumberFromTitle,
    stripGeneration,
    yearFactChanges,
    yearsLabel,
    type LinkerRelease,
} from "@/lib/linker/model";

function rel(over: Partial<LinkerRelease> & { id: string }): LinkerRelease {
    return {
        title: over.id,
        model: null,
        look: null,
        from: null,
        to: null,
        run: null,
        setName: null,
        isSetPiece: false,
        photo: null,
        scale: null,
        ...over,
    };
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
        const sm = {
            title: "Silky Sullivan",
            maker: "Breyer",
            scale: "Stablemate (1:32)",
            generation: null,
            sculptor: null,
            year: 1976,
        };
        expect(identityLine(sm)).toBe("Breyer · Stablemate · 1976");
        expect(identityLine({ ...sm, generation: "G1", sculptor: "Maureen Love" })).toBe(
            "Breyer · Stablemate G1 · Maureen Love · 1976",
        );
        const marked = markAmbiguous([sm, { ...sm }, { ...sm, scale: "Classic (1:12)", year: 1975 }]);
        expect(marked.map((m) => m.ambiguous)).toEqual([true, true, false]);
    });

    it("recognises set titles and which mold a set names", () => {
        const t = "12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Silky Sullivan, Swaps.";
        expect(setLabel(t)).toBe("12-Piece Stablemates Set");
        expect(setLabel("Andrew")).toBeNull();
        expect(setLabel("Classic Racehorse 3-Piece Set With Man O' War, Terrang")).toBe(
            "Classic Racehorse 3-Piece Set",
        );
        expect(mentionsMold(t, "Arabian Mare")).toBe(true);
        expect(mentionsMold(t, "Silky Sullivan")).toBe(true);
        expect(mentionsMold(t, "Proud Arabian Mare")).toBe(false);
        expect(mentionsMold("Arabian Mare and Foal Set With Proud Arabian Foal", "Arabian Mare")).toBe(false);
        // A capitalised roster names a mold; a lowercase accessory does not (MHH-068).
        expect(mentionsMold("Panuhu and Honego, Foal With Rojo", "Rojo")).toBe(true);
        expect(mentionsMold("Clydesdale Gift Set With Clydesdale Mare, green foal blanket", "Foal")).toBe(false);
        expect(mentionsMold("Unicorn Set With unicorn halter and Unicorn", "Unicorn")).toBe(true);
        expect(mentionsMold("Dress-Up Set With unicorn halter", "Unicorn")).toBe(false);
    });

    it("matches a whole piece name, never a mold name inside a longer one (MHH-074)", () => {
        // Live titles from the Stablemate Saddlebred mold, 2026-10-16.
        const twelve =
            "12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, American Saddlebred, Swaps.";
        expect(mentionsMold(twelve, "Saddlebred")).toBe(false);
        expect(mentionsMold(twelve, "American Saddlebred")).toBe(true);
        expect(mentionsMold(twelve, "Swaps")).toBe(true);
        expect(mentionsMold(twelve, "Arabian")).toBe(false);
        expect(
            mentionsMold(
                "The Mod Squad On keychain. With Appaloosa, Rearing Arabian, Draft Horse, Saddlebred.",
                "Saddlebred",
            ),
        ).toBe(true);
        expect(
            mentionsMold(
                "Wooden Carry Stable with Horses With American Saddlebred (2), Andalusian (2), Standing Stock Horse (2)",
                "Andalusian",
            ),
        ).toBe(true);
        expect(
            mentionsMold(
                "Wooden Carry Stable with Horses With American Saddlebred (2), Andalusian (2), Standing Stock Horse (2)",
                "Saddlebred",
            ),
        ).toBe(false);
        expect(
            mentionsMold("Four Piece Gift Pack With American Saddlebred, Clydesdale, Thoroughbred", "Saddlebred"),
        ).toBe(false);
        expect(
            mentionsMold(
                '"Horspital" Play Set With American Saddlebred, blankets, corral fencing',
                "American Saddlebred",
            ),
        ).toBe(true);
        // Pieces split on commas, "&" and "and"; the same words in another order are the same piece.
        expect(
            mentionsMold("Polka Dot Parade With American Saddlebred, Morgan - Prancing, Warmblood", "Prancing Morgan"),
        ).toBe(true);
        expect(mentionsMold("Stablemate Keychain With Arabian-Rearing, American Saddlebred", "Rearing Arabian")).toBe(
            true,
        );
        expect(mentionsMold("Pony Pals With Shetland Pony & Welsh Pony", "Welsh Pony")).toBe(true);
        expect(mentionsMold("Pony Pals With Shetland Pony and Welsh Pony", "Shetland Pony")).toBe(true);
        expect(mentionsMold("Pony Pals With Shetland Pony and Welsh Pony", "Pony")).toBe(false);
        // The title before "With" is the set's own name, not a piece.
        expect(mentionsMold("Panuhu and Honego, Foal With Rojo", "Foal")).toBe(false);
        // A note after the roster is not a piece.
        expect(
            mentionsMold(
                "Horspital Play Set With American Saddlebred, replaced by Scrambling Foal in 2006",
                "Scrambling Foal",
            ),
        ).toBe(false);
    });

    it("lists the words a roster search must contain, for the database prefilter", () => {
        expect(rosterPrefilterWords("Man O' War")).toEqual(["Man", "War"]);
        expect(rosterPrefilterWords("Morgan Stallion (G1)")).toEqual(["Morgan", "Stallion"]);
        expect(rosterPrefilterWords("Saddlebred")).toEqual(["Saddlebred"]);
    });

    it("anchors each prefilter word after 'with', where the roster is (review of MHH-074)", () => {
        expect(rosterPrefilterPatterns("Saddlebred")).toEqual(["%with%Saddlebred%"]);
        expect(rosterPrefilterPatterns("Morgan Stallion (G1)")).toEqual(["%with%Morgan%", "%with%Stallion%"]);
        // LIKE wildcards in a name never reach the pattern.
        expect(rosterPrefilterPatterns("Pinto_100%")).toEqual(["%with%Pinto%", "%with%100%"]);
        expect(rosterPrefilterPatterns("Man O' War")).toEqual(["%with%Man%", "%with%War%"]);
    });

    it("reads a mold whose own name holds 'and' or '&' as one piece (review of MHH-074)", () => {
        const t = "Set With Mare and Foal, Stallion";
        expect(mentionsMold(t, "Mare and Foal")).toBe(true);
        expect(mentionsMold(t, "Mare & Foal")).toBe(true);
        expect(mentionsMold(t, "Stallion")).toBe(true);
        expect(mentionsMold("Set With Mare & Foal, Stallion", "Mare and Foal")).toBe(true);
        // Only pieces joined by "and" or "&" are read together, never across a comma.
        expect(mentionsMold("Set With Mare, Foal, Stallion", "Mare and Foal")).toBe(false);
        expect(mentionsMold(t, "Foal Stallion")).toBe(false);
        // The earlier cases still hold.
        const twelve =
            "12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, American Saddlebred & Swaps.";
        expect(mentionsMold(twelve, "American Saddlebred")).toBe(true);
        expect(mentionsMold(twelve, "Saddlebred")).toBe(false);
        expect(mentionsMold(twelve, "Swaps")).toBe(true);
        expect(mentionsMold("Pony Pals With Shetland Pony and Welsh Pony", "Shetland Pony")).toBe(true);
        expect(mentionsMold("Pony Pals With Shetland Pony and Welsh Pony", "Pony")).toBe(false);
    });

    it("labels years and names the missing facts", () => {
        expect(yearsLabel({ from: 1976, to: 1988 })).toBe("1976–1988");
        expect(yearsLabel({ from: 2001, to: null })).toBe("2001");
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
        const withHit = orderReleases([
            rel({ id: "regular", look: "chestnut", run: "Regular Run" }),
            rel({ id: "named", look: "bay", hit: true, setName: "Gift set" }),
        ]);
        expect(withHit.map((r) => r.id)).toEqual(["named", "regular"]);
        expect(
            commonOne([
                rel({ id: "hit", look: "bay", model: "9", hit: true }),
                rel({ id: "first", look: "grey", model: "1", from: 1980 }),
            ]),
        ).toBe("first");
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

    it("files a fact as a from/to correction with strings on both sides", () => {
        expect(factCorrection("color_description", undefined, " dark bay ")).toEqual({
            color_description: { from: "", to: "dark bay" },
        });
        expect(factCorrection("release_year_start", 1976, "1988")).toEqual({
            release_year_start: { from: "1976", to: "1988" },
        });
        expect(factCorrection("model_number", null, "#5022")).toEqual({ model_number: { from: "", to: "5022" } });
    });

    it("files a typed year range as both year fields, and says why a bad one is refused (MHH-077)", () => {
        expect(yearFactChanges("1995-1997", {})).toEqual({
            ok: true,
            changes: {
                release_year_start: { from: "", to: "1995" },
                release_year_end: { from: "", to: "1997" },
            },
        });
        expect(yearFactChanges("1995–97", { release_year_start: 1994 })).toEqual({
            ok: true,
            changes: {
                release_year_start: { from: "1994", to: "1995" },
                release_year_end: { from: "", to: "1997" },
            },
        });
        expect(yearFactChanges("1998", {})).toEqual({
            ok: true,
            changes: { release_year_start: { from: "", to: "1998" } },
        });
        expect(yearFactChanges("1997-1995", {})).toMatchObject({ ok: false, error: expect.stringMatching(/before/) });
        // "Add my release": the end year is no longer dropped.
        expect(releaseYearFields("1995 to 1997")).toEqual({ ok: true, fields: { year: 1995, year_end: 1997 } });
        expect(releaseYearFields("1976")).toEqual({ ok: true, fields: { year: 1976 } });
        expect(releaseYearFields("  ")).toEqual({ ok: true, fields: {} });
        expect(releaseYearFields("70s")).toMatchObject({ ok: false });
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
        expect(linkedLabel(mold, rel({ id: "r", title: "Silky Sullivan", model: "5022", look: "dark chestnut" }))).toBe(
            "Silky Sullivan (Stablemate G1) · #5022 · dark chestnut",
        );
        expect(
            linkedLabel(mold, rel({ id: "r", title: "Montana Harvest", model: "1142", look: "dapple buckskin" })),
        ).toBe("Silky Sullivan (Stablemate G1) · #1142 · Montana Harvest · dapple buckskin");
        expect(releaseName(rel({ id: "r", title: "#5022 Silky Sullivan" }), "Silky Sullivan")).toBeNull();
        expect(releaseName(rel({ id: "r", title: "T-Bone" }), "Silky Sullivan")).toBe("T-Bone");
        expect(
            releaseName(rel({ id: "r", title: "Gift set With Kelso", setName: "Gift set" }), "Silky Sullivan"),
        ).toBeNull();
        expect(splitNumberFromTitle("#5022 Silky Sullivan")).toEqual({ title: "Silky Sullivan", model: "5022" });
        expect(splitNumberFromTitle("Andrew")).toEqual({ title: "Andrew", model: null });
    });
});
