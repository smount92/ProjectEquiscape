import { describe, it, expect } from "vitest";
import {
    buildNumberIndex,
    extractModelNumbers,
    isAmbiguousNumber,
    isMatch,
    makerAppearsInTitle,
    matchListing,
    normalizeNumber,
    type MatchCandidate,
} from "@/lib/ebay/matching";

/* ──────────────────────────────────────────────────────
   Matching an eBay listing to a catalog entry.

   The bar these tests hold is precision, not coverage. A wrong comp puts
   a confident price on the wrong horse; a missing comp costs nothing. So
   most of what follows asserts that something is REFUSED.
   ────────────────────────────────────────────────────── */

const CATALOG: MatchCandidate[] = [
    { id: "alborozo", title: "Alborozo", maker: "Breyer", modelNumber: "712053", scale: "Traditional (1:9)" },
    { id: "notorious", title: "Notoriously Framed", maker: "Breyer", modelNumber: "712393", scale: "Traditional (1:9)" },
    { id: "fam-arab-85", title: "Family Arabian Mare", maker: "Breyer", modelNumber: "85", scale: "Traditional (1:9)" },
    { id: "nl-shire", title: "Large Shire", maker: "North Light", modelNumber: "NL220", scale: null },
    // One release, two finish variants — same model for pricing purposes.
    { id: "sr-matte", title: "Seize The Day Surprise", maker: "Breyer", modelNumber: "710469", scale: "Traditional (1:9)" },
    { id: "sr-glossy", title: "Seize The Day Surprise", maker: "Breyer", modelNumber: "710469", scale: "Traditional (1:9)" },
    // The import placeholder — 3 unrelated models under one number.
    { id: "ph-misty", title: "Bay Pinto Misty", maker: "Breyer", modelNumber: "430040", scale: "Traditional (1:9)" },
    { id: "ph-clyde", title: "Bay Roan Clydesdale Foal Test Piece", maker: "Breyer", modelNumber: "430040", scale: "Traditional (1:9)" },
    { id: "ph-spider", title: "Chestnut Stud Spider Test Piece", maker: "Breyer", modelNumber: "430040", scale: "Traditional (1:9)" },
];

const index = buildNumberIndex(CATALOG);

describe("reading a model number out of a listing title", () => {
    it("takes a long bare number", () => {
        expect(extractModelNumbers("Breyer Alborozo 712053 Traditional")).toContain("712053");
    });

    it("takes a number a human explicitly marked", () => {
        expect(extractModelNumbers("Breyer Family Arabian Mare #85")).toContain("85");
        expect(extractModelNumbers("Breyer FAM No. 85 alabaster")).toContain("85");
        expect(extractModelNumbers("Breyer model number 85")).toContain("85");
    });

    // The rule that stops this feature inventing prices at scale.
    it("REFUSES a short bare number, because listing titles are full of digits", () => {
        expect(extractModelNumbers("Breyer Family Arabian Mare 85")).not.toContain("85");
        expect(extractModelNumbers("Breyer horse 8.5 inches tall")).not.toContain("85");
        expect(extractModelNumbers("Breyer lot 3 horses 9 inch")).toEqual([]);
    });

    it("discards a bare four-digit number that is really a year", () => {
        expect(extractModelNumbers("Breyer Alborozo 2008 release")).not.toContain("2008");
        expect(extractModelNumbers("Vintage Breyer 1985 horse")).toEqual([]);
    });

    it("keeps a MARKED number even when it looks like a year", () => {
        // "#2016" is a person telling us the number.
        expect(extractModelNumbers("Breyer Stablemate #2016")).toContain("2016");
    });

    it("puts explicitly marked numbers ahead of bare ones", () => {
        const got = extractModelNumbers("Breyer #712053 in box 999999");
        expect(got[0]).toBe("712053");
    });

    it("normalizes hashes, case and spacing", () => {
        expect(normalizeNumber(" #712053 ")).toBe("712053");
        expect(normalizeNumber("nl220")).toBe("NL220");
    });
});

describe("the maker has to be named", () => {
    it("accepts the maker and its common spellings", () => {
        expect(makerAppearsInTitle("Breyer", "BREYER TRADITIONAL HORSE")).toBe(true);
        expect(makerAppearsInTitle("North Light", "Northlight Large Shire resin")).toBe(true);
        expect(makerAppearsInTitle("North Light", "North Light Shire")).toBe(true);
        expect(makerAppearsInTitle("Peter Stone", "Stone Ideal Stock Horse")).toBe(true);
    });

    it("rejects a listing that never names the maker", () => {
        expect(makerAppearsInTitle("Breyer", "Model horse 712053 traditional scale")).toBe(false);
    });

    it("is false for a null maker rather than throwing", () => {
        expect(makerAppearsInTitle(null, "Breyer anything")).toBe(false);
    });
});

