import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Time-boxed memberships: grant, revoke, refund ──
//
// The property this whole file exists to hold, stated once:
//
//   A REVOKE MAY NEVER DROP A MEMBER WHOSE TERM IS STILL PAID FOR.
//
// PayPal fires BILLING.SUBSCRIPTION.EXPIRED the moment a fixed-term
// agreement completes, which can be the same second as its final
// successful charge. Honouring that literally takes back a month
// somebody paid for thirty seconds earlier. Guard 0 in revokePaypalTier
// is the answer, and "revoke refuses while paid_through is in the
// future" is the assertion that proves it.
//
// The other half is arithmetic that involves money: a capture must buy
// its months exactly once, and a second term must ADD to the first.

const mockRpc = vi.fn();
const mockGetUserById = vi.fn();
const mockUpdateUserById = vi.fn();

const admin = {
    rpc: mockRpc,
    from: vi.fn(),
    auth: { admin: { getUserById: mockGetUserById, updateUserById: mockUpdateUserById } },
};

const mockCreateNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: mockCreateNotification,
}));

import {
    grantPaypalTier,
    revokePaypalTier,
    grantPrepaidTerm,
    endPrepaidTerm,
} from "@/lib/paypal/entitlement";

type AdminArg = Parameters<typeof grantPaypalTier>[0];

/** Injected into grantPrepaidTerm, so its arithmetic is pinned. */
const NOW = Date.parse("2026-01-15T12:00:00.000Z");

// Guard 0 reads the real clock — it is a live safety check, not a
// calculation — so these have to be genuinely in the future and the
// past, not merely on the far side of NOW.
const DAY = 24 * 60 * 60 * 1000;
const FUTURE = new Date(Date.now() + 180 * DAY).toISOString();
const PAST = new Date(Date.now() - 180 * DAY).toISOString();

function userWith(app_metadata: Record<string, unknown>) {
    mockGetUserById.mockResolvedValue({
        data: { user: { id: "user-1", app_metadata } },
        error: null,
    });
}

/** The app_metadata a write landed on. */
function written(): Record<string, unknown> {
    const call = mockUpdateUserById.mock.calls[0];
    return (call[1] as { app_metadata: Record<string, unknown> }).app_metadata;
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default: migration 185 is NOT pasted. That is the state this
    // merges in, so it is the state most of these run under.
    mockRpc.mockResolvedValue({ data: null, error: { code: "42883", message: "does not exist" } });
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
    mockCreateNotification.mockResolvedValue(undefined);
});

// ══════════════════════════════════════════════════════════════
describe("revokePaypalTier — GUARD 0, the safety property", () => {
    // ── THE trap: EXPIRED arriving beside the final charge ──
    it("REFUSES to drop a member whose paid_through is still in the future", async () => {
        userWith({
            tier: "pro",
            paid_through: FUTURE,
            paypal_subscription_id: "I-SUB-1",
            paypal_tier: "pro",
        });

        const outcome = await revokePaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            subscriptionId: "I-SUB-1",
            paypalStatus: "EXPIRED",
        });

        expect(outcome).toEqual({ action: "ignored", reason: "paid-through-in-future" });
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it.each(["EXPIRED", "CANCELLED", "SUSPENDED"])(
        "%s cannot end a term that is still paid for",
        async (status) => {
            userWith({
                tier: "studio",
                paid_through: FUTURE,
                paypal_subscription_id: "I-SUB-1",
                paypal_tier: "studio",
            });

            const outcome = await revokePaypalTier(admin as unknown as AdminArg, {
                userId: "user-1",
                subscriptionId: "I-SUB-1",
                paypalStatus: status,
            });

            expect(outcome.action).toBe("ignored");
            expect(mockUpdateUserById).not.toHaveBeenCalled();
        },
    );

    it("guard 0 outranks the others — it fires even for the granting subscription", async () => {
        // Everything else about this revoke is legitimate. It is refused
        // purely because the member has paid past today.
        userWith({
            tier: "pro",
            paid_through: FUTURE,
            paypal_subscription_id: "I-SUB-1",
            paypal_tier: "pro",
        });
        const outcome = await revokePaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            subscriptionId: "I-SUB-1",
            paypalStatus: "CANCELLED",
        });
        expect(outcome.reason).toBe("paid-through-in-future");
    });

    it("DOES revoke once the term has actually run out", async () => {
        userWith({
            tier: "pro",
            paid_through: PAST,
            paypal_subscription_id: "I-SUB-1",
            paypal_tier: "pro",
        });

        const outcome = await revokePaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            subscriptionId: "I-SUB-1",
            paypalStatus: "EXPIRED",
        });

        expect(outcome.action).toBe("revoked");
        expect(written().tier).toBe("free");
        // The spent clock is cleared alongside the tier.
        expect(written()).not.toHaveProperty("paid_through");
    });

    // ── Recurring subscribers must not notice any of this ──
    it("an open-ended subscriber with no clock is revoked exactly as before", async () => {
        userWith({ tier: "pro", paypal_subscription_id: "I-SUB-1", paypal_tier: "pro" });

        const outcome = await revokePaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            subscriptionId: "I-SUB-1",
            paypalStatus: "CANCELLED",
        });

        expect(outcome.action).toBe("revoked");
        expect(written()).toEqual({ tier: "free" });
    });

    it("an unreadable paid_through does not block a legitimate revoke", async () => {
        userWith({
            tier: "pro",
            paid_through: "sometime",
            paypal_subscription_id: "I-SUB-1",
            paypal_tier: "pro",
        });
        const outcome = await revokePaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            subscriptionId: "I-SUB-1",
            paypalStatus: "CANCELLED",
        });
        expect(outcome.action).toBe("revoked");
    });
});

