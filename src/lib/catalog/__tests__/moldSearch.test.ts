import { describe, expect, it } from "vitest";
import {
    matchKind,
    namedMolds,
    placeReleasesUnderMolds,
    rosterLast,
    searchName,
    termImpliesStablemate,
} from "@/lib/catalog/moldSearch";

describe("moldSearch", () => {
    it("reads the mold name out of what a collector types", () => {
        expect(searchName("G1 Arabian Stallion")).toBe("Arabian Stallion");
        expect(searchName("SM Arabian Stallion")).toBe("Arabian Stallion");
        expect(searchName("Silky Sullivan (G1)")).toBe("Silky Sullivan");
        expect(searchName("Classic Arabian Family")).toBe("Classic Arabian Family");
        expect(termImpliesStablemate("G1 Arabian Stallion")).toBe(true);
        expect(termImpliesStablemate("sm silky")).toBe(true);
        expect(termImpliesStablemate("Arabian Stallion")).toBe(false);
        expect(termImpliesStablemate("Gigi")).toBe(false);
    });

    it("finds only molds whose own name is the searched name", () => {
        const rows = [
            { id: "pp", item_type: "plastic_mold", title: "Arabian Stallion", scale: "Paddock Pal (1:24)" },
            { id: "sm", item_type: "plastic_mold", title: "Arabian Stallion", scale: "Stablemate (1:32)" },
            { id: "proud", item_type: "plastic_mold", title: "Proud Arabian Stallion", scale: "Traditional (1:9)" },
            { id: "r1", item_type: "plastic_release", title: "Arabian Stallion", scale: "Classic (1:12)" },
        ];
        expect(namedMolds(rows, "Arabian Stallion").map((r) => r.id)).toEqual(["pp", "sm"]);
        expect(namedMolds(rows, "")).toEqual([]);
        // However it is punctuated or ordered (MHH-080).
        const morgan = [{ id: "pm", item_type: "plastic_mold", title: "Prancing Morgan", scale: "Stablemate (1:32)" }];
        expect(namedMolds(morgan, "Morgan - Prancing").map((r) => r.id)).toEqual(["pm"]);
        expect(namedMolds(rows, "arabian-stallion").map((r) => r.id)).toEqual(["pp", "sm"]);
    });

    it("places each named mold's releases right under it, moves loose ones up, and keeps the rest in order", () => {
        const candidates = [
            { id: "schleich", item_type: "plastic_release", title: "Arabian Stallion" },
            { id: "pp", item_type: "plastic_mold", title: "Arabian Stallion", scale: "Paddock Pal (1:24)" },
            { id: "r5010", item_type: "plastic_release", title: "#5010 Arabian Stallion" },
            { id: "sm", item_type: "plastic_mold", title: "Arabian Stallion", scale: "Stablemate (1:32)" },
            { id: "proud", item_type: "plastic_mold", title: "Proud Arabian Stallion" },
        ];
        const kids = new Map([
            ["pp", []],
            ["sm", ["r5010", "sultan", "emperor"]],
        ]);
        expect(placeReleasesUnderMolds(candidates, kids)).toEqual([
            "schleich",
            "pp",
            "sm",
            "r5010",
            "sultan",
            "emperor",
            "proud",
        ]);
        expect(placeReleasesUnderMolds(candidates, kids, { preferStablemate: true })).toEqual([
            "sm",
            "r5010",
            "sultan",
            "emperor",
            "schleich",
            "pp",
            "proud",
        ]);
        expect(placeReleasesUnderMolds(candidates, kids, { limit: 3 })).toEqual(["schleich", "pp", "sm"]);
    });

    it("tells a row's own match from a match only inside a set's roster (MHH-075)", () => {
        // Live rows for "Arabian Stallion", 2026-10-16.
        expect(matchKind({ title: "Arabian Stallion", parent_title: null }, "Arabian Stallion")).toBe("own");
        expect(matchKind({ title: "Sultan", parent_title: "Arabian Stallion" }, "Arabian Stallion")).toBe("own");
        expect(
            matchKind(
                {
                    title: "12-Piece Stablemates Set With Arabian Stallion, Citation, Draft Horse",
                    parent_title: "Arabian Stallion",
                },
                "Arabian Stallion",
            ),
        ).toBe("own");
        expect(
            matchKind(
                {
                    title: "Stablemates Assortment With Arabian Mare, Arabian Stallion, Citation",
                    parent_title: "Citation",
                },
                "Arabian Stallion",
            ),
        ).toBe("roster");
        expect(matchKind({ title: "Proud Arabian Mare", parent_title: null }, "Arabian Stallion")).toBe("other");
        expect(matchKind({ title: "Stallion", parent_title: "Morgan Stallion (G1)" }, "Morgan Stallion")).toBe("own");
    });

    it("calls a row a roster match only when one piece holds every typed word (review of MHH-075)", () => {
        // Every word is in the title, but in two different pieces: this set does not include a Morgan Stallion.
        expect(
            matchKind(
                { title: "Set With Morgan Mare, Arabian Stallion", parent_title: "Arabian Stallion" },
                "Morgan Stallion",
            ),
        ).toBe("other");
        expect(
            matchKind({ title: "Set With Morgan Mare and Arabian Stallion", parent_title: null }, "Morgan Stallion"),
        ).toBe("other");
        expect(
            matchKind({ title: "Set With Morgan Stallion (G1), Swaps", parent_title: "Swaps" }, "Morgan Stallion"),
        ).toBe("roster");
        // A piece whose own name holds "and" is still found when the member typed it.
        expect(matchKind({ title: "Set With Mare and Foal, Stallion", parent_title: null }, "Mare and Foal")).toBe(
            "roster",
        );
        // The set's own name before "With" is the row's own match, as before.
        expect(matchKind({ title: "Morgan Stallion Set With Swaps", parent_title: null }, "Morgan Stallion")).toBe(
            "own",
        );
    });

    it("moves roster-only rows after everything else and keeps each band's order", () => {
        const rows = [
            {
                id: "set1",
                title: "Stablemates Assortment With Arabian Mare, Arabian Stallion",
                parent_title: "Arabian Mare",
            },
            { id: "mold", title: "Arabian Stallion", parent_title: null },
            { id: "set2", title: "Gift Set With Arabian Stallion, Swaps", parent_title: "Swaps" },
            { id: "near", title: "Arabian Mare", parent_title: null },
            { id: "kid", title: "Sultan", parent_title: "Arabian Stallion" },
        ];
        expect(rosterLast(["set1", "mold", "kid", "set2", "near"], rows, "Arabian Stallion")).toEqual([
            "mold",
            "kid",
            "near",
            "set1",
            "set2",
        ]);
        // An id the candidate rows do not describe (a release placed under a named mold) keeps its place.
        expect(rosterLast(["set1", "mold", "x"], rows, "Arabian Stallion")).toEqual(["mold", "x", "set1"]);
    });
});
