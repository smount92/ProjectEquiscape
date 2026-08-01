import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Adversarial coverage for the Supporter branches of the Stripe webhook ──
// Supporter is a cosmetic flag on public.users written ONLY here (service
// role). These tests pin the money-critical properties:
//   1. no signature / bad signature → 400, zero DB writes
//   2. supporter checkout writes public.users, NEVER app_metadata tier
//   3. supporter subscription events NEVER reach the pro/studio tier logic
//      (a supporter renewal must not grant Pro; a supporter cancellation must
//      not strip a paying Pro back to free)
//   4. cancellation actually clears the flag (deleted → is_supporter false)
//   5. failed supporter DB writes → 500 so Stripe retries (e.g. webhook env
//      enabled before migration 142 applied)
//   6. non-supporter subscriptions still route to the existing tier logic

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");
vi.stubEnv("STRIPE_SUPPORTER_PRICE_ID", "price_supporter_test");

// ── Stripe mock: constructEvent verdict is controlled per-test ──
const mockConstructEvent = vi.fn();
vi.mock("stripe", () => ({
    default: class MockStripe {
        webhooks = { constructEvent: mockConstructEvent };
    },
}));

// ── Admin client mock ──
let usersResolve: { data: unknown; error: unknown };
const usersBuilder = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    then: vi.fn((resolve: (v: unknown) => void) => Promise.resolve(usersResolve).then(resolve)),
};
const mockFrom = vi.fn(() => usersBuilder);
const mockListUsers = vi.fn();
const mockUpdateUserById = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({
        from: mockFrom,
        auth: { admin: { listUsers: mockListUsers, updateUserById: mockUpdateUserById } },
    })),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

function webhookRequest(body = "{}", signature: string | null = "sig_valid") {
    const headers: Record<string, string> = {};
    if (signature) headers["stripe-signature"] = signature;
    return new NextRequest(new URL("http://localhost:3000/api/webhooks/stripe"), {
        method: "POST",
        body,
        headers,
    });
}

function supporterSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: "sub_supporter_1",
        customer: "cus_1",
        status: "canceled",
        metadata: { type: "supporter", supabase_user_id: "user-1" },
        items: { data: [{ price: { id: "price_supporter_test" } }] },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    usersResolve = { data: null, error: null };
    usersBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockListUsers.mockResolvedValue({ data: { users: [] } });
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
});

