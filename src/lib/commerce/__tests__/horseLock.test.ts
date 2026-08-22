import { vi, describe, it, expect, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

/**
 * ONE HORSE, ONE SALE — audit C3.
 *
 * The double-sell the audit traced: Buyer1 accepts a counter (horse goes
 * to Pending Sale, txn2 untouched), the seller then accepts Buyer2's
 * original offer, and both are in pending_payment for one model. These
 * cover the shared guard both accept paths now run.
 */

let mockAdmin: ReturnType<typeof createMockSupabaseClient>;
const mockCreateNotification = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn(() => mockAdmin) }));
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

import { assertHorseAvailable, cancelSiblingOffers } from "@/lib/commerce/horseLock";

const HORSE = "44444444-4444-4444-8444-444444444444";
const TXN = "55555555-5555-4555-8555-555555555555";
const RIVAL = "66666666-6666-4666-8666-666666666666";
const SELLER = "11111111-1111-4111-8111-111111111111";
const LOSER = "22222222-2222-4222-8222-222222222222";

describe("horseLock — assertHorseAvailable", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAdmin = createMockSupabaseClient();
        mockAdmin._setImplicitResolve({ data: [], error: null });
    });

    it("allows an accept when nothing else is happening to the horse", async () => {
        mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { trade_status: "Open to Offers" },
            error: null,
        });
        const result = await assertHorseAvailable({ horseId: HORSE, transactionId: TXN });
        expect(result.ok).toBe(true);
    });

    it("refuses when another transaction on the horse is already live", async () => {
        mockAdmin._setImplicitResolve({ data: [{ id: RIVAL }], error: null });
        const result = await assertHorseAvailable({ horseId: HORSE, transactionId: TXN });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toMatch(/already under way/i);
    });

    it("refuses a horse already flagged Pending Sale", async () => {
        mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { trade_status: "Pending Sale" },
            error: null,
        });
        const result = await assertHorseAvailable({ horseId: HORSE, transactionId: TXN });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toMatch(/pending sale/i);
    });

    it("never counts the transaction being accepted against itself", async () => {
        mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { trade_status: "For Sale" },
            error: null,
        });
        await assertHorseAvailable({ horseId: HORSE, transactionId: TXN });
        expect(mockAdmin._mockQuery.neq).toHaveBeenCalledWith("id", TXN);
    });

    it("passes straight through for a deal with no horse (a commission)", async () => {
        const result = await assertHorseAvailable({ horseId: null, transactionId: TXN });
        expect(result.ok).toBe(true);
        expect(mockAdmin.from).not.toHaveBeenCalled();
    });

    it("fails OPEN on a read error rather than stranding every seller", async () => {
        mockAdmin._setImplicitResolve({ data: null, error: { message: "boom" } });
        const result = await assertHorseAvailable({ horseId: HORSE, transactionId: TXN });
        expect(result.ok).toBe(true);
    });
});

describe("horseLock — cancelSiblingOffers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAdmin = createMockSupabaseClient();
        mockAdmin._setImplicitResolve({ data: [], error: null });
    });

    it("closes every other standing offer and tells those buyers why", async () => {
        mockAdmin._setImplicitResolve({
            data: [{ id: RIVAL, party_b_id: LOSER, conversation_id: "conv-9" }],
            error: null,
        });

        const result = await cancelSiblingOffers({
            horseId: HORSE,
            keepTransactionId: TXN,
            actorId: SELLER,
            horseName: "Trigger",
        });

        expect(result.cancelled).toBe(1);
        expect(mockAdmin._mockQuery.update).toHaveBeenCalledWith({ status: "cancelled" });
        expect(mockCreateNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: LOSER,
                content: expect.stringContaining("Trigger"),
            }),
        );
    });

    it("never touches the offer that won", async () => {
        mockAdmin._setImplicitResolve({ data: [], error: null });
        await cancelSiblingOffers({
            horseId: HORSE,
            keepTransactionId: TXN,
            actorId: SELLER,
            horseName: "Trigger",
        });
        expect(mockAdmin._mockQuery.neq).toHaveBeenCalledWith("id", TXN);
    });

    it("does nothing when the deal has no horse", async () => {
        const result = await cancelSiblingOffers({
            horseId: null,
            keepTransactionId: TXN,
            actorId: SELLER,
            horseName: "Trigger",
        });
        expect(result.cancelled).toBe(0);
        expect(mockAdmin.from).not.toHaveBeenCalled();
    });
});
