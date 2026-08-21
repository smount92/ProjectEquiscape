import { describe, it, expect } from "vitest";

import {
    activeListingChips,
    buildListingHref,
    buildListingSearchParams,
    countActiveListingFilters,
    findPriceBand,
    formatListingPrice,
    guideHandoffHref,
    listingPriceLabel,
    parseListingFilters,
    parseListingPage,
    PRICE_BANDS,
    type ListingFilters,
} from "@/lib/market/listingFilters";

describe("parseListingFilters", () => {
    it("returns an empty filter set for an empty URL", () => {
        expect(parseListingFilters({})).toEqual({});
    });

    it("parses every supported filter", () => {
        expect(
            parseListingFilters({
                q: "  Salinero  ",
                finish: "Custom",
                price: "150-500",
                records: "1",
                trade: "For Sale",
                sort: "price_asc",
            }),
        ).toEqual({
            q: "Salinero",
            finish: "Custom",
            price: "150-500",
            hasRecords: true,
            trade: "For Sale",
            sort: "price_asc",
        });
    });

    it("drops values outside the known vocabulary", () => {
        expect(
            parseListingFilters({
                finish: "Chrome",
                price: "9-9",
                trade: "Stolen/Missing",
                sort: "favorites",
                records: "true",
            }),
        ).toEqual({});
    });

    it("takes the first value when a param repeats", () => {
        expect(parseListingFilters({ finish: ["OF", "Custom"] })).toEqual({ finish: "OF" });
    });

    it("drops a whitespace-only query and caps a long one", () => {
        expect(parseListingFilters({ q: "   " })).toEqual({});
        const long = parseListingFilters({ q: "x".repeat(500) });
        expect(long.q).toHaveLength(100);
    });
});

describe("parseListingPage", () => {
    it("defaults to 1 and rejects junk or out-of-range values", () => {
        expect(parseListingPage({})).toBe(1);
        expect(parseListingPage({ page: "abc" })).toBe(1);
        expect(parseListingPage({ page: "0" })).toBe(1);
        expect(parseListingPage({ page: "-4" })).toBe(1);
    });

    it("reads a real page number", () => {
        expect(parseListingPage({ page: "7" })).toBe(7);
    });

    it("bounds the offset a crafted URL can request", () => {
        expect(parseListingPage({ page: "99999999" })).toBe(500);
    });
});

describe("buildListingSearchParams / buildListingHref", () => {
    it("omits defaults so the canonical unfiltered URL is bare", () => {
        expect(buildListingSearchParams({}).toString()).toBe("");
        expect(buildListingHref({})).toBe("/market");
        expect(buildListingHref({ sort: "newest" })).toBe("/market");
        expect(buildListingHref({}, 1)).toBe("/market");
    });

    it("round-trips a full filter set through the URL", () => {
        const filters: ListingFilters = {
            q: "Salinero",
            finish: "Custom",
            price: "150-500",
            hasRecords: true,
            trade: "For Sale",
            sort: "price_desc",
        };
        const qs = buildListingSearchParams(filters).toString();
        const params = Object.fromEntries(new URLSearchParams(qs).entries());
        expect(parseListingFilters(params)).toEqual(filters);
    });

    it("adds page only beyond the first", () => {
        expect(buildListingHref({}, 3)).toBe("/market?page=3");
        expect(buildListingHref({ finish: "OF" }, 2)).toBe("/market?finish=OF&page=2");
    });
});

describe("countActiveListingFilters", () => {
    it("counts filters but never the sort", () => {
        expect(countActiveListingFilters({})).toBe(0);
        expect(countActiveListingFilters({ sort: "price_asc" })).toBe(0);
        expect(
            countActiveListingFilters({ q: "a", finish: "OF", price: "0-50", hasRecords: true, trade: "For Sale" }),
        ).toBe(5);
    });
});

describe("activeListingChips", () => {
    it("returns nothing when nothing is filtered", () => {
        expect(activeListingChips({})).toEqual([]);
    });

    it("labels each active filter with a removable key", () => {
        const chips = activeListingChips({ q: "Salinero", price: "0-50", hasRecords: true });
        expect(chips).toEqual([
            { key: "q", label: "“Salinero”" },
            { key: "price", label: "Under $50" },
            { key: "hasRecords", label: "Has show record" },
        ]);
    });
});

describe("findPriceBand", () => {
    it("resolves known ids and rejects everything else", () => {
        expect(findPriceBand("1500-")).toEqual({ id: "1500-", label: "$1,500+", min: 1500, max: null });
        expect(findPriceBand("nope")).toBeNull();
        expect(findPriceBand(null)).toBeNull();
        expect(findPriceBand(undefined)).toBeNull();
    });

    it("declares bands that tile the range without gaps", () => {
        for (let i = 1; i < PRICE_BANDS.length; i += 1) {
            expect(PRICE_BANDS[i].min).toBe(PRICE_BANDS[i - 1].max);
        }
        expect(PRICE_BANDS[PRICE_BANDS.length - 1].max).toBeNull();
    });
});

describe("listingPriceLabel", () => {
    it("shows the asking price for a priced For Sale horse", () => {
        expect(listingPriceLabel("For Sale", 1250)).toBe("$1,250");
    });

    it("never prints $0 or 'free' for a priceless listing", () => {
        expect(listingPriceLabel("For Sale", null)).toBe("Ask for price");
        expect(listingPriceLabel("For Sale", 0)).toBe("Ask for price");
        expect(listingPriceLabel("For Sale", undefined)).toBe("Ask for price");
    });

    it("frames a priced Open to Offers horse as an approximation", () => {
        expect(listingPriceLabel("Open to Offers", 400)).toBe("Open to offers · ~$400");
        expect(listingPriceLabel("Open to Offers", null)).toBe("Open to offers");
    });

    it("formats plain prices without cents", () => {
        expect(formatListingPrice(1500)).toBe("$1,500");
    });
});

describe("guideHandoffHref", () => {
    it("is null when no Blue Book param is present", () => {
        expect(guideHandoffHref({})).toBeNull();
        expect(guideHandoffHref({ q: "breyer", finish: "OF" })).toBeNull();
    });

    it("keeps an old price-guide deep link alive", () => {
        expect(guideHandoffHref({ type: "artist_resin" })).toBe("/market/guide?type=artist_resin");
        expect(guideHandoffHref({ type: "tack", stage: "blank", q: "saddle" })).toBe(
            "/market/guide?type=tack&stage=blank&q=saddle",
        );
    });
});
