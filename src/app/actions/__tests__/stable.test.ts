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
    loadMoreStable,
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
        const result = await getStablePage({ limit: 100 });
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
        expect(
            (mockClient._mockQuery.is as ReturnType<typeof vi.fn>).mock.calls,
        ).toEqual(expect.arrayContaining([["deleted_at", null]]));
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

    it("returns cards, count, hasMore, and facet options on success", async () => {
        const result = await getStablePage({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.cards).toEqual([]);
            expect(result.totalCount).toBe(0);
            expect(result.hasMore).toBe(false);
            expect(result.facetOptions).toEqual({
                makers: [],
                scales: [],
                finishes: [],
                categories: [],
            });
        }
    });

    it("prefers facet options from the get_stable_facets RPC when available", async () => {
        mockClient.rpc.mockImplementation((fn: string) =>
            Promise.resolve(
                fn === "get_stable_facets"
                    ? { data: { makers: ["Breyer"], scales: ["Traditional"], finishes: ["OF"], categories: ["model"] }, error: null }
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

describe("loadMoreStable", () => {
    it("pages with the requested offset (append semantics)", async () => {
        const result = await loadMoreStable({ offset: 48 });
        expect(result.success).toBe(true);
        expect(
            (mockClient._mockQuery.range as ReturnType<typeof vi.fn>).mock.calls,
        ).toEqual(expect.arrayContaining([[48, 95]]));
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(loadMoreStable({ offset: 48 })).rejects.toThrow(AuthError);
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
            data: { id: VIEW_ID, user_id: "user-1", name: "OF Breyers", params: { finish: "OF" }, created_at: "2026-07-10" },
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
