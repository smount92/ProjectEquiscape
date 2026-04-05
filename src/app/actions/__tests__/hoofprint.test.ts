import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

// Create fresh mock clients — each test resets these
let mockClient: ReturnType<typeof createMockSupabaseClient>;
let mockAdmin: ReturnType<typeof createMockSupabaseClient>;

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
vi.mock("@/lib/utils/rateLimit", () => ({
    checkRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/app/actions/transactions", () => ({
    createTransaction: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/notifications", () => ({
    createNotification: vi.fn().mockResolvedValue({ success: true }),
}));

import {
    generateTransferCode,
    claimTransfer,
    cancelTransfer,
    updateLifeStage,
    addTimelineEvent,
    initializeHoofprint,
    getMyPendingTransfers,
} from "@/app/actions/hoofprint";

describe("Hoofprint™ — Transfer & Provenance System", () => {
    beforeEach(() => {
        mockClient = createMockSupabaseClient();
        mockAdmin = createMockSupabaseClient();

        // Default: authenticated owner
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "owner-1", email: "owner@test.com" } },
        });
    });

    // ── generateTransferCode ──
    describe("generateTransferCode", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(
                generateTransferCode({
                    horseId: "h1",
                    acquisitionType: "purchase",
                })
            ).rejects.toThrow(AuthError);
        });

        it("rejects non-owner", async () => {
            // Horse lookup returns different owner
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", owner_id: "someone-else", trade_status: "Not for Sale" },
                error: null,
            });
            const result = await generateTransferCode({
                horseId: "h1",
                acquisitionType: "purchase",
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/don't own/i);
        });

        it("rejects Stolen/Missing horse", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", owner_id: "owner-1", trade_status: "Stolen/Missing" },
                error: null,
            });
            const result = await generateTransferCode({
                horseId: "h1",
                acquisitionType: "gift",
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Stolen/i);
        });

        it("succeeds for owner with valid horse", async () => {
            // Horse lookup: owned by owner-1, not stolen
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", owner_id: "owner-1", trade_status: "Not for Sale" },
                error: null,
            });
            // Cancel existing pending transfers (no-op mock)
            // Insert new transfer
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: null, error: null });

            const result = await generateTransferCode({
                horseId: "h1",
                acquisitionType: "purchase",
                salePrice: 500,
                isPricePublic: true,
                notes: "Great trade!",
            });
            expect(result.success).toBe(true);
            expect(result.code).toBeDefined();
            expect(result.code!.length).toBe(6);
            // Verify code is alphanumeric (no ambiguous chars like 0/O/1/I)
            expect(result.code).toMatch(/^[A-Z2-9]{6}$/);
        });

        it("generates unique codes across calls", async () => {
            const codes = new Set<string>();
            for (let i = 0; i < 10; i++) {
                mockClient._mockQuery.single.mockResolvedValueOnce({
                    data: { id: "h1", owner_id: "owner-1", trade_status: "Not for Sale" },
                    error: null,
                });
                const result = await generateTransferCode({
                    horseId: "h1",
                    acquisitionType: "transfer",
                });
                if (result.code) codes.add(result.code);
            }
            // With 31^6 = ~887M possible codes, 10 should be unique
            expect(codes.size).toBe(10);
        });
    });

    // ── claimTransfer ──
    describe("claimTransfer", () => {
        beforeEach(() => {
            // Switch to a different user (the claimant)
            mockClient.auth.getUser.mockResolvedValue({
                data: { user: { id: "claimant-1", email: "claimant@test.com" } },
            });
        });

        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(claimTransfer("ABC123")).rejects.toThrow(AuthError);
        });

        it("rejects when rate limited", async () => {
            const { checkRateLimit } = await import("@/lib/utils/rateLimit");
            (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

            const result = await claimTransfer("ABC123");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/too many attempts/i);
        });

        it("rejects invalid code (RPC error)", async () => {
            mockAdmin.rpc.mockResolvedValueOnce({
                data: { success: false, error: "Invalid or expired transfer code" },
                error: null,
            });
            const result = await claimTransfer("BADCODE");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/invalid|expired/i);
        });

        it("succeeds with valid code", async () => {
            mockAdmin.rpc.mockResolvedValueOnce({
                data: {
                    success: true,
                    horse_id: "h1",
                    horse_name: "Silver Charm",
                    sender_id: "owner-1",
                    sender_alias: "OwnerAlias",
                    receiver_alias: "ClaimantAlias",
                    sale_price: 300,
                },
                error: null,
            });

            const result = await claimTransfer("ABC123");
            expect(result.success).toBe(true);
            expect(result.horseName).toBe("Silver Charm");
            expect(result.horseId).toBe("h1");
        });
    });

    // ── cancelTransfer ──
    describe("cancelTransfer", () => {
        it("succeeds when transfer exists", async () => {
            const result = await cancelTransfer("transfer-1");
            expect(result.success).toBe(true);
            expect(mockClient.from).toHaveBeenCalledWith("horse_transfers");
        });

        it("returns error when DB fails", async () => {
            mockClient._mockQuery.eq.mockReturnValueOnce({
                ...mockClient._mockQuery,
                data: null,
                error: { message: "Not found" },
            });
            // The function calls .update().eq() — we need to mock the chain's final result
            // Since the mock returns this, the error needs to come from the chain result
            // cancelTransfer destructures { error } from the chained call
            // Mock: from() → mockQuery → .update() returns this → .eq() returns { data, error }
            mockClient = createMockSupabaseClient();
            mockClient.auth.getUser.mockResolvedValue({
                data: { user: { id: "owner-1", email: "o@test.com" } },
            });
            // Override the eq to return an error on the last call
            const eqMock = vi.fn()
                .mockReturnValueOnce({ data: null, error: { message: "Transfer not found" } });
            mockClient._mockQuery.update.mockReturnValue({ eq: eqMock });

            const result = await cancelTransfer("transfer-1");
            expect(result.success).toBe(false);
            expect(result.error).toBe("Transfer not found");
        });
    });

    // ── updateLifeStage ──
    describe("updateLifeStage", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(updateLifeStage("h1", "completed")).rejects.toThrow(AuthError);
        });

        it("rejects when horse not found", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: null,
                error: null,
            });
            const result = await updateLifeStage("h1", "completed");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("no-ops when same stage", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { life_stage: "completed" },
                error: null,
            });
            const result = await updateLifeStage("h1", "completed");
            expect(result.success).toBe(true);
            // Should NOT call update since stage didn't change
        });

        it("succeeds with valid stage change", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { life_stage: "blank" },
                error: null,
            });
            const result = await updateLifeStage("h1", "in_progress");
            expect(result.success).toBe(true);
        });
    });

    // ── addTimelineEvent ──
    describe("addTimelineEvent", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(
                addTimelineEvent({
                    horseId: "h1",
                    eventType: "note",
                    title: "Test Event",
                })
            ).rejects.toThrow(AuthError);
        });

        it("succeeds with title only", async () => {
            const result = await addTimelineEvent({
                horseId: "h1",
                eventType: "note",
                title: "New shoes applied",
            });
            expect(result.success).toBe(true);
            expect(mockClient.from).toHaveBeenCalledWith("posts");
        });

        it("concatenates title and description into post content", async () => {
            await addTimelineEvent({
                horseId: "h1",
                eventType: "custom",
                title: "Show Prep",
                description: "Detailed grooming notes",
            });
            // Verify the insert was called with concatenated content
            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: "Show Prep\n\nDetailed grooming notes",
                    horse_id: "h1",
                    author_id: "owner-1",
                })
            );
        });
    });

    // ── initializeHoofprint ──
    describe("initializeHoofprint", () => {
        it("creates ownership record with user alias", async () => {
            // Profile lookup
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { alias_name: "HorseCollector42" },
                error: null,
            });

            await initializeHoofprint({
                horseId: "h1",
                horseName: "Silver Charm",
                acquisitionNotes: "Won at auction",
            });

            expect(mockClient.from).toHaveBeenCalledWith("horse_ownership_history");
            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    horse_id: "h1",
                    owner_id: "owner-1",
                    owner_alias: "HorseCollector42",
                    acquisition_type: "original",
                    notes: "Won at auction",
                })
            );
        });

        it("uses Unknown alias when profile missing", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: null,
                error: null,
            });

            await initializeHoofprint({
                horseId: "h1",
                horseName: "Test Horse",
            });

            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    owner_alias: "Unknown",
                    notes: null,
                })
            );
        });
    });

    // ── getMyPendingTransfers ──
    describe("getMyPendingTransfers", () => {
        it("returns empty array when no pending transfers", async () => {
            // Override mock to resolve with data/error shape
            mockClient.from.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
            } as any);

            const result = await getMyPendingTransfers();
            expect(result).toEqual([]);
        });
    });
});
