import { describe, it, expect } from "vitest";

import {
    attachLoad,
    groupDuplicates,
    isPlaceholderMaker,
    looksGuessedMaker,
    normalizeCatalogText,
    MAX_GROUP_MEMBERS,
    type DuplicateCandidate,
    type ItemLoad,
} from "@/lib/admin/catalogDuplicates";

/**
 * The sweeper's whole job is to find rows the broken legacy approve
 * path minted: identical title, identical item_type, and a maker
 * GUESSED from a free-text details field. These tests pin the two
 * things that make it useful — the grouping is loose enough to catch
 * the pathology, and the confidence tiers are honest enough that a
 * legitimate same-title-different-maker pair is never presented as a
 * certainty.
 */

function candidate(over: Partial<DuplicateCandidate> & { id: string }): DuplicateCandidate {
    return {
        title: "Stock Horse Stallion",
        maker: "Breyer",
        itemType: "plastic_mold",
        slug: null,
        createdAt: "2026-04-01T00:00:00Z",
        ...over,
    };
}

describe("normalizeCatalogText", () => {
    it("folds case, punctuation and whitespace", () => {
        expect(normalizeCatalogText("  Man O'War  ")).toBe("man o war");
        expect(normalizeCatalogText("MAN O WAR")).toBe("man o war");
        expect(normalizeCatalogText("Man-O-War")).toBe("man o war");
    });

    it("strips accents without a diacritics table", () => {
        expect(normalizeCatalogText("Pégase")).toBe("pegase");
    });

    it("answers empty for nothing at all", () => {
        expect(normalizeCatalogText(null)).toBe("");
        expect(normalizeCatalogText("   ")).toBe("");
        expect(normalizeCatalogText("!!!")).toBe("");
    });
});

describe("maker heuristics", () => {
    it("recognizes the placeholders the broken approve path wrote", () => {
        expect(isPlaceholderMaker("Unknown")).toBe(true);
        expect(isPlaceholderMaker("unknown")).toBe(true);
        expect(isPlaceholderMaker("N/A")).toBe(true);
        expect(isPlaceholderMaker("")).toBe(true);
        expect(isPlaceholderMaker(null)).toBe(true);
        expect(isPlaceholderMaker("Breyer")).toBe(false);
    });

    it("flags a maker that reads like free text rather than a name", () => {
        // makerGuess = details.split(/[,\n]/)[0] — this is what it produced.
        expect(looksGuessedMaker("Breyer 1988 release")).toBe(true);
        expect(looksGuessedMaker("a chestnut one my aunt gave me years ago")).toBe(true);
        expect(looksGuessedMaker("Unknown")).toBe(true);
        expect(looksGuessedMaker("Breyer")).toBe(false);
        expect(looksGuessedMaker("Peter Stone")).toBe(false);
        expect(looksGuessedMaker("Sarah Rose Minkiewicz-Breunig")).toBe(false);
    });
});

