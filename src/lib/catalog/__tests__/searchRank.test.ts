import { describe, expect, it } from "vitest";
import { applyTypeFilter, rankSearchResults } from "@/lib/catalog/searchRank";

const item = (title: string, itemType: string) => ({ title, itemType });

describe("rankSearchResults", () => {
    // Amanda's actual report, 2026-08-27: searching "Rising Hopes"
    // put the exact-match resin second to last, below every fuzzy
    // Breyer release, because the old UI sectioned resins last.
    it("puts an exact title match first even when it is a resin below many releases", () => {
        const results = [
            item("Rising Sun", "plastic_release"),
            item("Rising Star", "plastic_release"),
            item("High Hopes", "plastic_mold"),
            item("Rising Hopes", "artist_resin"),
            item("Hope Rising", "plastic_release"),
        ];
        const ranked = rankSearchResults(results, "rising hopes");
        expect(ranked[0].title).toBe("Rising Hopes");
    });

    it("ranks prefix matches above similarity-only matches", () => {
        const results = [
            item("Hope Rising", "plastic_release"),
            item("Rising Hopes and Dreams", "artist_resin"),
        ];
        const ranked = rankSearchResults(results, "rising hopes");
        expect(ranked[0].title).toBe("Rising Hopes and Dreams");
    });

    it("floats finish-matching types within a tier without hiding anything", () => {
        const results = [
            item("Dream Weaver", "plastic_release"),
            item("Dream Weaver", "artist_resin"),
        ];
        const forResin = rankSearchResults(results, "dream", "Artist Resin");
        expect(forResin[0].itemType).toBe("artist_resin");
        expect(forResin).toHaveLength(2);
        const forOF = rankSearchResults(results, "dream", "OF");
        expect(forOF[0].itemType).toBe("plastic_release");
    });

    it("keeps the RPC similarity order where tiers and affinity tie", () => {
        const results = [item("Alpha Dream", "plastic_release"), item("Dreaming Alpha", "plastic_release")];
        const ranked = rankSearchResults(results, "zzz-no-match", "OF");
        expect(ranked.map((r) => r.title)).toEqual(["Alpha Dream", "Dreaming Alpha"]);
    });

    it("customs point at plastic — the base mold is the link target", () => {
        const results = [item("Ideal Stock Horse", "artist_resin"), item("Ideal Stock Horse", "plastic_mold")];
        const ranked = rankSearchResults(results, "ideal stock horse", "Custom");
        expect(ranked[0].itemType).toBe("plastic_mold");
    });
});

describe("applyTypeFilter", () => {
    const results = [
        item("A", "plastic_release"),
        item("B", "artist_resin"),
        item("C", "micro_mini"),
        item("D", "china"),
    ];
    it("'all' passes every type through — nothing is silently dropped", () => {
        expect(applyTypeFilter(results, "all")).toHaveLength(4);
    });
    it("'resin' keeps resin-family types including micro minis", () => {
        expect(applyTypeFilter(results, "resin").map((r) => r.title)).toEqual(["B", "C"]);
    });
    it("'of' keeps plastic and china", () => {
        expect(applyTypeFilter(results, "of").map((r) => r.title)).toEqual(["A", "D"]);
    });
});