describe("matching a listing", () => {
    it("matches on model number plus maker", () => {
        const out = matchListing({ title: "Breyer Alborozo 712053 Traditional Grey" }, index);
        expect(isMatch(out)).toBe(true);
        if (isMatch(out)) {
            expect(out.catalogId).toBe("alborozo");
            expect(out.basis).toBe("model-number-and-maker");
            expect(out.matchedNumber).toBe("712053");
        }
    });

    it("matches finish variants of one release, which are one model for pricing", () => {
        const out = matchListing({ title: "Breyer Seize The Day Surprise 710469" }, index);
        expect(isMatch(out)).toBe(true);
    });

    it("refuses when the number identifies unrelated models", () => {
        const out = matchListing({ title: "Breyer Bay Pinto Misty 430040" }, index);
        expect(isMatch(out)).toBe(false);
        if (!isMatch(out)) {
            expect(out.reason).toBe("ambiguous-multiple-rows");
            expect(out.candidates).toHaveLength(3);
        }
    });

    it("refuses when the maker is missing from the title", () => {
        const out = matchListing({ title: "Model horse 712053 grey traditional" }, index);
        expect(isMatch(out)).toBe(false);
        if (!isMatch(out)) expect(out.reason).toBe("maker-not-in-title");
    });

    it("refuses a listing with no usable number", () => {
        const out = matchListing({ title: "Breyer Traditional Bay Appaloosa Horse" }, index);
        expect(isMatch(out)).toBe(false);
        if (!isMatch(out)) expect(out.reason).toBe("no-model-number-in-listing");
    });

    it("refuses a number we do not hold", () => {
        const out = matchListing({ title: "Breyer Something 999123" }, index);
        expect(isMatch(out)).toBe(false);
        if (!isMatch(out)) expect(out.reason).toBe("no-catalog-row-for-number");
    });

    it("refuses an empty title instead of matching nothing to something", () => {
        expect(matchListing({ title: "" }, index)).toMatchObject({ reason: "empty-listing-title" });
    });
});

describe("listings that are not the original model", () => {
    // Each of these carries a REAL model number and would otherwise match.
    it.each([
        ["Breyer Alborozo 712053 CUSTOM repaint by artist", "not-the-original-model"],
        ["Breyer 712053 Alborozo CM custom", "not-the-original-model"],
        ["Breyer Alborozo 712053 BODY for custom", "not-the-original-model"],
        ["Breyer Alborozo 712053 damaged broken leg", "not-the-original-model"],
        ["Breyer Alborozo 712053 for parts repair", "not-the-original-model"],
        ["Breyer Alborozo 712053 BOX ONLY no horse", "not-the-original-model"],
        ["Breyer Alborozo 712053 reproduction", "not-the-original-model"],
        // The paper without the horse — a real $5 COA listing polluted
        // A Class Act's median the day the feature went live.
        ["Breyer Horse Certificate of Authenticity COA #700298 A Class Act", "not-the-original-model"],
        ["Breyer Alborozo 712053 COA only no model", "not-the-original-model"],
        ["Breyer Alborozo 712053 certificate only", "not-the-original-model"],
        ["Breyer Alborozo 712053 papers only", "not-the-original-model"],
        ["Lot of 5 Breyer horses 712053 and more", "multi-item-lot"],
        ["Breyer set of 3 horses 712053", "multi-item-lot"],
    ])("refuses %s", (title, reason) => {
        const out = matchListing({ title }, index);
        expect(isMatch(out)).toBe(false);
        if (!isMatch(out)) expect(out.reason).toBe(reason);
    });

    // A custom sells for wildly different money than the original. Pricing
    // an original against a custom comp misleads in the direction that
    // costs a collector real money.
    it("treats a custom as disqualifying even though its number is genuine", () => {
        const honest = matchListing({ title: "Breyer Alborozo 712053" }, index);
        const custom = matchListing({ title: "Breyer Alborozo 712053 custom" }, index);
        expect(isMatch(honest)).toBe(true);
        expect(isMatch(custom)).toBe(false);
    });

    // "w/ COA" is how a seller says the model INCLUDES its papers — that
    // listing is a fine comp and must keep matching. Only the spelled-out
    // phrase (the paper as the product) disqualifies.
    it("keeps a model listed with its COA while refusing the COA alone", () => {
        const withPapers = matchListing({ title: "Breyer Alborozo 712053 NIB w/ COA" }, index);
        const paperAlone = matchListing(
            { title: "Breyer Certificate of Authenticity #712053 Alborozo" },
            index,
        );
        expect(isMatch(withPapers)).toBe(true);
        expect(isMatch(paperAlone)).toBe(false);
    });
});

describe("the index", () => {
    it("leaves out rows with no model number, which are not matchable", () => {
        const withNulls = buildNumberIndex([
            ...CATALOG,
            { id: "no-number", title: "Mystery", maker: "Breyer", modelNumber: null, scale: null },
        ]);
        const all = [...withNulls.values()].flat().map((r) => r.id);
        expect(all).not.toContain("no-number");
    });

    it("does not call one release's finish variants ambiguous", () => {
        expect(isAmbiguousNumber(index.get("710469")!)).toBe(false);
    });

    it("does call a placeholder number ambiguous", () => {
        expect(isAmbiguousNumber(index.get("430040")!)).toBe(true);
    });
});
