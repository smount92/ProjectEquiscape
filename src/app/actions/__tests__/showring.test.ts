import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { getShowRingPage, loadMoreShowRing } from "@/app/actions/showring";

const BLOCKED_ID = "123e4567-e89b-42d3-a456-426614174000";

type MockFn = ReturnType<typeof vi.fn>;

function eqCalls(): unknown[][] {
    return (mockClient._mockQuery.eq as MockFn).mock.calls;
}
function orCalls(): unknown[][] {
    return (mockClient._mockQuery.or as MockFn).mock.calls;
}
function orderCalls(): unknown[][] {
    return (mockClient._mockQuery.order as MockFn).mock.calls;
}
function selectArgs(): string[] {
    return (mockClient._mockQuery.select as MockFn).mock.calls.map((c) => String(c[0] ?? ""));
}

/** A standalone resolving chain for tables that need distinct data. */
function chainResolving(data: unknown) {
    const q: Record<string, unknown> = {};
    q.select = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.limit = vi.fn(() => q);
    q.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data, error: null }).then(resolve);
    return q;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockClient.from.mockImplementation(() => mockClient._mockQuery);
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "test@test.com" } },
    });
    mockClient._setImplicitResolve({ data: [], error: null });
});

describe("getShowRingPage", () => {
    it("rejects invalid input before touching auth or the DB", async () => {
        const result = await getShowRingPage({ limit: 100 });
        expect(result.success).toBe(false);
        expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("rejects the fake most-favorited sort at the schema boundary", async () => {
        const result = await getShowRingPage({ sort: "most-favorited" as never });
        expect(result.success).toBe(false);
        expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(getShowRingPage({})).rejects.toThrow(AuthError);
    });

    it("queries only public, non-deleted horses", async () => {
        const result = await getShowRingPage({});
        expect(result.success).toBe(true);
        expect(eqCalls()).toEqual(expect.arrayContaining([["visibility", "public"]]));
        expect((mockClient._mockQuery.is as MockFn).mock.calls).toEqual(
            expect.arrayContaining([["deleted_at", null]]),
        );
    });

    it("excludes blocked users IN SQL, not by post-filtering the page", async () => {
        mockClient.from.mockImplementation((table: string) =>
            table === "user_blocks"
                ? chainResolving([{ blocked_id: BLOCKED_ID }])
                : mockClient._mockQuery,
        );
        const result = await getShowRingPage({});
        expect(result.success).toBe(true);
        expect((mockClient._mockQuery.not as MockFn).mock.calls).toEqual(
            expect.arrayContaining([["owner_id", "in", `(${BLOCKED_ID})`]]),
        );
    });

    it("skips the SQL exclusion entirely when the block list is empty", async () => {
        await getShowRingPage({});
        expect(mockClient._mockQuery.not).not.toHaveBeenCalled();
    });

    it("maker filter actually filters (joined catalog column, inner join)", async () => {
        await getShowRingPage({ maker: "Breyer" });
        expect(eqCalls()).toEqual(expect.arrayContaining([["catalog_items.maker", "Breyer"]]));
        expect(selectArgs().some((s) => s.includes("catalog_id!inner"))).toBe(true);
    });

    it("scale filter actually filters", async () => {
        await getShowRingPage({ scale: "Traditional" });
        expect(eqCalls()).toEqual(expect.arrayContaining([["catalog_items.scale", "Traditional"]]));
    });

    it("keeps the left catalog join when maker/scale are off so unlisted molds appear", async () => {
        await getShowRingPage({});
        expect(selectArgs().some((s) => s.includes("!inner(title"))).toBe(false);
    });

    it("sanitizes q before the .or() interpolation", async () => {
        await getShowRingPage({ q: "trick,(or.injection)" });
        // The raw commas/parens from the user never reach PostgREST —
        // every .or() argument (catalog expansion + main query) is
        // built from the sanitized form.
        expect(orCalls().length).toBeGreaterThan(0);
        for (const call of orCalls()) {
            expect(String(call[0])).not.toContain("trick,(");
            expect(String(call[0])).not.toContain("injection)");
        }
        expect(orCalls().some((c) => String(c[0]).includes("custom_name.ilike"))).toBe(true);
    });

    it("searches catalog title/maker via the bounded id expansion", async () => {
        mockClient._setImplicitResolve({ data: [], error: null });
        await getShowRingPage({ q: "chic" });
        expect(orCalls().some((c) => String(c[0]).includes("title.ilike.%chic%"))).toBe(true);
    });

    it("orders newest-first with an id tiebreaker for stable paging", async () => {
        await getShowRingPage({});
        expect(orderCalls()).toEqual([
            ["created_at", { ascending: false }],
            ["id", { ascending: true }],
        ]);
    });

    it("orders oldest-first when asked", async () => {
        await getShowRingPage({ sort: "oldest" });
        expect(orderCalls()[0]).toEqual(["created_at", { ascending: true }]);
    });

    it("derives facet options from the whole public dataset, not the loaded page", async () => {
        // Both the page query and the facet scan read user_horses; the
        // shared implicit resolve feeds both. Facet rows carry the
        // scan's shape.
        mockClient._setImplicitResolve({
            data: [
                { finish_type: "OF", catalog_items: { maker: "Breyer", scale: "Classic" } },
                { finish_type: "Custom", catalog_items: { maker: "Stone", scale: "Classic" } },
                { finish_type: "OF", catalog_items: null },
            ],
            error: null,
        });
        const result = await getShowRingPage({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.facetOptions).toEqual({
                makers: ["Breyer", "Stone"],
                scales: ["Classic"],
                finishes: ["Custom", "OF"],
            });
        }
    });

    it("returns cards, exact count, and hasMore on success", async () => {
        const result = await getShowRingPage({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.cards).toEqual([]);
            expect(result.totalCount).toBe(0);
            expect(result.hasMore).toBe(false);
        }
    });
});

describe("loadMoreShowRing", () => {
    it("pages with the requested offset (append semantics)", async () => {
        const result = await loadMoreShowRing({ offset: 24 });
        expect(result.success).toBe(true);
        expect((mockClient._mockQuery.range as MockFn).mock.calls).toEqual(
            expect.arrayContaining([[24, 47]]),
        );
    });

    it("applies the same filters as the first page (one shared core)", async () => {
        await loadMoreShowRing({ offset: 24, maker: "Breyer", trade: "For Sale" });
        expect(eqCalls()).toEqual(
            expect.arrayContaining([
                ["catalog_items.maker", "Breyer"],
                ["trade_status", "For Sale"],
                ["visibility", "public"],
            ]),
        );
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(loadMoreShowRing({ offset: 24 })).rejects.toThrow(AuthError);
    });
});
