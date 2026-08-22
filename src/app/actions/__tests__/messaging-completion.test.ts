import { vi, describe, it, expect, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { ALL_SUPPORTED, resetDealColumnSupport } from "@/lib/deals/columnSupport";

/**
 * COMPLETION TAKES BOTH SIDES — audit C4.
 *
 * markTransactionComplete used to verify only that the caller was a party
 * to the conversation, flip transaction_status to 'completed', and mint a
 * COMPLETED marketplace_sale — whose forgery guard then checked the very
 * flag the same call had set. One member could open a thread with anyone,
 * click once, and hold a "verified" review on a deal that never happened.
 *
 * These are the regression tests for the mutual-confirmation rule.
 */

let mockClient: ReturnType<typeof createMockSupabaseClient>;
const mockCreateTransaction = vi.fn().mockResolvedValue({ success: true, transactionId: "t-1" });

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn(() => mockClient) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/utils/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/app/actions/transactions", () => ({
    createTransaction: (...args: unknown[]) => mockCreateTransaction(...args),
}));
let support = { ...ALL_SUPPORTED };
vi.mock("@/lib/deals/columnSupport", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/deals/columnSupport")>();
    return { ...actual, getDealColumnSupport: vi.fn(() => Promise.resolve(support)) };
});

import { markTransactionComplete } from "@/app/actions/messaging";

const SELLER = "11111111-1111-4111-8111-111111111111";
const BUYER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";
const CONVO = "44444444-4444-4444-8444-444444444444";
const HORSE = "66666666-6666-4666-8666-666666666666";

const authAs = (id: string) =>
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id, email: "x@example.com" } },
    });

const convoRow = (patch: Record<string, unknown> = {}) => ({
    buyer_id: BUYER,
    seller_id: SELLER,
    horse_id: HORSE,
    transaction_status: "open",
    completion_confirmed_by_buyer_at: null,
    completion_confirmed_by_seller_at: null,
    ...patch,
});

/** The conversation read, then the alias read for the notification. */
const queueConvo = (convo: unknown) => {
    mockClient._mockQuery.maybeSingle
        .mockResolvedValueOnce({ data: convo, error: null })
        .mockResolvedValue({ data: { alias_name: "sam" }, error: null });
};

describe("markTransactionComplete — completion takes both sides", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetDealColumnSupport();
        support = { ...ALL_SUPPORTED };
        mockClient = createMockSupabaseClient();
        mockClient._setImplicitResolve({ data: [], error: null });
        mockCreateTransaction.mockResolvedValue({ success: true, transactionId: "t-1" });
        authAs(BUYER);
    });

    it("records only the caller's own confirmation on the first click", async () => {
        queueConvo(convoRow());

        const result = await markTransactionComplete(CONVO);

        expect(result.success).toBe(true);
        expect(result.awaitingOther).toBe(true);
        const patch = mockClient._mockQuery.update.mock.calls[0][0] as Record<string, unknown>;
        expect(patch.completion_confirmed_by_buyer_at).toEqual(expect.any(String));
        expect(patch.completion_confirmed_by_seller_at).toBeUndefined();
        // The flag the review guard reads must NOT move on one say-so.
        expect(patch.transaction_status).toBeUndefined();
    });

    it("does not mint a completed sale — or a reviewable one — on one say-so", async () => {
        queueConvo(convoRow());
        await markTransactionComplete(CONVO);
        expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it("cannot be completed by clicking twice as the same party", async () => {
        queueConvo(convoRow({ completion_confirmed_by_buyer_at: "2026-08-01T00:00:00Z" }));

        const result = await markTransactionComplete(CONVO);

        expect(result.success).toBe(true);
        expect(result.awaitingOther).toBe(true);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it("completes when the OTHER side answers, and mints the sale then", async () => {
        authAs(SELLER);
        queueConvo(convoRow({ completion_confirmed_by_buyer_at: "2026-08-01T00:00:00Z" }));

        const result = await markTransactionComplete(CONVO);

        expect(result.success).toBe(true);
        expect(result.awaitingOther).toBeUndefined();
        const patch = mockClient._mockQuery.update.mock.calls[0][0] as Record<string, unknown>;
        expect(patch.completion_confirmed_by_seller_at).toEqual(expect.any(String));
        expect(patch.transaction_status).toBe("completed");
        expect(mockCreateTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "marketplace_sale",
                partyAId: SELLER,
                partyBId: BUYER,
                status: "completed",
            }),
        );
    });

    it("refuses a caller who is not part of the conversation", async () => {
        authAs(STRANGER);
        queueConvo(convoRow());

        const result = await markTransactionComplete(CONVO);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unauthorized/i);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("requires a login", async () => {
        mockClient.auth.getUser.mockResolvedValue({ data: { user: null } });
        const result = await markTransactionComplete(CONVO);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/logged in/i);
    });

    it("fails CLOSED before migration 180 rather than completing unilaterally", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: { code: "42703", message: "column ... does not exist" },
        });

        const result = await markTransactionComplete(CONVO);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/database update that hasn't been applied/i);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it("is idempotent once the deal is already complete", async () => {
        queueConvo(convoRow({
            transaction_status: "completed",
            completion_confirmed_by_buyer_at: "2026-08-01T00:00:00Z",
            completion_confirmed_by_seller_at: "2026-08-02T00:00:00Z",
        }));

        const result = await markTransactionComplete(CONVO);

        expect(result.success).toBe(true);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        expect(mockCreateTransaction).not.toHaveBeenCalled();
    });
});
