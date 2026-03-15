import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

// Create fresh mock clients — each test resets these
let mockClient: ReturnType<typeof createMockSupabaseClient>;
let mockAdmin: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => {
        return Promise.resolve(mockClient);
    }),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("@/app/actions/notifications", () => ({
    createNotification: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/activity", () => ({
    createActivityEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/actions/messaging", () => ({
    createOrFindConversation: vi.fn().mockResolvedValue({ success: true, conversationId: "conv-1" }),
}));

import {
    makeOffer,
    respondToOffer,
    markPaymentSent,
    cancelTransaction,
    retractOffer,
} from "@/app/actions/transactions";

describe("Commerce State Machine — transactions.ts", () => {
    beforeEach(() => {
        // Create fresh mock clients per test for isolation
        mockClient = createMockSupabaseClient();
        mockAdmin = createMockSupabaseClient();

        // Default: authenticated as buyer
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "buyer-1", email: "buyer@test.com" } },
        });
    });

    // ── makeOffer ──
    describe("makeOffer", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(makeOffer({ horseId: "h1", sellerId: "s1", amount: 100 })).rejects.toThrow(AuthError);
        });

        it("rejects buying own horse", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: "seller-1", email: "s@test.com" } },
            });
            const result = await makeOffer({ horseId: "h1", sellerId: "seller-1", amount: 100 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/own horse/i);
        });

        it("rejects zero or negative amount", async () => {
            const result = await makeOffer({ horseId: "h1", sellerId: "s1", amount: 0 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/positive/i);
        });

        it("rejects when horse not found", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
            const result = await makeOffer({ horseId: "h1", sellerId: "s1", amount: 100 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("rejects when horse not For Sale", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", trade_status: "Not for Sale", custom_name: "Test", owner_id: "s1" },
                error: null,
            });
            const result = await makeOffer({ horseId: "h1", sellerId: "s1", amount: 100 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not available/i);
        });

        it("succeeds with valid offer on For Sale horse", async () => {
            // Horse lookup (user supabase)
            mockClient._mockQuery.single
                .mockResolvedValueOnce({
                    data: { id: "h1", trade_status: "For Sale", custom_name: "Trigger", owner_id: "s1" },
                    error: null,
                })
                // Buyer profile (second .single call on mockClient)
                .mockResolvedValueOnce({
                    data: { alias_name: "BuyerAlias" },
                    error: null,
                });

            // Admin: existing offer check
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            // Admin: transaction insert
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1" },
                error: null,
            });

            const result = await makeOffer({ horseId: "h1", sellerId: "s1", amount: 150 });
            expect(result.success).toBe(true);
            expect(result.transactionId).toBe("txn-1");
            expect(result.conversationId).toBe("conv-1");
        });
    });

    // ── respondToOffer ──
    describe("respondToOffer", () => {
        beforeEach(() => {
            mockClient.auth.getUser.mockResolvedValue({
                data: { user: { id: "seller-1", email: "s@test.com" } },
            });
        });

        it("rejects non-seller", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: "random-user", email: "r@test.com" } },
            });
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "offer_made", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1", offer_amount: 100 },
                error: null,
            });
            const result = await respondToOffer("txn-1", "accept");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the seller/i);
        });

        it("rejects already-accepted offer", async () => {
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "pending_payment", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1", offer_amount: 100 },
                error: null,
            });
            const result = await respondToOffer("txn-1", "accept");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no longer pending/i);
        });

        it("declines offer successfully", async () => {
            // Admin: txn lookup
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "offer_made", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1", offer_amount: 100 },
                error: null,
            });
            // User: seller profile
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { alias_name: "SellerAlias" },
                error: null,
            });

            const result = await respondToOffer("txn-1", "decline");
            expect(result.success).toBe(true);
        });
    });

    // ── markPaymentSent ──
    describe("markPaymentSent", () => {
        it("rejects non-buyer", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: "seller-1", email: "s@test.com" } },
            });
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "pending_payment", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1", offer_amount: 100 },
                error: null,
            });
            const result = await markPaymentSent("txn-1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the buyer/i);
        });

        it("rejects wrong status", async () => {
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "offer_made", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1", offer_amount: 100 },
                error: null,
            });
            const result = await markPaymentSent("txn-1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not awaiting payment/i);
        });

        it("succeeds when buyer marks payment on pending_payment", async () => {
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "pending_payment", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1", offer_amount: 100 },
                error: null,
            });
            // Buyer profile + horse name (chained .single calls on mockClient)
            mockClient._mockQuery.single
                .mockResolvedValueOnce({ data: { alias_name: "BuyerAlias" }, error: null })
                .mockResolvedValueOnce({ data: { custom_name: "Trigger" }, error: null });

            const result = await markPaymentSent("txn-1");
            expect(result.success).toBe(true);
        });
    });

    // ── cancelTransaction ──
    describe("cancelTransaction", () => {
        beforeEach(() => {
            mockClient.auth.getUser.mockResolvedValue({
                data: { user: { id: "seller-1", email: "s@test.com" } },
            });
        });

        it("rejects non-seller", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: "buyer-1", email: "b@test.com" } },
            });
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "pending_payment", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1" },
                error: null,
            });
            const result = await cancelTransaction("txn-1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the seller/i);
        });

        it("rejects cancelling completed transaction", async () => {
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "completed", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1" },
                error: null,
            });
            const result = await cancelTransaction("txn-1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/cannot be cancelled/i);
        });

        it("succeeds during pending_payment", async () => {
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "pending_payment", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1" },
                error: null,
            });
            // Seller profile
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { alias_name: "SellerAlias" },
                error: null,
            });

            const result = await cancelTransaction("txn-1");
            expect(result.success).toBe(true);
        });
    });

    // ── retractOffer ──
    describe("retractOffer", () => {
        it("rejects non-buyer", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: "seller-1", email: "s@test.com" } },
            });
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "offer_made", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1" },
                error: null,
            });
            const result = await retractOffer("txn-1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the buyer/i);
        });

        it("rejects retract after accepted", async () => {
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "pending_payment", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1" },
                error: null,
            });
            const result = await retractOffer("txn-1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/pending/i);
        });

        it("succeeds during offer_made", async () => {
            mockAdmin._mockQuery.single.mockResolvedValueOnce({
                data: { id: "txn-1", status: "offer_made", party_a_id: "seller-1", party_b_id: "buyer-1", horse_id: "h1", conversation_id: "c1" },
                error: null,
            });
            // Buyer profile
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { alias_name: "BuyerAlias" },
                error: null,
            });

            const result = await retractOffer("txn-1");
            expect(result.success).toBe(true);
        });
    });
});
