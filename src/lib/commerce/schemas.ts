/**
 * Commerce domain — zod input schemas for the transactions server
 * actions. Kept OUT of the "use server" file (which may only export
 * async functions) so they are importable and directly unit-testable.
 * Mirrors src/lib/shows/schemas.ts and src/lib/stable/schemas.ts.
 *
 * Refusal messages that predate this module ("Offer amount must be
 * positive.", "Stars must be 1-5.") are preserved verbatim — the UI
 * surfaces them and the action tests match on them.
 */

import { z } from "zod";

export const uuidSchema = z.uuid();

// ── Money ──

/**
 * Ceiling for a single offer, in dollars. The offer_amount column is
 * DECIMAL(10,2) (migration 060), i.e. a hard cap of 99,999,999.99;
 * $1,000,000 is chosen as the sane marketplace bound — real model-horse
 * sales top out in the low five figures, so this rejects fat-fingered
 * and adversarial amounts long before the column overflows.
 */
export const MAX_MONEY_AMOUNT = 1_000_000;

/**
 * True when `value` is representable with at most 2 decimal places.
 * Uses an epsilon because binary floats can't represent most cents
 * exactly (e.g. 100.10 * 100 === 10010.000000000002).
 */
export function isTwoDecimalMoney(value: number): boolean {
    return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/**
 * A user-entered money amount: finite, strictly positive, capped,
 * 2-decimal precision (matches the DECIMAL(10,2) column).
 */
export const moneyAmountSchema = z
    .number("Offer amount must be a number.")
    .finite("Offer amount must be a number.")
    .positive("Offer amount must be positive.")
    .max(MAX_MONEY_AMOUNT, `Offer amount cannot exceed $${MAX_MONEY_AMOUNT.toLocaleString("en-US")}.`)
    .refine(isTwoDecimalMoney, "Offer amount can have at most 2 decimal places.");

// ── makeOffer ──

export const makeOfferSchema = z.object({
    horseId: uuidSchema,
    sellerId: uuidSchema,
    amount: moneyAmountSchema,
    // MakeOfferModal caps the textarea at 500 chars — enforce server-side.
    message: z.string().trim().max(500, "Message is too long (max 500 characters).").optional(),
    isBundle: z.boolean().optional(),
});

// ── respondToOffer ──

export const respondToOfferSchema = z.object({
    transactionId: uuidSchema,
    action: z.enum(["accept", "decline"]),
});

// ── Single-id actions (markPaymentSent, verifyFundsAndRelease,
//    cancelTransaction, retractOffer, completeTransaction) ──

export const transactionIdSchema = uuidSchema;

// ── createTransaction (internal helper, still an exported action) ──

export const createTransactionSchema = z.object({
    type: z.enum(["transfer", "parked_sale", "commission", "marketplace_sale"]),
    partyAId: uuidSchema,
    partyBId: uuidSchema,
    horseId: uuidSchema.optional(),
    commissionId: uuidSchema.optional(),
    conversationId: uuidSchema.optional(),
    status: z.enum(["pending", "completed"]).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Reviews ──

export const leaveReviewSchema = z.object({
    transactionId: uuidSchema,
    targetId: uuidSchema,
    stars: z
        .number("Stars must be 1-5.")
        .int("Stars must be 1-5.")
        .min(1, "Stars must be 1-5.")
        .max(5, "Stars must be 1-5."),
    // RatingForm caps the textarea at 300 chars; 1000 is the server
    // ceiling so the API tolerates other clients without allowing
    // unbounded text into the reviews table.
    content: z.string().trim().max(1000, "Review is too long (max 1000 characters).").optional(),
});

export const reviewIdSchema = uuidSchema;
export const userIdSchema = uuidSchema;
export const conversationIdSchema = uuidSchema;

/** First human-readable issue from a zod error (house convention). */
export function firstZodError(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Invalid input.";
}