// ══════════════════════════════════════════════════════════════
describe("grantPaypalTier — the clock on subscriptions", () => {
    it("an open-ended grant writes NO clock at all", async () => {
        userWith({});
        await grantPaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            subscriptionId: "I-SUB-1",
        });
        expect(written()).toEqual({
            tier: "pro",
            paypal_subscription_id: "I-SUB-1",
            paypal_tier: "pro",
        });
    });

    // If an open-ended subscription ever inherited a clock, the member
    // would expire on that date no matter how faithfully they paid.
    it("an open-ended grant REMOVES a clock the member used to have", async () => {
        userWith({ tier: "pro", paid_through: FUTURE });
        await grantPaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            subscriptionId: "I-SUB-1",
        });
        expect(written()).not.toHaveProperty("paid_through");
    });

    it("a fixed-term grant writes the clock it was given", async () => {
        userWith({});
        await grantPaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            subscriptionId: "I-SUB-1",
            paidThrough: FUTURE,
        });
        expect(written().paid_through).toBe(FUTURE);
    });

    it("still preserves unrelated app_metadata — a purchase never unsuspends anyone", async () => {
        userWith({ is_suspended: true, paid_through: PAST });
        await grantPaypalTier(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            subscriptionId: "I-SUB-1",
            paidThrough: FUTURE,
        });
        expect(written().is_suspended).toBe(true);
        expect(written().paid_through).toBe(FUTURE);
    });
});

