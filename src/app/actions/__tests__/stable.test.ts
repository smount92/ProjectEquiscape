import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));

import {
    deleteStableView,
    getMatchingHorseIds,
    getStablePage,
    getStableSummary,
    listStableViews,
    saveStableView,
} from "@/app/actions/stable";

const VIEW_ID = "123e4567-e89b-42d3-a456-426614174000";

function eqCalls(): unknown[][] {
    return (mockClient._mockQuery.eq as ReturnType<typeof vi.fn>).mock.calls;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "test@test.com" } },
    });
    mockClient._setImplicitResolve({ data: [], error: null });
    mockClient.rpc.mockResolvedValue({ data: null, error: null });
});

describe("getStablePage", () => {
    it("rejects invalid input before touching auth or the DB", async () => {
        const result = await getStablePage({ per: 500 });
        expect(result.success).toBe(false);
        expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("rejects a malformed collection UUID", async () => {
        const result = await getStablePage({ collection: "abc" });
        expect(result.success).toBe(false);
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(getStablePage({})).rejects.toThrow(AuthError);
    });

    it("scopes the query to the owner and excludes soft-deleted rows", async () => {
        const result = await getStablePage({ finish: "OF" });
        expect(result.success).toBe(true);
        expect(eqCalls()).toEqual(expect.arrayContaining([["owner_id", "user-1"]]));
        expect((mockClient._mockQuery.is as ReturnType<typeof vi.fn>).mock.calls).toEqual(
            expect.arrayContaining([["deleted_at", null]]),
        );
        expect(eqCalls()).toEqual(expect.arrayContaining([["finish_type", "OF"]]));
    });

    it("filters joined catalog columns when maker is set", async () => {
        await getStablePage({ maker: "Breyer" });
        expect(eqCalls()).toEqual(expect.arrayContaining([["catalog_items.maker", "Breyer"]]));
    });

    it("returns an empty page when hasRecords is on but the user has no show records", async () => {
        const result = await getStablePage({ hasRecords: true });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.cards).toEqual([]);
            expect(result.totalCount).toBe(0);
        }
    });

    it("returns cards, count, the page served, and facet options on success", async () => {
        const result = await getStablePage({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.cards).toEqual([]);
            expect(result.totalCount).toBe(0);
            expect(result).toMatchObject({ page: 1, per: 48, pageCount: 1 });
            expect(result.facetOptions).toEqual({
                makers: [],
                scales: [],
                finishes: [],
                categories: [],
                molds: [],
            });
        }
    });

    it("prefers facet options from the get_stable_facets RPC when available", async () => {
        mockClient.rpc.mockImplementation((fn: string) =>
            Promise.resolve(
                fn === "get_stable_facets"
                    ? {
                          data: {
                              makers: ["Breyer"],
                              scales: ["Traditional"],
                              finishes: ["OF"],
                              categories: ["model"],
                          },
                          error: null,
                      }
                    : { data: null, error: null },
            ),
        );
        const result = await getStablePage({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.facetOptions.makers).toEqual(["Breyer"]);
        }
    });
});

describe("getStablePage paging", () => {
    function rangeCalls(): unknown[][] {
        return (mockClient._mockQuery.range as ReturnType<typeof vi.fn>).mock.calls;
    }
    const someRows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `h${i}`, custom_name: `H${i}` }));

    it("computes the offset from page and page size", async () => {
        mockClient._setImplicitResolve({ data: someRows(96), count: 412, error: null } as never);
        const result = await getStablePage({ page: 3, per: 96 });
        expect(result.success).toBe(true);
        expect(rangeCalls()).toEqual(expect.arrayContaining([[192, 287]]));
        if (result.success) {
            expect(result).toMatchObject({ page: 3, per: 96, totalCount: 412, pageCount: 5 });
        }
    });

    it("page 1 at the default size reads rows 0–47", async () => {
        await getStablePage({});
        expect(rangeCalls()).toEqual(expect.arrayContaining([[0, 47]]));
    });

    it("clamps a page past the end to the last page (empty result with a count)", async () => {
        mockClient._setImplicitResolve({ data: [], count: 412, error: null } as never);
        const result = await getStablePage({ page: 50 });
        expect(result.success).toBe(true);
        // asked for 2352–2399, then served the last page: 412 at 48 = 9 pages
        expect(rangeCalls()).toEqual(
            expect.arrayContaining([
                [2352, 2399],
                [384, 431],
            ]),
        );
        if (result.success) {
            expect(result).toMatchObject({ page: 9, pageCount: 9, totalCount: 412 });
        }
    });

    it("clamps when PostgREST answers the out-of-range offset with PGRST103", async () => {
        const range = mockClient._mockQuery.range as ReturnType<typeof vi.fn>;
        range.mockImplementation((from: number) => {
            mockClient._setImplicitResolve(
                from >= 412
                    ? ({
                          data: null,
                          count: null,
                          error: { code: "PGRST103", message: "Requested range not satisfiable" },
                      } as never)
                    : ({ data: [], count: 412, error: null } as never),
            );
            return mockClient._mockQuery;
        });
        try {
            const result = await getStablePage({ page: 20, per: 96 });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result).toMatchObject({ page: 5, per: 96, pageCount: 5, totalCount: 412 });
            }
            expect(rangeCalls()).toEqual(
                expect.arrayContaining([
                    [1824, 1919],
                    [384, 479],
                ]),
            );
        } finally {
            range.mockReset();
            range.mockReturnValue(mockClient._mockQuery);
        }
    });

    it("an empty stable is one page, never clamped below page 1", async () => {
        const result = await getStablePage({ page: 1 });
        expect(result.success).toBe(true);
        if (result.success) expect(result).toMatchObject({ page: 1, pageCount: 1, totalCount: 0 });
    });

    it("still surfaces real query errors", async () => {
        mockClient._setImplicitResolve({ data: null, error: { code: "42P01", message: "boom" } });
        const result = await getStablePage({ page: 2 });
        expect(result.success).toBe(false);
    });
});

