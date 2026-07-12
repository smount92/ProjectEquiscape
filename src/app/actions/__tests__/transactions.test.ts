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
vi.mock("next/server", () => ({
    after: vi.fn(),
}));
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/activity", () => ({
    createActivityEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/actions/messaging", () => ({
    createOrFindConversation: vi.fn().mockResolvedValue({ success: true, conversationId: "conv-1" }),
}));
const mockParkHorse = vi.fn();
vi.mock("@/app/actions/parked-export", () => ({
    parkHorse: (...args: unknown[]) => mockParkHorse(...args),
}));

import {
    createTransaction,
    completeTransaction,
    leaveReview,
    deleteReview,
    getUserReviewSummary,
    getTransactionByConversation,
    makeOffer,
    respondToOffer,
    markPaymentSent,
    verifyFundsAndRelease,
    cancelTransaction,
    retractOffer,
} from "@/app/actions/transactions";

// Valid UUIDs — inputs are zod-validated before anything else runs.
const SELLER = "11111111-1111-4111-8111-111111111111";
const BUYER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";
const HORSE = "44444444-4444-4444-8444-444444444444";
const TXN = "55555555-5555-4555-8555-555555555555";
const CONV = "66666666-6666-4666-8666-666666666666";

const authAs = (id: string) => {
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id, email: `${id.slice(0, 4)}@test.com` } },
    });
};

/** A marketplace_sale row in the shape the actions select. */
const txnRow = (status: string, extra: Record<string, unknown> = {}) => ({
    id: TXN,
    status,
    party_a_id: SELLER,
    party_b_id: BUYER,
    horse_id: HORSE,
    conversation_id: CONV,
    offer_amount: 100,
    ...extra,
});