// ══════════════════════════════════════════════════════════════
describe("grantPrepaidTerm — idempotency", () => {
    it("grants the tier and a clock N months out", async () => {
        userWith({});
        const outcome = await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 6,
            captureId: "CAP-1",
            orderId: "ORDER-1",
            now: NOW,
        });

        expect(outcome).toMatchObject({ action: "granted", tier: "pro" });
        expect(written().tier).toBe("pro");
        expect(written().paid_through).toBe("2026-07-15T12:00:00.000Z");
        expect(written().paypal_prepaid_captures).toEqual(["CAP-1"]);
        expect(written().paypal_prepaid_order_id).toBe("ORDER-1");
    });

    // ── Replaying a capture must not buy the months twice ──
    it("REPLAYING the same capture changes nothing", async () => {
        userWith({
            tier: "pro",
            paid_through: "2026-07-15T12:00:00.000Z",
            paypal_prepaid_captures: ["CAP-1"],
            paypal_prepaid_tier: "pro",
        });

        const outcome = await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 6,
            captureId: "CAP-1",
            now: NOW,
        });

        expect(outcome).toEqual({ action: "ignored", reason: "capture-already-applied" });
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("a replay is caught before the ledger is even consulted", async () => {
        userWith({ tier: "pro", paypal_prepaid_captures: ["CAP-1"] });
        await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 3,
            captureId: "CAP-1",
            now: NOW,
        });
        expect(mockRpc).not.toHaveBeenCalledWith("claim_paypal_capture", expect.anything());
    });

    it("stands down when the 185 ledger says another delivery owns the capture", async () => {
        userWith({});
        mockRpc.mockImplementation(async (name: string) => {
            if (name === "claim_paypal_capture") return { data: false, error: null };
            return { data: null, error: null };
        });

        const outcome = await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 3,
            captureId: "CAP-2",
            now: NOW,
        });

        expect(outcome).toEqual({ action: "ignored", reason: "capture-claimed-elsewhere" });
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    // A broken ledger must never swallow a term somebody paid for.
    it("grants anyway when the ledger itself errors", async () => {
        userWith({});
        mockRpc.mockImplementation(async (name: string) => {
            if (name === "claim_paypal_capture") {
                return { data: null, error: { code: "57014", message: "statement timeout" } };
            }
            return { data: null, error: null };
        });

        const outcome = await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 3,
            captureId: "CAP-3",
            now: NOW,
        });

        expect(outcome.action).toBe("granted");
    });

    it("returns failed — so PayPal retries — when the write fails", async () => {
        userWith({});
        mockUpdateUserById.mockResolvedValue({ data: null, error: { message: "auth unavailable" } });
        const outcome = await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 3,
            captureId: "CAP-4",
            now: NOW,
        });
        expect(outcome).toEqual({ action: "failed", error: "term-write-failed" });
    });

    it("caps the remembered capture list rather than growing forever", async () => {
        const many = Array.from({ length: 25 }, (_, i) => `OLD-${i}`);
        userWith({ paypal_prepaid_captures: many });
        await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 3,
            captureId: "CAP-NEW",
            now: NOW,
        });
        const captures = written().paypal_prepaid_captures as string[];
        expect(captures).toHaveLength(25);
        expect(captures.at(-1)).toBe("CAP-NEW");
        expect(captures).not.toContain("OLD-0");
    });

    it("preserves unrelated app_metadata", async () => {
        userWith({ is_suspended: true, stripe_customer_id: "cus_1" });
        await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 3,
            captureId: "CAP-5",
            now: NOW,
        });
        expect(written().is_suspended).toBe(true);
        expect(written().stripe_customer_id).toBe("cus_1");
    });

    it("does not retry forever for a member who no longer exists", async () => {
        mockGetUserById.mockResolvedValue({ data: { user: null }, error: null });
        const outcome = await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "gone",
            tier: "pro",
            months: 3,
            captureId: "CAP-6",
            now: NOW,
        });
        expect(outcome).toEqual({ action: "ignored", reason: "user-not-found" });
    });

    it("a notification failure never breaks the grant", async () => {
        userWith({});
        mockCreateNotification.mockRejectedValue(new Error("notification sink down"));
        const outcome = await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 3,
            captureId: "CAP-7",
            now: NOW,
        });
        expect(outcome.action).toBe("granted");
    });
});

// ══════════════════════════════════════════════════════════════
describe("grantPrepaidTerm — STACKING", () => {
    it("a second term extends from the existing end date, not from now", async () => {
        // Two months left, buying six more.
        userWith({
            tier: "pro",
            paid_through: "2026-03-15T12:00:00.000Z",
            paypal_prepaid_captures: ["CAP-1"],
            paypal_prepaid_tier: "pro",
        });

        await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 6,
            captureId: "CAP-2",
            now: NOW,
        });

        // March + 6 = September. Not July, which is what measuring from
        // "now" would have given — the member would have lost two months
        // they had already paid for.
        expect(written().paid_through).toBe("2026-09-15T12:00:00.000Z");
        expect(written().paypal_prepaid_captures).toEqual(["CAP-1", "CAP-2"]);
    });

    it("a LAPSED member starts afresh from now", async () => {
        userWith({
            tier: "free",
            // Lapsed relative to the INJECTED clock, which is what the
            // stacking arithmetic is measured against.
            paid_through: "2025-11-01T00:00:00.000Z",
            paypal_prepaid_captures: ["CAP-1"],
        });

        await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            tier: "pro",
            months: 3,
            captureId: "CAP-2",
            now: NOW,
        });

        expect(written().paid_through).toBe("2026-04-15T12:00:00.000Z");
    });

    it("three stacked terms accumulate", async () => {
        userWith({});
        await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1", tier: "pro", months: 3, captureId: "C1", now: NOW,
        });
        const afterFirst = written().paid_through as string;

        mockUpdateUserById.mockClear();
        userWith({ tier: "pro", paid_through: afterFirst, paypal_prepaid_captures: ["C1"] });
        await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1", tier: "pro", months: 3, captureId: "C2", now: NOW,
        });
        const afterSecond = written().paid_through as string;

        mockUpdateUserById.mockClear();
        userWith({ tier: "pro", paid_through: afterSecond, paypal_prepaid_captures: ["C1", "C2"] });
        await grantPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1", tier: "pro", months: 3, captureId: "C3", now: NOW,
        });

        expect(written().paid_through).toBe("2026-10-15T12:00:00.000Z");
    });
});

