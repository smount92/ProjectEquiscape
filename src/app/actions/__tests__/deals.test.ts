import { vi, describe, it, expect, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";
import { ALL_SUPPORTED, resetDealColumnSupport } from "@/lib/deals/columnSupport";
import type { DealTerms, TermBox } from "@/lib/deals/terms";

// Fresh mock clients — each test resets these
let mockClient: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn(() => mockClient) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/utils/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
}));
// One horse, one sale (audit C3) — unit-tested in
// src/lib/commerce/__tests__/horseLock.test.ts. Here we assert only that
// the counter-accept path consults it and closes the losing offers,
// which it never did before.
const mockAssertHorseAvailable = vi.fn().mockResolvedValue({ ok: true });
const mockCancelSiblingOffers = vi.fn().mockResolvedValue({ cancelled: 0 });
vi.mock("@/lib/commerce/horseLock", () => ({
    assertHorseAvailable: (...args: unknown[]) => mockAssertHorseAvailable(...args),
    cancelSiblingOffers: (...args: unknown[]) => mockCancelSiblingOffers(...args),
}));
// The probe is the seam between "173 pasted" and "not yet". Every test
// below runs against a pasted database except the ones that say
// otherwise, which flip this.
let support = { ...ALL_SUPPORTED };
vi.mock("@/lib/deals/columnSupport", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/deals/columnSupport")>();
    return {
        ...actual,
        getDealColumnSupport: vi.fn(() => Promise.resolve(support)),
    };
});

import {
    agreeToTerms,
    confirmInstallmentReceived,
    markInstallmentSent,
    proposeTerms,
    raiseDispute,
    recordSaleInVault,
    respondToCounter,
    savePaymentPlan,
    standDownDispute,
    withdrawTermsAgreement,
} from "@/app/actions/deals";

// Real v4 UUIDs — the transaction paths validate ids before anything runs.
const SELLER = "11111111-1111-4111-8111-111111111111";
const BUYER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";
const CONVO = "44444444-4444-4444-8444-444444444444";
const TXN = "55555555-5555-4555-8555-555555555555";
const HORSE = "66666666-6666-4666-8666-666666666666";
const INSTALLMENT = "77777777-7777-4777-8777-777777777777";

const authAs = (id: string) =>
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id, email: "x@example.com" } },
    });

const terms = (patch: Partial<DealTerms> = {}): DealTerms => ({
    boxes: [],
    agreedByAAt: null,
    agreedByBAt: null,
    revision: 0,
    updatedAt: null,
    updatedBy: null,
    ...patch,
});

const priceBox = (amount: number): TermBox => ({
    id: "p1",
    type: "price",
    amount,
    currency: "USD",
    method: null,
});

const convoRow = (patch: Record<string, unknown> = {}) => ({
    id: CONVO,
    buyer_id: BUYER,
    seller_id: SELLER,
    horse_id: HORSE,
    deal_terms: terms(),
    deal_kind: "sale",
    commission_id: null,
    disputed_at: null,
    ...patch,
});

const txnRow = (patch: Record<string, unknown> = {}) => ({
    id: TXN,
    status: "pending_payment",
    party_a_id: SELLER,
    party_b_id: BUYER,
    offer_amount: 400,
    paid_at: null,
    metadata: null,
    ...patch,
});

const installmentRow = (patch: Record<string, unknown> = {}) => ({
    id: INSTALLMENT,
    conversation_id: CONVO,
    seq: 1,
    amount: 100,
    due_date: "2026-09-01",
    marked_sent_at: null,
    confirmed_at: null,
    note: null,
    ...patch,
});

/**
 * loadDeal reads the conversation, then the transaction, then (in most
 * paths) the caller's alias. Queue them in that order.
 */
const queueLoad = (convo: unknown, txn: unknown = txnRow()) => {
    mockClient._mockQuery.maybeSingle
        .mockResolvedValueOnce({ data: convo, error: null }) // conversation
        .mockResolvedValueOnce({ data: txn, error: null }) // transaction
        .mockResolvedValue({ data: { alias_name: "someone" }, error: null }); // alias etc.
};