describe("Commerce State Machine — transactions.ts", () => {
    beforeEach(() => {
        // Create fresh mock clients per test for isolation
        mockClient = createMockSupabaseClient();
        mockAdmin = createMockSupabaseClient();
        mockParkHorse.mockReset();
        mockParkHorse.mockResolvedValue({ success: true, pin: "ABC234", transferId: "tr-1" });

        // Default: authenticated as buyer
        authAs(BUYER);
    });

    // ── makeOffer ──
    describe("makeOffer", () => {
        const validOffer = { horseId: HORSE, sellerId: SELLER, amount: 100 };

        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(makeOffer(validOffer)).rejects.toThrow(AuthError);
        });

        it("rejects buying own horse", async () => {
            authAs(SELLER);
            const result = await makeOffer({ ...validOffer, sellerId: SELLER });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/own horse/i);
        });

        it("rejects zero or negative amount (zod)", async () => {
            const zero = await makeOffer({ ...validOffer, amount: 0 });
            expect(zero.success).toBe(false);
            expect(zero.error).toMatch(/positive/i);

            const negative = await makeOffer({ ...validOffer, amount: -50 });
            expect(negative.success).toBe(false);
            expect(negative.error).toMatch(/positive/i);
        });

        it("rejects NaN and absurd amounts (zod)", async () => {
            const nan = await makeOffer({ ...validOffer, amount: NaN });
            expect(nan.success).toBe(false);

            const huge = await makeOffer({ ...validOffer, amount: 10_000_000 });
            expect(huge.success).toBe(false);
            expect(huge.error).toMatch(/cannot exceed/i);
        });

        it("rejects sub-cent precision (zod)", async () => {
            const result = await makeOffer({ ...validOffer, amount: 99.999 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/decimal/i);
        });

        it("rejects non-uuid ids without touching the database (zod)", async () => {
            const result = await makeOffer({ ...validOffer, horseId: "h1" });
            expect(result.success).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
            expect(mockClient.rpc).not.toHaveBeenCalled();
        });

        it("rejects an over-long message (zod)", async () => {
            const result = await makeOffer({ ...validOffer, message: "x".repeat(501) });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/too long/i);
        });

        it("rejects when horse not found (RPC)", async () => {
            mockClient.rpc.mockResolvedValueOnce({ data: { success: false, error: "Horse not found" }, error: null });
            const result = await makeOffer(validOffer);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("rejects when horse not For Sale (RPC)", async () => {
            mockClient.rpc.mockResolvedValueOnce({ data: { success: false, error: "Horse is not available for offers" }, error: null });
            const result = await makeOffer(validOffer);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not available/i);
        });

        it("succeeds with valid offer on For Sale horse", async () => {
            // Horse name pre-fetch
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: { custom_name: "Trigger" }, error: null });
            // Atomic RPC (user client — SECURITY DEFINER, granted to authenticated)
            mockClient.rpc.mockResolvedValueOnce({
                data: { success: true, transaction_id: TXN },
                error: null,
            });
            // Buyer profile for notification
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: { alias_name: "BuyerAlias" }, error: null });

            const result = await makeOffer({ ...validOffer, amount: 150 });
            expect(result.success).toBe(true);
            expect(result.transactionId).toBe(TXN);
            expect(result.conversationId).toBe("conv-1");
            expect(mockClient.rpc).toHaveBeenCalledWith("make_offer_atomic", expect.objectContaining({
                p_buyer_id: BUYER,
                p_seller_id: SELLER,
                p_offered_price: 150,
            }));
        });
    });

    // ── respondToOffer ──
    describe("respondToOffer", () => {
        beforeEach(() => authAs(SELLER));

        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(respondToOffer(TXN, "accept")).rejects.toThrow(AuthError);
        });

        it("rejects a non-uuid transaction id (zod)", async () => {
            const result = await respondToOffer("txn-1", "accept");
            expect(result.success).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("rejects an unknown action verb (zod)", async () => {
            const result = await respondToOffer(TXN, "approve" as "accept");
            expect(result.success).toBe(false);
        });

        it("rejects non-seller before calling the RPC (authz)", async () => {
            authAs(STRANGER);
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("offer_made"), error: null });
            const result = await respondToOffer(TXN, "accept");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the seller/i);
            expect(mockClient.rpc).not.toHaveBeenCalled();
        });

        it("rejects the buyer trying to accept their own offer (authz)", async () => {
            authAs(BUYER);
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("offer_made"), error: null });
            const result = await respondToOffer(TXN, "accept");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the seller/i);
        });

        it("rejects already-accepted offer (status guard)", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("pending_payment"), error: null });
            const result = await respondToOffer(TXN, "accept");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no longer pending/i);
            expect(mockClient.rpc).not.toHaveBeenCalled();
        });

        it("rejects when transaction not found", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
            const result = await respondToOffer(TXN, "accept");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("surfaces an RPC refusal (row-locked authority)", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("offer_made"), error: null });
            mockClient.rpc.mockResolvedValueOnce({
                data: { success: false, error: "Transaction is no longer in offer_made state" },
                error: null,
            });
            const result = await respondToOffer(TXN, "accept");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no longer in offer_made/i);
        });

        it("declines offer successfully", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("offer_made"), error: null });
            mockClient.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });
            // Seller profile for notification
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: { alias_name: "SellerAlias" }, error: null });

            const result = await respondToOffer(TXN, "decline");
            expect(result.success).toBe(true);
            expect(mockClient.rpc).toHaveBeenCalledWith("respond_to_offer_atomic", {
                p_transaction_id: TXN,
                p_seller_id: SELLER,
                p_action: "decline",
            });
        });

        it("accepts offer successfully", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("offer_made"), error: null });
            mockClient.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });
            // Horse name for the buyer notification
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: { custom_name: "Trigger" }, error: null });

            const result = await respondToOffer(TXN, "accept");
            expect(result.success).toBe(true);
        });
    });

    // ── markPaymentSent ──
    describe("markPaymentSent", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(markPaymentSent(TXN)).rejects.toThrow(AuthError);
        });

        it("rejects a non-uuid transaction id (zod)", async () => {
            const result = await markPaymentSent("txn-1");
            expect(result.success).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("rejects non-buyer (authz)", async () => {
            authAs(SELLER);
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("pending_payment"), error: null });
            const result = await markPaymentSent(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the buyer/i);
        });

        it("rejects a stranger (authz)", async () => {
            authAs(STRANGER);
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("pending_payment"), error: null });
            const result = await markPaymentSent(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the buyer/i);
        });

        it("rejects wrong status (status guard)", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("offer_made"), error: null });
            const result = await markPaymentSent(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not awaiting payment/i);
        });

        it("succeeds when buyer marks payment on pending_payment", async () => {
            mockClient._mockQuery.single
                .mockResolvedValueOnce({ data: txnRow("pending_payment"), error: null })
                // Buyer profile + horse name for the seller notification
                .mockResolvedValueOnce({ data: { alias_name: "BuyerAlias" }, error: null })
                .mockResolvedValueOnce({ data: { custom_name: "Trigger" }, error: null });

            const result = await markPaymentSent(TXN);
            expect(result.success).toBe(true);
        });
    });

    // ── verifyFundsAndRelease ──
    describe("verifyFundsAndRelease", () => {
        beforeEach(() => authAs(SELLER));

        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(verifyFundsAndRelease(TXN)).rejects.toThrow(AuthError);
        });

        it("rejects a non-uuid transaction id (zod)", async () => {
            const result = await verifyFundsAndRelease("txn-1");
            expect(result.success).toBe(false);
            expect(mockParkHorse).not.toHaveBeenCalled();
        });

        it("rejects non-seller (authz)", async () => {
            authAs(BUYER);
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: txnRow("pending_payment", { paid_at: "2026-07-01T00:00:00Z" }),
                error: null,
            });
            const result = await verifyFundsAndRelease(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the seller/i);
            expect(mockParkHorse).not.toHaveBeenCalled();
        });

        it("rejects wrong status (status guard)", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: txnRow("funds_verified", { paid_at: "2026-07-01T00:00:00Z" }),
                error: null,
            });
            const result = await verifyFundsAndRelease(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not awaiting verification/i);
        });

        it("rejects when buyer has not marked payment sent", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: txnRow("pending_payment", { paid_at: null }),
                error: null,
            });
            const result = await verifyFundsAndRelease(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not yet marked payment/i);
            expect(mockParkHorse).not.toHaveBeenCalled();
        });

        it("surfaces a parkHorse failure", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: txnRow("pending_payment", { paid_at: "2026-07-01T00:00:00Z" }),
                error: null,
            });
            mockParkHorse.mockResolvedValueOnce({ success: false, error: "Cannot park a horse flagged as Stolen/Missing." });
            const result = await verifyFundsAndRelease(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/stolen/i);
        });

        it("succeeds and returns the claim PIN", async () => {
            mockClient._mockQuery.single
                .mockResolvedValueOnce({
                    data: txnRow("pending_payment", { paid_at: "2026-07-01T00:00:00Z" }),
                    error: null,
                })
                // Horse name for the buyer notification
                .mockResolvedValueOnce({ data: { custom_name: "Trigger" }, error: null });

            const result = await verifyFundsAndRelease(TXN);
            expect(result.success).toBe(true);
            expect(result.pin).toBe("ABC234");
            expect(mockParkHorse).toHaveBeenCalledWith(HORSE);
        });
    });

    // ── cancelTransaction ──
    describe("cancelTransaction", () => {
        beforeEach(() => authAs(SELLER));

        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(cancelTransaction(TXN)).rejects.toThrow(AuthError);
        });

        it("rejects a non-uuid transaction id (zod)", async () => {
            const result = await cancelTransaction("txn-1");
            expect(result.success).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("rejects non-seller (authz)", async () => {
            authAs(BUYER);
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("pending_payment"), error: null });
            const result = await cancelTransaction(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the seller/i);
        });

        it("rejects cancelling completed transaction (status guard)", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("completed"), error: null });
            const result = await cancelTransaction(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/cannot be cancelled/i);
        });

        it("succeeds during pending_payment", async () => {
            mockClient._mockQuery.single
                .mockResolvedValueOnce({ data: txnRow("pending_payment"), error: null })
                // Seller profile for the buyer notification
                .mockResolvedValueOnce({ data: { alias_name: "SellerAlias" }, error: null });

            const result = await cancelTransaction(TXN);
            expect(result.success).toBe(true);
        });

        it("succeeds during funds_verified (unparks the horse)", async () => {
            mockClient._mockQuery.single
                .mockResolvedValueOnce({ data: txnRow("funds_verified"), error: null })
                .mockResolvedValueOnce({ data: { alias_name: "SellerAlias" }, error: null });

            const result = await cancelTransaction(TXN);
            expect(result.success).toBe(true);
            // txn cancel + horse trade_status + unpark + transfer-PIN cancel
            expect(mockClient._mockQuery.update).toHaveBeenCalledTimes(4);
        });
    });

    // ── retractOffer ──
    describe("retractOffer", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(retractOffer(TXN)).rejects.toThrow(AuthError);
        });

        it("rejects a non-uuid transaction id (zod)", async () => {
            const result = await retractOffer("txn-1");
            expect(result.success).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("rejects non-buyer (authz)", async () => {
            authAs(SELLER);
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("offer_made"), error: null });
            const result = await retractOffer(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/only the buyer/i);
        });

        it("rejects retract after accepted (status guard)", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: txnRow("pending_payment"), error: null });
            const result = await retractOffer(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/pending/i);
        });

        it("succeeds during offer_made", async () => {
            mockClient._mockQuery.single
                .mockResolvedValueOnce({ data: txnRow("offer_made"), error: null })
                // Buyer profile for the seller notification
                .mockResolvedValueOnce({ data: { alias_name: "BuyerAlias" }, error: null });

            const result = await retractOffer(TXN);
            expect(result.success).toBe(true);
        });
    });

    // ── createTransaction ──
    describe("createTransaction", () => {
        const validTxn = {
            type: "parked_sale" as const,
            partyAId: SELLER,
            partyBId: BUYER,
            horseId: HORSE,
            status: "completed" as const,
        };

        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(createTransaction(validTxn)).rejects.toThrow(AuthError);
        });

        it("rejects invalid party ids (zod)", async () => {
            const result = await createTransaction({ ...validTxn, partyAId: "seller-1" });
            expect(result.success).toBe(false);
            expect(mockAdmin.from).not.toHaveBeenCalled();
        });

        it("rejects an unknown type (zod)", async () => {
            const result = await createTransaction({ ...validTxn, type: "gift" as "transfer" });
            expect(result.success).toBe(false);
        });

        it("rejects a caller who is not a party (authz)", async () => {
            authAs(STRANGER);
            const result = await createTransaction(validTxn);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/party to the transaction/i);
            expect(mockAdmin.from).not.toHaveBeenCalled();
        });

        it("succeeds when the caller is a party (admin insert)", async () => {
            authAs(BUYER);
            mockAdmin._mockQuery.single.mockResolvedValueOnce({ data: { id: TXN }, error: null });
            const result = await createTransaction(validTxn);
            expect(result.success).toBe(true);
            expect(result.transactionId).toBe(TXN);
            expect(mockAdmin.from).toHaveBeenCalledWith("transactions");
        });
    });

    // ── completeTransaction ──
    describe("completeTransaction", () => {
        it("rejects a non-uuid transaction id (zod)", async () => {
            const result = await completeTransaction("txn-1");
            expect(result.success).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("rejects when transaction not found", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            const result = await completeTransaction(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("rejects a caller who is not a party (authz)", async () => {
            authAs(STRANGER);
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("funds_verified"), error: null });
            const result = await completeTransaction(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/party to this transaction/i);
        });

        it("rejects completion from cancelled (status guard)", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("cancelled"), error: null });
            const result = await completeTransaction(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/cannot be completed/i);
        });

        it("rejects completion from offer_made (status guard)", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("offer_made"), error: null });
            const result = await completeTransaction(TXN);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/cannot be completed/i);
        });

        it("succeeds from funds_verified for a party", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("funds_verified"), error: null });
            const result = await completeTransaction(TXN);
            expect(result.success).toBe(true);
        });

        it("succeeds from legacy pending for a party", async () => {
            authAs(SELLER);
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("pending"), error: null });
            const result = await completeTransaction(TXN);
            expect(result.success).toBe(true);
        });
    });

    // ── leaveReview ──
    describe("leaveReview", () => {
        const validReview = { transactionId: TXN, targetId: SELLER, stars: 5 };

        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(leaveReview(validReview)).rejects.toThrow(AuthError);
        });

        it("rejects out-of-range and fractional stars (zod)", async () => {
            for (const stars of [0, 6, 3.5, NaN]) {
                const result = await leaveReview({ ...validReview, stars });
                expect(result.success).toBe(false);
                expect(result.error).toBe("Stars must be 1-5.");
            }
        });

        it("rejects non-uuid ids (zod)", async () => {
            const result = await leaveReview({ ...validReview, transactionId: "t1" });
            expect(result.success).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("rejects reviewing yourself", async () => {
            const result = await leaveReview({ ...validReview, targetId: BUYER });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/yourself/i);
        });

        it("rejects when the transaction is not visible to the caller (authz)", async () => {
            // RLS: non-parties don't see the row → not found
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            const result = await leaveReview(validReview);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("rejects reviewing a non-completed transaction (status guard)", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("pending_payment"), error: null });
            const result = await leaveReview(validReview);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/completed/i);
        });

        it("rejects a target who is not the other party", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("completed"), error: null });
            const result = await leaveReview({ ...validReview, targetId: STRANGER });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/other party/i);
        });

        it("maps the unique-constraint violation to a friendly error", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("completed"), error: null });
            mockClient._setImplicitResolve({ data: null, error: { code: "23505", message: "duplicate" } });
            const result = await leaveReview(validReview);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/already reviewed/i);
        });

        it("succeeds for a party on a completed transaction", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: txnRow("completed"), error: null });
            // Reviewer alias for the notification
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: { alias_name: "BuyerAlias" }, error: null });
            const result = await leaveReview({ ...validReview, content: "Great trade!" });
            expect(result.success).toBe(true);
        });
    });

    // ── deleteReview ──
    describe("deleteReview", () => {
        it("rejects a non-uuid review id (zod)", async () => {
            const result = await deleteReview("r1");
            expect(result.success).toBe(false);
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("succeeds (RLS scopes the delete to the caller's own review)", async () => {
            const result = await deleteReview(TXN);
            expect(result.success).toBe(true);
        });
    });

    // ── getUserReviewSummary ──
    describe("getUserReviewSummary", () => {
        it("returns an empty summary for an invalid user id", async () => {
            const result = await getUserReviewSummary("not-a-uuid");
            expect(result).toEqual({ average: 0, count: 0, ratings: [] });
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("averages reviews to one decimal", async () => {
            mockClient._setImplicitResolve({
                data: [
                    { id: "r1", stars: 5, content: "great", created_at: "2026-01-01", reviewer_id: BUYER, users: { alias_name: "B" } },
                    { id: "r2", stars: 4, content: null, created_at: "2026-01-02", reviewer_id: STRANGER, users: { alias_name: "S" } },
                ],
                error: null,
            });
            const result = await getUserReviewSummary(SELLER);
            expect(result.count).toBe(2);
            expect(result.average).toBe(4.5);
            expect(result.ratings[0].reviewerAlias).toBe("B");
        });
    });

    // ── getTransactionByConversation ──
    describe("getTransactionByConversation", () => {
        it("returns null for an invalid conversation id", async () => {
            const result = await getTransactionByConversation("not-a-uuid");
            expect(result).toBeNull();
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it("maps the row to the OfferCard shape", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: {
                    id: TXN, status: "pending_payment", type: "marketplace_sale",
                    offer_amount: 100, offer_message: "hi", party_a_id: SELLER, party_b_id: BUYER,
                    horse_id: HORSE, paid_at: null, verified_at: null, metadata: null,
                },
                error: null,
            });
            const result = await getTransactionByConversation(CONV);
            expect(result).toEqual({
                transactionId: TXN,
                status: "pending_payment",
                type: "marketplace_sale",
                offerAmount: 100,
                offerMessage: "hi",
                partyAId: SELLER,
                partyBId: BUYER,
                horseId: HORSE,
                paidAt: null,
                verifiedAt: null,
                metadata: null,
            });
        });

        it("returns null when the conversation has no transaction", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            const result = await getTransactionByConversation(CONV);
            expect(result).toBeNull();
        });
    });
});