// ══════════════════════════════════════════════════════════════
describe("endPrepaidTerm — a refund ends the membership", () => {
    it("ends a term even though paid_through is still in the future", async () => {
        // This is the ONE path allowed past guard 0, because a refunded
        // member has not, in the end, paid.
        userWith({
            tier: "pro",
            paid_through: FUTURE,
            paypal_prepaid_captures: ["CAP-1"],
            paypal_prepaid_tier: "pro",
            paypal_prepaid_order_id: "ORDER-1",
        });

        const outcome = await endPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            captureId: "CAP-1",
            reason: "REFUNDED",
        });

        expect(outcome).toEqual({ action: "revoked", userId: "user-1" });
        expect(written().tier).toBe("free");
        expect(written()).not.toHaveProperty("paid_through");
        expect(written()).not.toHaveProperty("paypal_prepaid_tier");
        expect(written()).not.toHaveProperty("paypal_prepaid_order_id");
    });

    // Clearing the capture list would let a redelivered
    // PAYMENT.CAPTURE.COMPLETED buy the term again, for refunded money.
    it("KEEPS the capture id, so the refunded capture cannot re-grant", async () => {
        userWith({
            tier: "pro",
            paid_through: FUTURE,
            paypal_prepaid_captures: ["CAP-1"],
            paypal_prepaid_tier: "pro",
        });
        await endPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            captureId: "CAP-1",
            reason: "REFUNDED",
        });
        expect(written().paypal_prepaid_captures).toEqual(["CAP-1"]);
    });

    it("ignores a capture that never bought a term here", async () => {
        userWith({ tier: "pro", paypal_prepaid_captures: ["CAP-1"], paypal_prepaid_tier: "pro" });
        const outcome = await endPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            captureId: "CAP-SOMEONE-ELSE",
            reason: "REFUNDED",
        });
        expect(outcome).toEqual({ action: "ignored", reason: "not-a-granting-capture" });
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    // ── Never reach across to another product ──
    it("never strips a Stripe subscriber, even on a genuine refund of an old term", async () => {
        userWith({
            // They let a term lapse, then subscribed by card.
            tier: "pro",
            stripe_customer_id: "cus_live_1",
            paypal_prepaid_captures: ["CAP-1"],
            paypal_prepaid_tier: "studio",
        });

        const outcome = await endPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1",
            captureId: "CAP-1",
            reason: "REFUNDED",
        });

        expect(outcome).toEqual({ action: "ignored", reason: "tier-not-granted-by-term" });
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("a replayed refund is a no-op the second time", async () => {
        userWith({
            tier: "pro",
            paid_through: FUTURE,
            paypal_prepaid_captures: ["CAP-1"],
            paypal_prepaid_tier: "pro",
        });
        await endPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1", captureId: "CAP-1", reason: "REFUNDED",
        });
        expect(mockUpdateUserById).toHaveBeenCalledTimes(1);

        // Second delivery, against the state the first one produced.
        mockUpdateUserById.mockClear();
        userWith({ tier: "free", paypal_prepaid_captures: ["CAP-1"] });
        const outcome = await endPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1", captureId: "CAP-1", reason: "REFUNDED",
        });
        // The tier is already free and the markers are gone, so the
        // write is harmless — but it must not throw or fail.
        expect(outcome.action).toBe("revoked");
    });

    it("returns failed so PayPal retries when the write fails", async () => {
        userWith({
            tier: "pro",
            paid_through: FUTURE,
            paypal_prepaid_captures: ["CAP-1"],
            paypal_prepaid_tier: "pro",
        });
        mockUpdateUserById.mockResolvedValue({ data: null, error: { message: "auth unavailable" } });
        const outcome = await endPrepaidTerm(admin as unknown as AdminArg, {
            userId: "user-1", captureId: "CAP-1", reason: "REVERSED",
        });
        expect(outcome).toEqual({ action: "failed", error: "term-write-failed" });
    });
});
