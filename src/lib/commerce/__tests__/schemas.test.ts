import { describe, it, expect } from "vitest";
import {
    MAX_MONEY_AMOUNT,
    createTransactionSchema,
    firstZodError,
    isTwoDecimalMoney,
    leaveReviewSchema,
    makeOfferSchema,
    moneyAmountSchema,
    respondToOfferSchema,
    transactionIdSchema,
} from "@/lib/commerce/schemas";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("commerce schemas — moneyAmountSchema", () => {
    it("accepts typical amounts", () => {
        for (const v of [0.01, 1, 19.99, 150, 4500.5, 99999.99, MAX_MONEY_AMOUNT]) {
            expect(moneyAmountSchema.safeParse(v).success).toBe(true);
        }
    });

    it("rejects zero", () => {
        const r = moneyAmountSchema.safeParse(0);
        expect(r.success).toBe(false);
        if (!r.success) expect(firstZodError(r.error)).toMatch(/positive/i);
    });

    it("rejects negative amounts", () => {
        expect(moneyAmountSchema.safeParse(-1).success).toBe(false);
        expect(moneyAmountSchema.safeParse(-0.01).success).toBe(false);
    });

    it("rejects NaN and non-numbers (NaN-ish strings)", () => {
        expect(moneyAmountSchema.safeParse(NaN).success).toBe(false);
        expect(moneyAmountSchema.safeParse("100" as unknown as number).success).toBe(false);
        expect(moneyAmountSchema.safeParse("abc" as unknown as number).success).toBe(false);
        expect(moneyAmountSchema.safeParse(null as unknown as number).success).toBe(false);
        expect(moneyAmountSchema.safeParse(undefined as unknown as number).success).toBe(false);
    });

    it("rejects Infinity", () => {
        expect(moneyAmountSchema.safeParse(Infinity).success).toBe(false);
        expect(moneyAmountSchema.safeParse(-Infinity).success).toBe(false);
    });

    it("rejects amounts above the ceiling", () => {
        const r = moneyAmountSchema.safeParse(MAX_MONEY_AMOUNT + 0.01);
        expect(r.success).toBe(false);
        if (!r.success) expect(firstZodError(r.error)).toMatch(/cannot exceed/i);
        expect(moneyAmountSchema.safeParse(1e12).success).toBe(false);
        expect(moneyAmountSchema.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(false);
    });

    it("rejects sub-cent precision", () => {
        for (const v of [0.001, 19.999, 100.005, 1.0000001]) {
            const r = moneyAmountSchema.safeParse(v);
            expect(r.success).toBe(false);
            if (!r.success) expect(firstZodError(r.error)).toMatch(/decimal/i);
        }
    });

    it("tolerates binary-float cents (100.10, 0.07)", () => {
        expect(moneyAmountSchema.safeParse(100.1).success).toBe(true);
        expect(moneyAmountSchema.safeParse(0.07).success).toBe(true);
        expect(moneyAmountSchema.safeParse(1234.56).success).toBe(true);
    });
});

describe("commerce schemas — isTwoDecimalMoney", () => {
    it("accepts exact cents despite float representation", () => {
        expect(isTwoDecimalMoney(100.1)).toBe(true);
        expect(isTwoDecimalMoney(19.99)).toBe(true);
        expect(isTwoDecimalMoney(0.07)).toBe(true);
    });
    it("rejects sub-cent fractions", () => {
        expect(isTwoDecimalMoney(0.001)).toBe(false);
        expect(isTwoDecimalMoney(99.999)).toBe(false);
    });
});

describe("commerce schemas — makeOfferSchema", () => {
    const valid = { horseId: UUID_A, sellerId: UUID_B, amount: 150 };

    it("accepts a minimal valid offer", () => {
        expect(makeOfferSchema.safeParse(valid).success).toBe(true);
    });

    it("accepts message and isBundle", () => {
        const r = makeOfferSchema.safeParse({ ...valid, message: "  hi there  ", isBundle: true });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.message).toBe("hi there"); // trimmed
    });

    it("rejects non-uuid ids", () => {
        expect(makeOfferSchema.safeParse({ ...valid, horseId: "h1" }).success).toBe(false);
        expect(makeOfferSchema.safeParse({ ...valid, sellerId: "seller-1" }).success).toBe(false);
        expect(makeOfferSchema.safeParse({ ...valid, horseId: "'; DROP TABLE--" }).success).toBe(false);
    });

    it("rejects bad amounts (0, negative, NaN, huge, sub-cent)", () => {
        for (const amount of [0, -5, NaN, MAX_MONEY_AMOUNT + 1, 10.005]) {
            expect(makeOfferSchema.safeParse({ ...valid, amount }).success).toBe(false);
        }
    });

    it("rejects a message over 500 characters", () => {
        const r = makeOfferSchema.safeParse({ ...valid, message: "x".repeat(501) });
        expect(r.success).toBe(false);
        if (!r.success) expect(firstZodError(r.error)).toMatch(/too long/i);
    });

    it("accepts a message of exactly 500 characters", () => {
        expect(makeOfferSchema.safeParse({ ...valid, message: "x".repeat(500) }).success).toBe(true);
    });
});

