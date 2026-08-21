import { describe, it, expect } from "vitest";

import {
    buildMarketListingRpcArgs,
    mapMarketListingRpcRows,
    parseRecordAggregate,
    MARKET_RPC_MAX_LIMIT,
} from "@/lib/market/rpcListings";
import { LISTINGS_PAGE_SIZE } from "@/lib/market/listingFilters";

function row(overrides: Record<string, unknown> = {}) {
    return {
        id: "h-1",
        owner_id: "u-1",
        custom_name: "Avalon",
        finish_type: "OF",
        condition_grade: "Mint",
        created_at: "2026-07-01T00:00:00Z",
        trade_status: "For Sale",
        listing_price: 250,
        marketplace_notes: "Boxed",
        catalog_id: "c-1",
        catalog_title: "Smart Chic Olena",
        catalog_maker: "Breyer",
        catalog_scale: "Traditional",
        owner_alias: "collector1",
        thumbnail_url: "horses/h-1/main.jpg",
        is_trusted_seller: false,
        records: null,
        total_count: 1,
        ...overrides,
    };
}

describe("buildMarketListingRpcArgs", () => {
    it("maps an empty filter set to all-null arguments and page 1", () => {
        expect(buildMarketListingRpcArgs({}, 1)).toEqual({
            p_q: null,
            p_finish: null,
            p_min_price: null,
            p_max_price: null,
            p_has_records: false,
            p_trade: null,
            p_sort: "newest",
            p_limit: LISTINGS_PAGE_SIZE,
            p_offset: 0,
        });
    });

    it("expands a price band into an inclusive min and an exclusive max", () => {
        const args = buildMarketListingRpcArgs({ price: "150-500" }, 1);
        expect(args.p_min_price).toBe(150);
        expect(args.p_max_price).toBe(500);
    });

    it("leaves the top band open-ended", () => {
        const args = buildMarketListingRpcArgs({ price: "1500-" }, 1);
        expect(args.p_min_price).toBe(1500);
        expect(args.p_max_price).toBeNull();
    });

    it("ignores an unknown price band rather than inventing bounds", () => {
        const args = buildMarketListingRpcArgs({ price: "free-stuff" }, 1);
        expect(args.p_min_price).toBeNull();
        expect(args.p_max_price).toBeNull();
    });

    it("passes the search term through trimmed, and blanks become null", () => {
        expect(buildMarketListingRpcArgs({ q: "  ol e na  " }, 1).p_q).toBe("ol e na");
        expect(buildMarketListingRpcArgs({ q: "   " }, 1).p_q).toBeNull();
    });

    it("carries finish, trade, sort and the records flag", () => {
        const args = buildMarketListingRpcArgs(
            { finish: "Custom", trade: "Open to Offers", sort: "price_desc", hasRecords: true },
            1,
        );
        expect(args.p_finish).toBe("Custom");
        expect(args.p_trade).toBe("Open to Offers");
        expect(args.p_sort).toBe("price_desc");
        expect(args.p_has_records).toBe(true);
    });

    it("turns the page number into an offset", () => {
        expect(buildMarketListingRpcArgs({}, 3).p_offset).toBe(LISTINGS_PAGE_SIZE * 2);
    });

    it("never asks for a negative offset or a page below 1", () => {
        expect(buildMarketListingRpcArgs({}, 0).p_offset).toBe(0);
        expect(buildMarketListingRpcArgs({}, -5).p_offset).toBe(0);
        expect(buildMarketListingRpcArgs({}, Number.NaN).p_offset).toBe(0);
    });

    it("never asks for more rows than the function will serve", () => {
        expect(buildMarketListingRpcArgs({}, 1).p_limit).toBeLessThanOrEqual(
            MARKET_RPC_MAX_LIMIT,
        );
    });
});

describe("parseRecordAggregate", () => {
    it("returns null for a horse with no records", () => {
        expect(parseRecordAggregate("h-1", null)).toBeNull();
        expect(parseRecordAggregate("h-1", [])).toBeNull();
    });

    it("summarizes the JSONB aggregate with the same rules as the card", () => {
        const summary = parseRecordAggregate("h-1", [
            { placing: "1st", ribbon_color: "Blue", verification_tier: "platform_generated" },
            { placing: "Grand Champion", ribbon_color: null, verification_tier: "host_verified" },
            { placing: "3rd", ribbon_color: null, verification_tier: "self_reported" },
        ]);
        expect(summary).toEqual({ total: 3, placings: 2, championships: 1, verified: 2 });
    });

    it("treats a legacy championship ribbon as a championship", () => {
        const summary = parseRecordAggregate("h-1", [
            { placing: null, ribbon_color: "Grand Champion", verification_tier: null },
        ]);
        expect(summary?.championships).toBe(1);
    });

    it("drops junk entries instead of throwing", () => {
        const summary = parseRecordAggregate("h-1", [null, "nope", 7, { placing: "2nd" }]);
        expect(summary).toEqual({ total: 1, placings: 1, championships: 0, verified: 0 });
    });

    it("ignores a non-array aggregate", () => {
        expect(parseRecordAggregate("h-1", { placing: "1st" })).toBeNull();
    });
});

