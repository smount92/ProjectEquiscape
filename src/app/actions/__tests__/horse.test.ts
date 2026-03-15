import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("@/lib/utils/validation", () => ({
    sanitizeText: vi.fn((s: string) => s.trim()),
}));
vi.mock("@/app/actions/activity", () => ({
    createActivityEvent: vi.fn().mockResolvedValue(undefined),
}));

import { createHorseRecord, deleteHorse, quickAddHorse } from "@/app/actions/horse";

describe("horse.ts — CRUD", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "test@test.com" } },
        });
    });

    // ── createHorseRecord ──
    describe("createHorseRecord", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await createHorseRecord({ customName: "Test", finishType: "OF", isPublic: true });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not authenticated/i);
        });

        it("rejects missing name", async () => {
            const result = await createHorseRecord({ customName: "", finishType: "OF", isPublic: true });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/missing required/i);
        });

        it("rejects model category without finishType", async () => {
            const result = await createHorseRecord({ customName: "Test", finishType: "", isPublic: true, assetCategory: "model" });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/finish type/i);
        });

        it("succeeds with valid data", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            const result = await createHorseRecord({
                customName: "My Horse",
                finishType: "OF",
                isPublic: true,
            });
            expect(result.success).toBe(true);
            expect(result.horseId).toBe("horse-1");
        });

        it("calls sanitizeText on name", async () => {
            const { sanitizeText } = await import("@/lib/utils/validation");
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            await createHorseRecord({
                customName: "  My Horse  ",
                finishType: "OF",
                isPublic: true,
            });
            expect(sanitizeText).toHaveBeenCalledWith("  My Horse  ");
        });
    });

    // ── deleteHorse ──
    describe("deleteHorse", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await deleteHorse("h1");
            expect(result.success).toBe(false);
        });

        it("rejects non-owner", async () => {
            // Horse not found for this owner
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
            const result = await deleteHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("blocks deletion when active transaction exists", async () => {
            // Horse found
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", owner_id: "user-1" },
                error: null,
            });
            // Active transaction check (admin) - returns an active transaction
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: { id: "txn-1" },
                error: null,
            });
            const result = await deleteHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/active transaction/i);
        });

        it("succeeds when owner deletes own horse with no transactions", async () => {
            // Horse found
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", owner_id: "user-1" },
                error: null,
            });
            // No active transactions
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await deleteHorse("h1");
            expect(result.success).toBe(true);
        });
    });

    // ── quickAddHorse ──
    describe("quickAddHorse", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await quickAddHorse({ finishType: "OF", conditionGrade: "Mint" });
            expect(result.success).toBe(false);
        });

        it("auto-names from catalog when catalogId provided", async () => {
            // Catalog lookup
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { title: "Stablemate", maker: "Breyer" },
                error: null,
            });
            // Horse insert
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            const result = await quickAddHorse({
                catalogId: "cat-1",
                finishType: "OF",
                conditionGrade: "Mint",
            });
            expect(result.success).toBe(true);
            expect(result.horseName).toBe("Breyer Stablemate");
        });

        it("uses 'Unnamed Horse' when no name or catalog", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            const result = await quickAddHorse({
                finishType: "OF",
                conditionGrade: "Good",
            });
            expect(result.success).toBe(true);
            expect(result.horseName).toBe("Unnamed Horse");
        });
    });
});
