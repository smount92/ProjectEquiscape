import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Money going back, and failed payments (MHH-023) ──
// Before: a refund, a chargeback or a failed renewal reached nobody. Pinned:
//   1. a failed renewal tells the member, pointing at Settings › Subscription
//   2. a refund tells the member and the owner what THIS refund gave back,
//      and never touches anyone's plan (they may have moved to PayPal or a
//      prepaid term; cancelling in Stripe sends its own event)
//   4. a repeated delivery of the same event sends no second notice
//   3. a chargeback alerts the owner with the amount and reason

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");

const mockConstructEvent = vi.fn();
const mockSubsRetrieve = vi.fn();
const mockSubsList = vi.fn();
const mockChargesRetrieve = vi.fn();
vi.mock("stripe", () => ({
    default: class MockStripe {
        webhooks = { constructEvent: mockConstructEvent };
        subscriptions = { retrieve: mockSubsRetrieve, list: mockSubsList };
        charges = { retrieve: mockChargesRetrieve };
    },
}));

const builder = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    then: vi.fn((resolve: (v: unknown) => void) => Promise.resolve({ data: null, error: null }).then(resolve)),
};
const mockListUsers = vi.fn();
const mockUpdateUserById = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({
        from: vi.fn(() => builder),
        rpc: vi.fn().mockResolvedValue({ error: null }),
        auth: { admin: { listUsers: mockListUsers, updateUserById: mockUpdateUserById } },
    })),
}));

const notifications: { userId: string; content: string; linkUrl?: string }[] = [];
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn(async (n: { userId: string; content: string; linkUrl?: string }) => {
        notifications.push(n);
    }),
}));
vi.mock("@/lib/notifications/adminTargets", () => ({
    adminNotificationTargets: vi.fn(async () => ["owner-1"]),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

const request = () =>
    new NextRequest(new URL("http://localhost:3000/api/webhooks/stripe"), {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "sig_valid" },
    });

const member = { id: "member-1", app_metadata: { stripe_customer_id: "cus_1", tier: "pro" } };
const activeSub = { id: "sub_1", customer: "cus_1", status: "active", metadata: {}, items: { data: [] } };

beforeEach(() => {
    vi.clearAllMocks();
    notifications.length = 0;
    mockListUsers.mockResolvedValue({ data: { users: [member] } });
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
    builder.maybeSingle.mockResolvedValue({ data: { alias_name: "Cheapie" }, error: null });
    mockSubsList.mockResolvedValue({ data: [activeSub] });
});

describe("POST /api/webhooks/stripe — money going back", () => {
    it("tells the member when a renewal fails", async () => {
        mockConstructEvent.mockReturnValue({
            type: "invoice.payment_failed",
            data: {
                object: {
                    id: "in_1",
                    attempt_count: 1,
                    parent: { subscription_details: { subscription: "sub_1" } },
                },
            },
        });
        mockSubsRetrieve.mockResolvedValue({ ...activeSub, status: "past_due" });
        const res = await POST(request());
        expect(res.status).toBe(200);
        const notice = notifications.find((n) => n.userId === "member-1");
        expect(notice?.content).toMatch(/didn't go through/);
        expect(notice?.linkUrl).toBe("/settings#subscription");
    });

    it("tells the member and the owner about a refund, and leaves every plan alone", async () => {
        mockConstructEvent.mockReturnValue({
            id: "evt_1",
            type: "charge.refunded",
            data: { object: { id: "ch_1", customer: "cus_1", refunded: true, amount_refunded: 500, currency: "usd" } },
        });
        const res = await POST(request());
        expect(res.status).toBe(200);
        expect(notifications.find((n) => n.userId === "member-1")?.content).toContain("refund of $5.00");
        const owner = notifications.find((n) => n.userId === "owner-1");
        expect(owner?.content).toContain("full refund of $5.00 for @Cheapie");
        expect(owner?.linkUrl).toBe("https://dashboard.stripe.com/customers/cus_1");
        expect(mockSubsList).not.toHaveBeenCalled();
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("reports only what this refund gave back, not the running total", async () => {
        mockConstructEvent.mockReturnValue({
            id: "evt_2",
            type: "charge.refunded",
            data: {
                object: { id: "ch_1", customer: "cus_1", refunded: false, amount_refunded: 500, currency: "usd" },
                previous_attributes: { amount_refunded: 200 },
            },
        });
        await POST(request());
        expect(notifications.find((n) => n.userId === "owner-1")?.content).toContain("partial refund of $3.00");
    });

    it("sends nothing the second time Stripe delivers the same event", async () => {
        mockConstructEvent.mockReturnValue({
            id: "evt_1",
            type: "charge.refunded",
            data: { object: { id: "ch_1", customer: "cus_1", refunded: true, amount_refunded: 500, currency: "usd" } },
        });
        builder.then.mockImplementationOnce((resolve: (v: unknown) => void) =>
            Promise.resolve({ data: null, error: { code: "23505" } }).then(resolve),
        );
        const res = await POST(request());
        expect(res.status).toBe(200);
        expect(notifications).toEqual([]);
    });

    it("alerts the owner to a chargeback", async () => {
        mockConstructEvent.mockReturnValue({
            type: "charge.dispute.created",
            data: {
                object: { id: "dp_1", charge: "ch_1", amount: 1000, currency: "usd", reason: "product_not_received" },
            },
        });
        mockChargesRetrieve.mockResolvedValue({ id: "ch_1", customer: "cus_1" });
        const res = await POST(request());
        expect(res.status).toBe(200);
        const owner = notifications.find((n) => n.userId === "owner-1");
        expect(owner?.content).toMatch(/Chargeback opened: \$10\.00 by @Cheapie \(reason: product not received\)/);
        expect(notifications.some((n) => n.userId === "member-1")).toBe(false);
    });
});
