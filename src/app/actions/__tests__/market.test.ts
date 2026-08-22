import { vi, describe, it, expect, beforeEach } from "vitest";

/**
 * searchMarketPrices — /market's price guide.
 *
 * It used to pull the ENTIRE mv_market_prices view and then run a
 * catalog `.in()` carrying every id in that view, per anonymous page
 * view. The view only moves when refresh_market_prices() runs, so the
 * invariant core is now loaded once through unstable_cache on a
 * COOKIE-LESS anon client and the filtering happens over the cached
 * arrays.
 *
 * That moved two predicates out of SQL and into JS — `item_type = x`
 * and `title/maker ILIKE %q%`. These tests pin the translation, plus
 * the merge/sort/paginate the old build did.
 */

const anonRpc = vi.fn();
const catalogIdBatches: string[][] = [];
let catalogRows: Record<string, unknown>[] = [];

const anonClient = {
    rpc: anonRpc,
    from: vi.fn(() => {
        const q: Record<string, unknown> = {};
        q.select = vi.fn(() => q);
        q.in = vi.fn((_col: string, ids: string[]) => {
            catalogIdBatches.push(ids);
            return q;
        });
        q.then = (resolve: (v: unknown) => void) =>
            Promise.resolve({
                // Only the rows whose id is in the requested batch.
                data: catalogRows.filter((r) =>
                    (catalogIdBatches[catalogIdBatches.length - 1] ?? []).includes(r.id as string),
                ),
                error: null,
            }).then(resolve);
        return q;
    }),
};

vi.mock("@/lib/supabase/anon", () => ({
    createAnonClient: vi.fn(() => anonClient),
}));
vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(anonClient)),
}));
vi.mock("@/lib/auth", () => ({
    requireAuth: vi.fn(),
}));
vi.mock("next/cache", () => ({
    revalidateTag: vi.fn(),
    // Pass-through: the cache wrapper is Next's job, not this suite's.
    unstable_cache: <T>(fn: T) => fn,
}));

import { searchMarketPrices, getTopTraded } from "@/app/actions/market";

function priceRow(over: Record<string, unknown> = {}) {
    return {
        catalog_id: "cat-1",
        finish_type: "OF",
        life_stage: "completed",
        lowest_price: 10,
        highest_price: 90,
        average_price: 50,
        median_price: 45,
        transaction_volume: 3,
        last_sold_at: "2026-08-01T00:00:00.000Z",
        ...over,
    };
}

function catalogRow(over: Record<string, unknown> = {}) {
    return {
        id: "cat-1",
        title: "Stormwatch",
        maker: "Breyer",
        maker_slug: "breyer",
        slug: "stormwatch",
        item_type: "plastic_release",
        scale: "Traditional",
        ...over,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    catalogIdBatches.length = 0;
    catalogRows = [];
});