describe("commerce schemas — respondToOfferSchema", () => {
    it("accepts accept and decline", () => {
        expect(respondToOfferSchema.safeParse({ transactionId: UUID_A, action: "accept" }).success).toBe(true);
        expect(respondToOfferSchema.safeParse({ transactionId: UUID_A, action: "decline" }).success).toBe(true);
    });
    it("rejects other verbs and bad ids", () => {
        expect(respondToOfferSchema.safeParse({ transactionId: UUID_A, action: "approve" }).success).toBe(false);
        expect(respondToOfferSchema.safeParse({ transactionId: "txn-1", action: "accept" }).success).toBe(false);
    });
});

describe("commerce schemas — transactionIdSchema", () => {
    it("accepts a uuid", () => {
        expect(transactionIdSchema.safeParse(UUID_A).success).toBe(true);
    });
    it("rejects non-uuids", () => {
        for (const v of ["txn-1", "", "123", null, undefined, 42]) {
            expect(transactionIdSchema.safeParse(v).success).toBe(false);
        }
    });
});

describe("commerce schemas — createTransactionSchema", () => {
    const valid = { type: "transfer" as const, partyAId: UUID_A, partyBId: UUID_B };

    it("accepts a minimal transaction", () => {
        expect(createTransactionSchema.safeParse(valid).success).toBe(true);
    });
    it("accepts all optional fields", () => {
        expect(createTransactionSchema.safeParse({
            ...valid,
            type: "parked_sale",
            horseId: UUID_A,
            conversationId: UUID_B,
            status: "completed",
            metadata: { pin: "ABC123", sale_price: 50 },
        }).success).toBe(true);
    });
    it("rejects unknown types and statuses", () => {
        expect(createTransactionSchema.safeParse({ ...valid, type: "gift" }).success).toBe(false);
        expect(createTransactionSchema.safeParse({ ...valid, status: "offer_made" }).success).toBe(false);
    });
    it("rejects non-uuid parties", () => {
        expect(createTransactionSchema.safeParse({ ...valid, partyAId: "seller-1" }).success).toBe(false);
        expect(createTransactionSchema.safeParse({ ...valid, partyBId: "" }).success).toBe(false);
    });
});

describe("commerce schemas — leaveReviewSchema", () => {
    const valid = { transactionId: UUID_A, targetId: UUID_B, stars: 5 };

    it("accepts stars 1 through 5", () => {
        for (const stars of [1, 2, 3, 4, 5]) {
            expect(leaveReviewSchema.safeParse({ ...valid, stars }).success).toBe(true);
        }
    });

    it("rejects out-of-range, fractional, and NaN stars with the original message", () => {
        for (const stars of [0, 6, -1, 3.5, NaN, "5" as unknown as number]) {
            const r = leaveReviewSchema.safeParse({ ...valid, stars });
            expect(r.success).toBe(false);
            if (!r.success) expect(firstZodError(r.error)).toBe("Stars must be 1-5.");
        }
    });

    it("trims content and rejects over 1000 chars", () => {
        const ok = leaveReviewSchema.safeParse({ ...valid, content: "  great trade  " });
        expect(ok.success).toBe(true);
        if (ok.success) expect(ok.data.content).toBe("great trade");
        expect(leaveReviewSchema.safeParse({ ...valid, content: "x".repeat(1001) }).success).toBe(false);
    });

    it("rejects non-uuid ids", () => {
        expect(leaveReviewSchema.safeParse({ ...valid, transactionId: "t1" }).success).toBe(false);
        expect(leaveReviewSchema.safeParse({ ...valid, targetId: "u1" }).success).toBe(false);
    });
});

describe("commerce schemas — firstZodError", () => {
    it("returns the first issue's message", () => {
        const r = makeOfferSchema.safeParse({ horseId: "bad", sellerId: "bad", amount: -1 });
        expect(r.success).toBe(false);
        if (!r.success) expect(typeof firstZodError(r.error)).toBe("string");
    });
});