describe("groupDuplicates", () => {
    it("groups on normalized title + item_type and drops singletons", () => {
        const { groups, totalGroups } = groupDuplicates([
            candidate({ id: "a", title: "Stock Horse Stallion" }),
            candidate({ id: "b", title: "  stock horse stallion " }),
            candidate({ id: "c", title: "Something Else" }),
        ]);

        expect(totalGroups).toBe(1);
        expect(groups).toHaveLength(1);
        expect(groups[0].members.map((m) => m.id).sort()).toEqual(["a", "b"]);
    });

    it("never groups across item_type — a mold and a release are different things", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "a", itemType: "plastic_mold" }),
            candidate({ id: "b", itemType: "plastic_release" }),
        ]);
        expect(groups).toHaveLength(0);
    });

    it("still groups when the makers disagree — that IS the bug's fingerprint", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "a", maker: "Breyer" }),
            candidate({ id: "b", maker: "Unknown" }),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].confidence).toBe("placeholder-maker");
    });

    it("calls an identical-maker group near-certain", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "a", maker: "Breyer" }),
            candidate({ id: "b", maker: "breyer " }),
        ]);
        expect(groups[0].confidence).toBe("same-maker");
    });

    it("does not pretend two real makers are a duplicate", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "a", title: "Arabian Stallion", maker: "Breyer" }),
            candidate({ id: "b", title: "Arabian Stallion", maker: "Peter Stone" }),
        ]);
        expect(groups[0].confidence).toBe("different-maker");
    });

    it("ignores untitled rows — they would group with each other and mean nothing", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "a", title: "" }),
            candidate({ id: "b", title: "   " }),
        ]);
        expect(groups).toHaveLength(0);
    });

    it("orders by confidence first, then by how big the pile-up is", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "d1", title: "Different Makers", maker: "Breyer" }),
            candidate({ id: "d2", title: "Different Makers", maker: "Peter Stone" }),
            candidate({ id: "s1", title: "Same Maker", maker: "Breyer" }),
            candidate({ id: "s2", title: "Same Maker", maker: "Breyer" }),
        ]);
        expect(groups.map((g) => g.confidence)).toEqual(["same-maker", "different-maker"]);
    });

    it("reports the honest total when it hands back a capped slice", () => {
        const rows: DuplicateCandidate[] = [];
        for (let i = 0; i < 8; i++) {
            rows.push(candidate({ id: `${i}-a`, title: `Title ${i}` }));
            rows.push(candidate({ id: `${i}-b`, title: `Title ${i}` }));
        }
        const { groups, totalGroups } = groupDuplicates(rows, 3);
        expect(groups).toHaveLength(3);
        expect(totalGroups).toBe(8);
    });

    it("truncates a huge group but still counts every member", () => {
        const rows = Array.from({ length: MAX_GROUP_MEMBERS + 7 }, (_, i) =>
            candidate({ id: `dup-${i}`, createdAt: `2026-04-0${(i % 9) + 1}T00:00:00Z` }),
        );
        const { groups } = groupDuplicates(rows);
        expect(groups[0].totalMembers).toBe(MAX_GROUP_MEMBERS + 7);
        expect(groups[0].members).toHaveLength(MAX_GROUP_MEMBERS);
    });
});

describe("attachLoad — the suggested merge direction", () => {
    const load = (over: Partial<ItemLoad> = {}): ItemLoad => ({
        horses: 0,
        wishlists: 0,
        otherRefs: 0,
        ...over,
    });

    it("keeps the row carrying the most references", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "light", createdAt: "2026-01-01T00:00:00Z" }),
            candidate({ id: "loaded", createdAt: "2026-05-01T00:00:00Z" }),
        ]);
        const [group] = attachLoad(
            groups,
            new Map([
                ["light", load({ horses: 1 })],
                ["loaded", load({ horses: 9, wishlists: 2 })],
            ]),
        );

        expect(group.members.find((m) => m.keeper)?.id).toBe("loaded");
        expect(group.members.find((m) => m.id === "loaded")?.totalRefs).toBe(11);
        expect(group.members.filter((m) => m.keeper)).toHaveLength(1);
    });

    it("breaks a load tie in favour of the row with a real maker", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "guessed", maker: "Unknown", createdAt: "2026-01-01T00:00:00Z" }),
            candidate({ id: "real", maker: "Breyer", createdAt: "2026-05-01T00:00:00Z" }),
        ]);
        const [group] = attachLoad(groups, new Map());

        expect(group.members.find((m) => m.keeper)?.id).toBe("real");
        expect(group.members.find((m) => m.id === "guessed")?.makerLooksGuessed).toBe(true);
    });

    it("falls back to the oldest row — the one that predates the retry loop", () => {
        const { groups } = groupDuplicates([
            candidate({ id: "newer", createdAt: "2026-05-01T00:00:00Z" }),
            candidate({ id: "original", createdAt: "2026-01-01T00:00:00Z" }),
        ]);
        const [group] = attachLoad(groups, new Map());
        expect(group.members.find((m) => m.keeper)?.id).toBe("original");
    });

    it("treats an unknown id as zero load rather than throwing", () => {
        const { groups } = groupDuplicates([candidate({ id: "a" }), candidate({ id: "b" })]);
        const [group] = attachLoad(groups, new Map());
        expect(group.members.every((m) => m.totalRefs === 0)).toBe(true);
    });
});
