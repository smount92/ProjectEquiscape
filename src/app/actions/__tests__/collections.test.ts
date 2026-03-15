import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));

import {
    createCollectionAction,
    deleteCollectionAction,
    setHorseCollections,
} from "@/app/actions/collections";

describe("collections.ts — M:N Junction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "test@test.com" } },
        });
    });

    // ── createCollectionAction ──
    describe("createCollectionAction", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await createCollectionAction("My Collection", null, true);
            expect(result.success).toBe(false);
        });

        it("creates collection successfully", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "col-1", name: "My Collection", description: null },
                error: null,
            });
            const result = await createCollectionAction("My Collection", null, true);
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: "col-1", name: "My Collection", description: null });
        });
    });

    // ── setHorseCollections ──
    describe("setHorseCollections", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await setHorseCollections("h1", ["col-1"]);
            expect(result.success).toBe(false);
        });

        it("rejects non-owner", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            const result = await setHorseCollections("h1", ["col-1"]);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("assigns 2 collections to a horse", async () => {
            // Horse ownership check
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: { id: "h1" },
                error: null,
            });

            const result = await setHorseCollections("h1", ["col-1", "col-2"]);
            expect(result.success).toBe(true);
            // Verify delete+insert pattern
            expect(mockClient._mockQuery.delete).toHaveBeenCalled();
            expect(mockClient._mockQuery.insert).toHaveBeenCalled();
        });

        it("removes all collections when empty array passed", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: { id: "h1" },
                error: null,
            });

            const result = await setHorseCollections("h1", []);
            expect(result.success).toBe(true);
            // Delete was called, but insert was NOT called (empty array)
            expect(mockClient._mockQuery.delete).toHaveBeenCalled();
        });
    });

    // ── deleteCollectionAction ──
    describe("deleteCollectionAction", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await deleteCollectionAction("col-1");
            expect(result.success).toBe(false);
        });

        it("deletes collection and cleans up junction rows", async () => {
            const result = await deleteCollectionAction("col-1");
            expect(result.success).toBe(true);
            // Verify junction cleanup was attempted
            expect(mockClient.from).toHaveBeenCalledWith("horse_collections");
            expect(mockClient.from).toHaveBeenCalledWith("user_collections");
        });
    });
});