describe("Deal room — deals.ts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetDealColumnSupport();
        support = { ...ALL_SUPPORTED };
        mockClient = createMockSupabaseClient();
        mockClient._setImplicitResolve({ data: [], error: null });
        mockAssertHorseAvailable.mockReset();
        mockAssertHorseAvailable.mockResolvedValue({ ok: true });
        mockCancelSiblingOffers.mockReset();
        mockCancelSiblingOffers.mockResolvedValue({ cancelled: 0 });
        authAs(BUYER);
    });

    // ── Auth ──

    it("requires authentication for every mutation", async () => {
        mockClient.auth.getUser.mockResolvedValue({ data: { user: null } });
        await expect(proposeTerms(CONVO, [])).rejects.toThrow(AuthError);
        await expect(agreeToTerms(CONVO)).rejects.toThrow(AuthError);
        await expect(savePaymentPlan(CONVO, [{ amount: 1, dueDate: null }])).rejects.toThrow(
            AuthError,
        );
        await expect(raiseDispute(CONVO, "a real reason here")).rejects.toThrow(AuthError);
    });

    it("refuses a caller who is not part of the conversation", async () => {
        authAs(STRANGER);
        queueLoad(convoRow());
        const result = await proposeTerms(CONVO, [priceBox(400)]);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not part of this conversation/i);
    });

    // ── The migration seam ──

    it("hides every deal surface until migration 173 is pasted, rather than 500ing", async () => {
        support = {
            messageKinds: false,
            participants: false,
            conversationDeal: false,
            installments: false,
        };
        for (const call of [
            () => proposeTerms(CONVO, [priceBox(400)]),
            () => agreeToTerms(CONVO),
            () => savePaymentPlan(CONVO, [{ amount: 100, dueDate: null }]),
            () => markInstallmentSent(INSTALLMENT),
            () => raiseDispute(CONVO, "a real reason here"),
        ]) {
            const result = await call();
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/database update that hasn't been applied/i);
        }
    });

    // ── The contract boxes ──

    it("writes the boxes, clears both agreements, and bumps the revision", async () => {
        queueLoad(
            convoRow({
                deal_terms: terms({
                    boxes: [priceBox(400)],
                    agreedByAAt: "2026-08-01T00:00:00.000Z",
                    revision: 1,
                }),
            }),
        );
        const result = await proposeTerms(CONVO, [priceBox(350)]);
        expect(result.success).toBe(true);
        expect(result.terms?.revision).toBe(2);
        expect(result.terms?.agreedByAAt).toBeNull();
        expect(result.terms?.agreedByBAt).toBeNull();
    });

    it("refuses to rewrite terms both sides have agreed to", async () => {
        queueLoad(
            convoRow({
                deal_terms: terms({
                    boxes: [priceBox(400)],
                    agreedByAAt: "2026-08-01T00:00:00.000Z",
                    agreedByBAt: "2026-08-02T00:00:00.000Z",
                }),
            }),
        );
        const result = await proposeTerms(CONVO, [priceBox(1)]);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/agreed by both sides/i);
    });

    it("records one side's agreement without completing the pair", async () => {
        queueLoad(convoRow({ deal_terms: terms({ boxes: [priceBox(400)] }) }));
        const result = await agreeToTerms(CONVO);
        expect(result.success).toBe(true);
        expect(result.fullyAgreed).toBe(false);
    });

    it("completes the pair when the second side agrees", async () => {
        queueLoad(
            convoRow({
                deal_terms: terms({
                    boxes: [priceBox(400)],
                    agreedByAAt: "2026-08-01T00:00:00.000Z",
                }),
            }),
        );
        // Caller is the buyer, i.e. party B, so this is the last signature.
        const result = await agreeToTerms(CONVO);
        expect(result.success).toBe(true);
        expect(result.fullyAgreed).toBe(true);
    });

    it("refuses to agree twice", async () => {
        queueLoad(
            convoRow({
                deal_terms: terms({
                    boxes: [priceBox(400)],
                    agreedByAAt: "2026-08-01T00:00:00.000Z",
                    agreedByBAt: "2026-08-02T00:00:00.000Z",
                }),
            }),
        );
        const result = await agreeToTerms(CONVO);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already agreed/i);
    });

    // ── The payment ledger ──

    it("refuses a plan whose payments contradict the agreed price", async () => {
        queueLoad(convoRow({ deal_terms: terms({ boxes: [priceBox(400)] }) }));
        const result = await savePaymentPlan(CONVO, [
            { amount: 100, dueDate: "2026-09-01" },
            { amount: 100, dueDate: "2026-10-01" },
        ]);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/\$200.*agreed price is \$400/i);
    });

    it("refuses an empty plan and a comically long one", async () => {
        queueLoad(convoRow());
        expect((await savePaymentPlan(CONVO, [])).error).toMatch(/at least one payment/i);

        queueLoad(convoRow());
        const huge = Array.from({ length: 200 }, () => ({ amount: 1, dueDate: null }));
        expect((await savePaymentPlan(CONVO, huge)).error).toMatch(/at most 120/i);
    });

    it("refuses to rewrite a plan once money has moved against it", async () => {
        queueLoad(convoRow({ deal_terms: terms({ boxes: [priceBox(200)] }) }));
        mockClient._setImplicitResolve({
            data: [installmentRow({ seq: 2, marked_sent_at: "2026-09-01T00:00:00Z" })],
            error: null,
        });
        const result = await savePaymentPlan(CONVO, [
            { amount: 100, dueDate: "2026-09-01" },
            { amount: 100, dueDate: "2026-10-01" },
        ]);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Payment 2 has already been marked/i);
    });

    it("lets the buyer mark a payment sent", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: installmentRow(), error: null }) // the row
            .mockResolvedValueOnce({ data: convoRow(), error: null }) // conversation
            .mockResolvedValueOnce({ data: txnRow(), error: null }) // transaction
            .mockResolvedValue({ data: { alias_name: "sam" }, error: null });
        const result = await markInstallmentSent(INSTALLMENT);
        expect(result.success).toBe(true);
    });

    it("will not let the seller mark the buyer's payment sent", async () => {
        authAs(SELLER);
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: installmentRow(), error: null })
            .mockResolvedValueOnce({ data: convoRow(), error: null })
            .mockResolvedValueOnce({ data: txnRow(), error: null })
            .mockResolvedValue({ data: { alias_name: "amanda" }, error: null });
        const result = await markInstallmentSent(INSTALLMENT);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/only the paying side/i);
    });

    it("will not let the buyer confirm their own payment arrived", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: installmentRow({ marked_sent_at: "2026-09-01T00:00:00Z" }),
                error: null,
            })
            .mockResolvedValueOnce({ data: convoRow(), error: null })
            .mockResolvedValueOnce({ data: txnRow(), error: null })
            .mockResolvedValue({ data: { alias_name: "sam" }, error: null });
        const result = await confirmInstallmentReceived(INSTALLMENT);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/only the receiving side/i);
    });

    it("refuses to touch an already-confirmed payment — a receipt is final", async () => {
        authAs(SELLER);
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: installmentRow({ confirmed_at: "2026-09-02T00:00:00Z" }),
                error: null,
            })
            .mockResolvedValueOnce({ data: convoRow(), error: null })
            .mockResolvedValueOnce({ data: txnRow(), error: null })
            .mockResolvedValue({ data: { alias_name: "amanda" }, error: null });
        const result = await confirmInstallmentReceived(INSTALLMENT);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already confirmed/i);
    });

    // ── audit C2: a fully-paid plan has to reach the release path ──

    it("stamps the transaction paid when the last installment is confirmed", async () => {
        authAs(SELLER);
        // The ledger read that follows the confirmation: one row, confirmed.
        mockClient._setImplicitResolve({
            data: [
                {
                    id: INSTALLMENT,
                    seq: 1,
                    amount: 100,
                    due_date: "2026-09-01",
                    marked_sent_at: "2026-09-01T00:00:00Z",
                    confirmed_at: "2026-09-02T00:00:00Z",
                    note: null,
                },
            ],
            error: null,
        });
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: installmentRow({ marked_sent_at: "2026-09-01T00:00:00Z" }),
                error: null,
            })
            .mockResolvedValueOnce({ data: convoRow(), error: null })
            .mockResolvedValueOnce({ data: txnRow(), error: null })
            .mockResolvedValue({ data: { alias_name: "amanda" }, error: null });

        const result = await confirmInstallmentReceived(INSTALLMENT);

        expect(result.success).toBe(true);
        expect(result.allConfirmed).toBe(true);
        // Without this the seller's "Confirm payment & release" answered
        // "Buyer has not yet marked payment as sent" — for ever.
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith(
            expect.objectContaining({ paid_at: expect.any(String) }),
        );
    });

    it("does not stamp the transaction paid while payments are outstanding", async () => {
        authAs(SELLER);
        mockClient._setImplicitResolve({
            data: [
                {
                    id: INSTALLMENT,
                    seq: 1,
                    amount: 100,
                    due_date: "2026-09-01",
                    marked_sent_at: "2026-09-01T00:00:00Z",
                    confirmed_at: "2026-09-02T00:00:00Z",
                    note: null,
                },
                {
                    id: "second",
                    seq: 2,
                    amount: 100,
                    due_date: "2026-10-01",
                    marked_sent_at: null,
                    confirmed_at: null,
                    note: null,
                },
            ],
            error: null,
        });
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: installmentRow({ marked_sent_at: "2026-09-01T00:00:00Z" }),
                error: null,
            })
            .mockResolvedValueOnce({ data: convoRow(), error: null })
            .mockResolvedValueOnce({ data: txnRow(), error: null })
            .mockResolvedValue({ data: { alias_name: "amanda" }, error: null });

        const result = await confirmInstallmentReceived(INSTALLMENT);

        expect(result.success).toBe(true);
        expect(result.allConfirmed).toBe(false);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalledWith(
            expect.objectContaining({ paid_at: expect.any(String) }),
        );
    });

    // ── audit C3: accepting a counter is still a sale ──

    const counterTxn = (patch: Record<string, unknown> = {}) => ({
        id: TXN,
        status: "offer_made",
        party_a_id: SELLER,
        party_b_id: BUYER,
        conversation_id: CONVO,
        horse_id: HORSE,
        offer_amount: 320,
        ...patch,
    });

    it("refuses to accept a counter on a horse that is already selling", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: counterTxn(),
            error: null,
        });
        mockAssertHorseAvailable.mockResolvedValueOnce({
            ok: false,
            reason: "This horse is already marked Pending Sale.",
        });

        const result = await respondToCounter(TXN, "accept");

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/pending sale/i);
        expect(mockClient.rpc).not.toHaveBeenCalled();
    });

    it("closes the losing offers when a counter is accepted", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: counterTxn(), error: null })
            .mockResolvedValue({ data: { alias_name: "sam", custom_name: "Trigger" }, error: null });
        mockClient.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

        const result = await respondToCounter(TXN, "accept");

        expect(result.success).toBe(true);
        expect(mockCancelSiblingOffers).toHaveBeenCalledWith(
            expect.objectContaining({ horseId: HORSE, keepTransactionId: TXN, actorId: BUYER }),
        );
    });

    it("leaves the horse alone when a counter is declined", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: counterTxn(), error: null })
            .mockResolvedValue({ data: { alias_name: "sam" }, error: null });
        mockClient.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

        await respondToCounter(TXN, "decline");

        expect(mockAssertHorseAvailable).not.toHaveBeenCalled();
        expect(mockCancelSiblingOffers).not.toHaveBeenCalled();
    });

    // ── audit C8: transitions that used to happen in silence ──

    it("writes a transcript entry when an agreement is withdrawn", async () => {
        queueLoad(
            convoRow({
                deal_terms: terms({ boxes: [priceBox(400)], agreedByBAt: "2026-09-01T00:00:00Z" }),
            }),
        );

        const result = await withdrawTermsAgreement(CONVO);

        expect(result.success).toBe(true);
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "terms_agreed",
                payload: expect.objectContaining({ withdrawn: true }),
            }),
        );
    });

    // ── Disputes freeze everything ──

    it("wants a real sentence before it will freeze a record", async () => {
        queueLoad(convoRow());
        const result = await raiseDispute(CONVO, "bad");
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/sentence or two/i);
    });

    it("freezes the terms and the ledger once a deal is disputed", async () => {
        const disputed = convoRow({ disputed_at: "2026-09-10T00:00:00Z" });

        queueLoad(disputed);
        expect((await proposeTerms(CONVO, [priceBox(1)])).error).toMatch(/disputed/i);

        queueLoad(disputed);
        expect((await agreeToTerms(CONVO)).error).toMatch(/disputed/i);

        queueLoad(disputed);
        expect(
            (await savePaymentPlan(CONVO, [{ amount: 1, dueDate: null }])).error,
        ).toMatch(/disputed/i);
    });

    it("refuses to dispute the same deal twice", async () => {
        queueLoad(convoRow({ disputed_at: "2026-09-10T00:00:00Z" }));
        const result = await raiseDispute(CONVO, "He never shipped the horse.");
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already marked as disputed/i);
    });

    it("lets only the person who raised a dispute stand it down", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: {
                buyer_id: BUYER,
                seller_id: SELLER,
                disputed_at: "2026-09-10T00:00:00Z",
                disputed_by: SELLER,
            },
            error: null,
        });
        const result = await standDownDispute(CONVO);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/only the person who raised/i);
    });

    // ── The vault hand-off ──

    it("offers the vault hand-off to the buyer alone", async () => {
        authAs(SELLER);
        queueLoad(convoRow(), txnRow({ status: "completed" }));
        const result = await recordSaleInVault(CONVO);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/only the buyer/i);
    });

    it("waits until the sale is complete", async () => {
        queueLoad(convoRow(), txnRow({ status: "pending_payment" }));
        const result = await recordSaleInVault(CONVO);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/until the sale is complete/i);
    });

    it("refuses to file the same purchase twice", async () => {
        queueLoad(
            convoRow(),
            txnRow({ status: "completed", metadata: { vault_recorded_at: "2026-09-01T00:00:00Z" } }),
        );
        const result = await recordSaleInVault(CONVO);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already in the horse's vault/i);
    });

    it("never overwrites a purchase price the owner typed themselves", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: convoRow({ deal_terms: terms({ boxes: [priceBox(400)] }) }),
                error: null,
            })
            .mockResolvedValueOnce({ data: txnRow({ status: "completed" }), error: null })
            .mockResolvedValueOnce({ data: { id: HORSE }, error: null }) // ownership check
            .mockResolvedValueOnce({ data: { purchase_price: 275 }, error: null }); // vault row
        const result = await recordSaleInVault(CONVO);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already records a purchase price of \$275/i);
    });

    it("refuses when the buyer no longer owns the horse — the vault is the owner's record", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: convoRow({ deal_terms: terms({ boxes: [priceBox(400)] }) }),
                error: null,
            })
            .mockResolvedValueOnce({ data: txnRow({ status: "completed" }), error: null })
            .mockResolvedValueOnce({ data: null, error: null }); // ownership check fails
        const result = await recordSaleInVault(CONVO);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/claim the horse into your stable/i);
    });

    it("files the agreed price, preferring the terms over the original offer", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: convoRow({ deal_terms: terms({ boxes: [priceBox(350)] }) }),
                error: null,
            })
            // The offer was 400; the parties agreed 350 in the terms.
            .mockResolvedValueOnce({
                data: txnRow({ status: "completed", offer_amount: 400 }),
                error: null,
            })
            .mockResolvedValueOnce({ data: { id: HORSE }, error: null })
            .mockResolvedValueOnce({ data: null, error: null }); // no vault row yet
        const result = await recordSaleInVault(CONVO);
        expect(result.success).toBe(true);
        expect(result.amount).toBe(350);
    });
});