describe("mapMarketListingRpcRows", () => {
    it("returns an empty page for a non-array payload", () => {
        expect(mapMarketListingRpcRows(null)).toEqual({ listings: [], total: 0 });
        expect(mapMarketListingRpcRows("boom")).toEqual({ listings: [], total: 0 });
    });

    it("maps one row into a listing card", () => {
        const { listings, total } = mapMarketListingRpcRows([row()]);
        expect(total).toBe(1);
        expect(listings).toHaveLength(1);
        expect(listings[0]).toMatchObject({
            id: "h-1",
            ownerId: "u-1",
            customName: "Avalon",
            refName: "Breyer — Smart Chic Olena",
            scale: "Traditional",
            finishType: "OF",
            conditionGrade: "Mint",
            tradeStatus: "For Sale",
            listingPrice: 250,
            ownerAlias: "collector1",
            isTrustedSeller: false,
            recordSummary: null,
        });
    });

    it("leaves the raw storage path on the card for the caller to resolve", () => {
        const { listings } = mapMarketListingRpcRows([row()]);
        expect(listings[0].thumbnailUrl).toBe("horses/h-1/main.jpg");
    });

    it("falls back to the bare title when the catalog row has no maker", () => {
        const { listings } = mapMarketListingRpcRows([row({ catalog_maker: null })]);
        expect(listings[0].refName).toBe("Smart Chic Olena");
    });

    it("reports an unlisted mold as having no reference name", () => {
        const { listings } = mapMarketListingRpcRows([
            row({ catalog_id: null, catalog_title: null, catalog_maker: null }),
        ]);
        expect(listings[0].refName).toBeNull();
        expect(listings[0].catalogId).toBeNull();
    });

    it("names an unnamed horse rather than rendering an empty heading", () => {
        const { listings } = mapMarketListingRpcRows([row({ custom_name: "" })]);
        expect(listings[0].customName).toBe("Unnamed horse");
    });

    it("falls back to 'Collector' when the alias is missing", () => {
        const { listings } = mapMarketListingRpcRows([row({ owner_alias: null })]);
        expect(listings[0].ownerAlias).toBe("Collector");
    });

    it("keeps a missing asking price null — never zero", () => {
        const { listings } = mapMarketListingRpcRows([row({ listing_price: null })]);
        expect(listings[0].listingPrice).toBeNull();
    });

    it("only trusts an explicit true for the trusted-seller flag", () => {
        expect(mapMarketListingRpcRows([row({ is_trusted_seller: true })]).listings[0]
            .isTrustedSeller).toBe(true);
        expect(mapMarketListingRpcRows([row({ is_trusted_seller: null })]).listings[0]
            .isTrustedSeller).toBe(false);
        expect(mapMarketListingRpcRows([row({ is_trusted_seller: "yes" })]).listings[0]
            .isTrustedSeller).toBe(false);
    });

    it("summarizes the row's record aggregate onto the card", () => {
        const { listings } = mapMarketListingRpcRows([
            row({
                records: [
                    { placing: "1st", ribbon_color: null, verification_tier: "host_verified" },
                ],
            }),
        ]);
        expect(listings[0].recordSummary).toEqual({
            total: 1,
            placings: 1,
            championships: 0,
            verified: 1,
        });
    });

    it("takes the window total from the row, not the page length", () => {
        const { listings, total } = mapMarketListingRpcRows([
            row({ id: "h-1", total_count: 97 }),
            row({ id: "h-2", total_count: 97 }),
        ]);
        expect(listings).toHaveLength(2);
        expect(total).toBe(97);
    });

    it("accepts a bigint total delivered as a string", () => {
        expect(mapMarketListingRpcRows([row({ total_count: "42" })]).total).toBe(42);
    });

    it("falls back to the page length when the total is unusable", () => {
        expect(mapMarketListingRpcRows([row({ total_count: null })]).total).toBe(1);
    });

    it("drops rows with no id or no owner instead of rendering broken cards", () => {
        const { listings } = mapMarketListingRpcRows([
            row(),
            row({ id: null }),
            row({ owner_id: "" }),
            null,
            "junk",
        ]);
        expect(listings).toHaveLength(1);
        expect(listings[0].id).toBe("h-1");
    });
});