describe("POST /api/webhooks/stripe — supporter", () => {
    it("rejects a request with no signature header (no DB access)", async () => {
        const res = await POST(webhookRequest("{}", null));
        expect(res.status).toBe(400);
        expect(mockConstructEvent).not.toHaveBeenCalled();
        expect(mockFrom).not.toHaveBeenCalled();
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("rejects a forged signature (no DB access)", async () => {
        mockConstructEvent.mockImplementationOnce(() => {
            throw new Error("Signature verification failed");
        });
        const res = await POST(webhookRequest("{}", "sig_forged"));
        expect(res.status).toBe(400);
        expect(mockFrom).not.toHaveBeenCalled();
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("supporter checkout sets is_supporter on public.users and never touches tier", async () => {
        mockConstructEvent.mockReturnValueOnce({
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_1",
                    client_reference_id: "user-1",
                    customer: "cus_1",
                    metadata: { type: "supporter", supabase_user_id: "user-1" },
                },
            },
        });

        const res = await POST(webhookRequest());
        expect(res.status).toBe(200);

        expect(mockFrom).toHaveBeenCalledWith("users");
        expect(usersBuilder.update).toHaveBeenCalledTimes(1);
        const updateArg = usersBuilder.update.mock.calls[0][0] as Record<string, unknown>;
        expect(updateArg.is_supporter).toBe(true);
        expect(typeof updateArg.supporter_since).toBe("string");
        expect(usersBuilder.eq).toHaveBeenCalledWith("id", "user-1");

        // The critical negative: no tier / app_metadata writes of any kind.
        expect(mockUpdateUserById).not.toHaveBeenCalled();
        expect(mockListUsers).not.toHaveBeenCalled();
    });

    it("supporter checkout preserves the original supporter_since on resubscribe", async () => {
        usersBuilder.maybeSingle.mockResolvedValueOnce({
            data: { supporter_since: "2026-01-15T00:00:00.000Z" },
            error: null,
        });
        mockConstructEvent.mockReturnValueOnce({
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_2",
                    client_reference_id: "user-1",
                    customer: "cus_1",
                    metadata: { type: "supporter", supabase_user_id: "user-1" },
                },
            },
        });

        const res = await POST(webhookRequest());
        expect(res.status).toBe(200);
        const updateArg = usersBuilder.update.mock.calls[0][0] as Record<string, unknown>;
        expect(updateArg.supporter_since).toBe("2026-01-15T00:00:00.000Z");
    });

    it("returns 500 (so Stripe retries) when the supporter write fails", async () => {
        usersResolve = { data: null, error: { message: 'column "is_supporter" does not exist' } };
        mockConstructEvent.mockReturnValueOnce({
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_3",
                    client_reference_id: "user-1",
                    customer: "cus_1",
                    metadata: { type: "supporter", supabase_user_id: "user-1" },
                },
            },
        });

        const res = await POST(webhookRequest());
        expect(res.status).toBe(500);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("supporter subscription.deleted clears the flag and never reaches tier logic", async () => {
        mockConstructEvent.mockReturnValueOnce({
            type: "customer.subscription.deleted",
            data: { object: supporterSubscription({ status: "canceled" }) },
        });

        const res = await POST(webhookRequest());
        expect(res.status).toBe(200);

        expect(usersBuilder.update).toHaveBeenCalledWith({ is_supporter: false });
        expect(usersBuilder.eq).toHaveBeenCalledWith("id", "user-1");

        // A supporter cancellation must NOT strip anyone's pro/studio tier.
        expect(mockListUsers).not.toHaveBeenCalled();
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("supporter subscription.updated (active renewal) keeps the flag and never grants Pro", async () => {
        mockConstructEvent.mockReturnValueOnce({
            type: "customer.subscription.updated",
            data: { object: supporterSubscription({ status: "active" }) },
        });

        const res = await POST(webhookRequest());
        expect(res.status).toBe(200);
        expect(usersBuilder.update).toHaveBeenCalledWith({ is_supporter: true });
        expect(mockListUsers).not.toHaveBeenCalled();
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("supporter sub identified by price id alone (lost metadata) is quarantined from tier logic", async () => {
        mockConstructEvent.mockReturnValueOnce({
            type: "customer.subscription.deleted",
            data: { object: supporterSubscription({ metadata: {} }) },
        });

        const res = await POST(webhookRequest());
        expect(res.status).toBe(200);
        // Without supabase_user_id we can't write — but the event must still
        // never fall through to the pro/studio tier logic.
        expect(usersBuilder.update).not.toHaveBeenCalled();
        expect(mockListUsers).not.toHaveBeenCalled();
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("non-supporter subscription.deleted still runs the existing pro tier logic", async () => {
        mockListUsers.mockResolvedValueOnce({
            data: {
                users: [
                    { id: "user-9", app_metadata: { stripe_customer_id: "cus_9", tier: "pro" } },
                ],
            },
        });
        mockConstructEvent.mockReturnValueOnce({
            type: "customer.subscription.deleted",
            data: {
                object: {
                    id: "sub_pro_1",
                    customer: "cus_9",
                    status: "canceled",
                    metadata: {},
                    items: { data: [{ price: { id: "price_pro_test" } }] },
                },
            },
        });

        const res = await POST(webhookRequest());
        expect(res.status).toBe(200);
        expect(mockListUsers).toHaveBeenCalled();
        expect(mockUpdateUserById).toHaveBeenCalledWith("user-9", {
            app_metadata: expect.objectContaining({ tier: "free" }),
        });
        // Pro path must not touch supporter columns.
        expect(usersBuilder.update).not.toHaveBeenCalled();
    });
});