describe("getMatchingHorseIds", () => {
    it("returns matching ids with the over-cap flag", async () => {
        mockClient._setImplicitResolve({
            data: [{ id: "h1" }, { id: "h2" }],
            count: 600,
            error: null,
        } as never);
        const result = await getMatchingHorseIds({ finish: "OF" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.ids).toEqual(["h1", "h2"]);
            expect(result.totalMatching).toBe(600);
            expect(result.capped).toBe(true);
        }
    });

    it("is not capped when the match count is within the limit", async () => {
        mockClient._setImplicitResolve({ data: [{ id: "h1" }], count: 1, error: null } as never);
        const result = await getMatchingHorseIds({});
        expect(result.success).toBe(true);
        if (result.success) expect(result.capped).toBe(false);
    });

    it("stays owner-scoped", async () => {
        await getMatchingHorseIds({});
        expect(eqCalls()).toEqual(expect.arrayContaining([["owner_id", "user-1"]]));
    });
});

describe("getStableSummary", () => {
    it("uses the get_stable_summary RPC when migration 123 is applied", async () => {
        mockClient.rpc.mockResolvedValueOnce({
            data: [
                {
                    total_horses: 214,
                    vault_total: 1234.5,
                    for_sale_count: 12,
                    collections: [{ id: "c1", name: "Vintage", count: 3, value: 100 }],
                },
            ],
            error: null,
        });
        const result = await getStableSummary();
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.summary.totalHorses).toBe(214);
            expect(result.summary.vaultTotal).toBe(1234.5);
            expect(result.summary.collections).toHaveLength(1);
        }
        expect(mockClient.rpc).toHaveBeenCalledWith("get_stable_summary", { p_owner: "user-1" });
    });

    it("surfaces an RPC failure instead of silently degrading (123 is canonical)", async () => {
        mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: "function not found" } });
        const result = await getStableSummary();
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toMatch(/function not found/);
        }
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(getStableSummary()).rejects.toThrow(AuthError);
    });
});

describe("saved views CRUD", () => {
    it("listStableViews returns only the caller's rows", async () => {
        mockClient._setImplicitResolve({
            data: [{ id: VIEW_ID, user_id: "user-1", name: "OFs", params: { finish: "OF" }, created_at: "2026-07-10" }],
            error: null,
        });
        const result = await listStableViews();
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.views).toEqual([
                { id: VIEW_ID, name: "OFs", params: { finish: "OF" }, createdAt: "2026-07-10" },
            ]);
        }
        expect(eqCalls()).toEqual(expect.arrayContaining([["user_id", "user-1"]]));
    });

    it("saveStableView rejects invalid names without touching the DB", async () => {
        const result = await saveStableView({ name: "x".repeat(61), params: {} });
        expect(result.success).toBe(false);
        expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("saveStableView rejects unknown param keys", async () => {
        const result = await saveStableView({
            name: "Sneaky",
            params: { hacked: "yes" } as never,
        });
        expect(result.success).toBe(false);
    });

    it("saveStableView upserts under the caller's user_id", async () => {
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: {
                id: VIEW_ID,
                user_id: "user-1",
                name: "OF Breyers",
                params: { finish: "OF" },
                created_at: "2026-07-10",
            },
            error: null,
        });
        const result = await saveStableView({ name: "OF Breyers", params: { finish: "OF" } });
        expect(result.success).toBe(true);
        expect(mockClient._mockQuery.upsert).toHaveBeenCalledWith(
            { user_id: "user-1", name: "OF Breyers", params: { finish: "OF" } },
            { onConflict: "user_id,name" },
        );
    });

    it("saveStableView rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(saveStableView({ name: "A", params: {} })).rejects.toThrow(AuthError);
    });

    it("deleteStableView requires a UUID and scopes the delete to the caller", async () => {
        const bad = await deleteStableView({ id: "nope" });
        expect(bad.success).toBe(false);

        const result = await deleteStableView({ id: VIEW_ID });
        expect(result.success).toBe(true);
        expect(mockClient._mockQuery.delete).toHaveBeenCalled();
        expect(eqCalls()).toEqual(
            expect.arrayContaining([
                ["id", VIEW_ID],
                ["user_id", "user-1"],
            ]),
        );
    });
});
