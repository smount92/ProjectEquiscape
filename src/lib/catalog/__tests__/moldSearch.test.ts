import { describe, expect, it } from "vitest";
import { namedMolds, placeReleasesUnderMolds, searchName, termImpliesStablemate } from "@/lib/catalog/moldSearch";

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
});