describe("searchMarketPrices", () => {
    it("returns an empty result when the view is empty, without touching the catalog", async () => {
        anonRpc.mockResolvedValue({ data: [], error: null });
        expect(await searchMarketPrices()).toEqual({ items: [], total: 0 });
        expect(catalogIdBatches).toEqual([]);
    });

    it("reads the whole view ONCE with no per-request filter arguments", async () => {
        anonRpc.mockResolvedValue({ data: [priceRow()], error: null });
        catalogRows = [catalogRow()];

        await searchMarketPrices(undefined, { finishType: "OF" });

        // The finish filter used to be an RPC argument, which made the
        // payload un-cacheable across filter combinations.
        expect(anonRpc).toHaveBeenCalledTimes(1);
        expect(anonRpc).toHaveBeenCalledWith("get_market_rows", {});
    });

    it("requests catalog ids in bounded batches instead of one giant .in()", async () => {
        const ids = Array.from({ length: 700 }, (_, i) => `cat-${i}`);
        anonRpc.mockResolvedValue({
            data: ids.map((id) => priceRow({ catalog_id: id })),
            error: null,
        });
        catalogRows = ids.map((id) => catalogRow({ id, title: `Model ${id}` }));

        await searchMarketPrices(undefined, { limit: 1000 });

        expect(catalogIdBatches.length).toBeGreaterThan(1);
        for (const batch of catalogIdBatches) expect(batch.length).toBeLessThanOrEqual(300);
        // Every id still gets asked for exactly once.
        expect(catalogIdBatches.flat().sort()).toEqual([...ids].sort());
    });

    it("filters finish_type and life_stage by equality, as the RPC's SQL did", async () => {
        anonRpc.mockResolvedValue({
            data: [
                priceRow({ catalog_id: "cat-1", finish_type: "OF", life_stage: "completed" }),
                priceRow({ catalog_id: "cat-2", finish_type: "CM", life_stage: "completed" }),
                priceRow({ catalog_id: "cat-3", finish_type: "OF", life_stage: "active" }),
            ],
            error: null,
        });
        catalogRows = [
            catalogRow({ id: "cat-1" }),
            catalogRow({ id: "cat-2" }),
            catalogRow({ id: "cat-3" }),
        ];

        const of = await searchMarketPrices(undefined, { finishType: "OF" });
        expect(of.items.map((i) => i.catalogId).sort()).toEqual(["cat-1", "cat-3"]);

        const completedOf = await searchMarketPrices(undefined, {
            finishType: "OF",
            lifeStage: "completed",
        });
        expect(completedOf.items.map((i) => i.catalogId)).toEqual(["cat-1"]);
    });

    it("matches the ILIKE '%q%' search case-insensitively on title OR maker", async () => {
        anonRpc.mockResolvedValue({
            data: [
                priceRow({ catalog_id: "cat-1" }),
                priceRow({ catalog_id: "cat-2" }),
                priceRow({ catalog_id: "cat-3" }),
            ],
            error: null,
        });
        catalogRows = [
            catalogRow({ id: "cat-1", title: "Stormwatch", maker: "Breyer" }),
            catalogRow({ id: "cat-2", title: "Ideal Arabian", maker: "Peter Stone" }),
            catalogRow({ id: "cat-3", title: "Nightstorm", maker: "Copperfox" }),
        ];

        // substring, not prefix; case-insensitive; matches title...
        const byTitle = await searchMarketPrices("STORM");
        expect(byTitle.items.map((i) => i.catalogId).sort()).toEqual(["cat-1", "cat-3"]);

        // ...or maker
        const byMaker = await searchMarketPrices("stone");
        expect(byMaker.items.map((i) => i.catalogId)).toEqual(["cat-2"]);

        // sanitizeForOr strips wildcards, so '%' can never widen a search
        const wildcarded = await searchMarketPrices("%");
        expect(wildcarded.items).toHaveLength(3);

        const noMatch = await searchMarketPrices("zzzz");
        expect(noMatch).toEqual({ items: [], total: 0 });
    });

    it("filters item_type, and treats 'all' as no filter", async () => {
        anonRpc.mockResolvedValue({
            data: [priceRow({ catalog_id: "cat-1" }), priceRow({ catalog_id: "cat-2" })],
            error: null,
        });
        catalogRows = [
            catalogRow({ id: "cat-1", item_type: "plastic_release" }),
            catalogRow({ id: "cat-2", item_type: "artist_resin" }),
        ];

        const resins = await searchMarketPrices(undefined, { itemType: "artist_resin" });
        expect(resins.items.map((i) => i.catalogId)).toEqual(["cat-2"]);

        const all = await searchMarketPrices(undefined, { itemType: "all" });
        expect(all.items).toHaveLength(2);
    });

    it("emits one row per catalog × price pair, mapped exactly as before", async () => {
        anonRpc.mockResolvedValue({
            data: [
                priceRow({ finish_type: "OF", transaction_volume: 3 }),
                priceRow({ finish_type: "CM", transaction_volume: 9, last_sold_at: null }),
            ],
            error: null,
        });
        catalogRows = [catalogRow()];

        const { items, total } = await searchMarketPrices();
        expect(total).toBe(2);
        expect(items[0]).toEqual({
            catalogId: "cat-1",
            title: "Stormwatch",
            maker: "Breyer",
            makerSlug: "breyer",
            slug: "stormwatch",
            itemType: "plastic_release",
            finishType: "CM",
            lifeStage: "completed",
            scale: "Traditional",
            lowestPrice: 10,
            highestPrice: 90,
            averagePrice: 50,
            medianPrice: 45,
            transactionVolume: 9,
            lastSoldAt: null,
        });
    });

    it("collapses duplicate catalog::finish::life_stage rows the way the old price map did", async () => {
        anonRpc.mockResolvedValue({
            data: [
                priceRow({ transaction_volume: 1 }),
                // same composite key — the old Map kept only the last
                priceRow({ transaction_volume: 42 }),
            ],
            error: null,
        });
        catalogRows = [catalogRow()];

        const { items, total } = await searchMarketPrices();
        expect(total).toBe(1);
        expect(items[0].transactionVolume).toBe(42);
    });

    it("sorts, counts before paging, and slices by offset/limit", async () => {
        anonRpc.mockResolvedValue({
            data: [
                priceRow({ catalog_id: "cat-1", transaction_volume: 1 }),
                priceRow({ catalog_id: "cat-2", transaction_volume: 9 }),
                priceRow({ catalog_id: "cat-3", transaction_volume: 5 }),
            ],
            error: null,
        });
        catalogRows = [
            catalogRow({ id: "cat-1", title: "A" }),
            catalogRow({ id: "cat-2", title: "B" }),
            catalogRow({ id: "cat-3", title: "C" }),
        ];

        // default sort: transaction_volume desc
        const page1 = await searchMarketPrices(undefined, { limit: 2 });
        expect(page1.total).toBe(3); // total counts the whole match set
        expect(page1.items.map((i) => i.catalogId)).toEqual(["cat-2", "cat-3"]);

        const page2 = await searchMarketPrices(undefined, { limit: 2, offset: 2 });
        expect(page2.items.map((i) => i.catalogId)).toEqual(["cat-1"]);

        const byTitleAsc = await searchMarketPrices(undefined, {
            sortBy: "title",
            sortDirection: "asc",
        });
        expect(byTitleAsc.items.map((i) => i.title)).toEqual(["A", "B", "C"]);
    });
});

describe("getTopTraded", () => {
    it("rides the same cached core, most-traded first", async () => {
        anonRpc.mockResolvedValue({
            data: [
                priceRow({ catalog_id: "cat-1", transaction_volume: 2 }),
                priceRow({ catalog_id: "cat-2", transaction_volume: 8 }),
            ],
            error: null,
        });
        catalogRows = [catalogRow({ id: "cat-1" }), catalogRow({ id: "cat-2" })];

        const top = await getTopTraded(1);
        expect(top.map((i) => i.catalogId)).toEqual(["cat-2"]);
    });
});
