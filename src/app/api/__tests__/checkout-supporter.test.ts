import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

// ── POST /api/checkout/supporter ──
// Pins: auth required; dark ship (unset env → friendly 500, no Stripe call);
// double-subscription guard; the session carries supporter metadata on BOTH
// the session and the subscription (the webhook's routing depends on it).

let mockClient: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

const mockSessionsCreate = vi.fn();
vi.mock("stripe", () => ({
    default: class MockStripe {
        checkout = { sessions: { create: mockSessionsCreate } };
    },
}));

import { POST } from "@/app/api/checkout/supporter/route";

describe("POST /api/checkout/supporter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient = createMockSupabaseClient();
        vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
        vi.stubEnv("STRIPE_SUPPORTER_PRICE_ID", "price_supporter_test");
        mockSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns 401 when unauthenticated", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        const res = await POST();
        expect(res.status).toBe(401);
        expect(mockSessionsCreate).not.toHaveBeenCalled();
    });

    it("dark ship: returns a friendly 500 when STRIPE_SUPPORTER_PRICE_ID is unset", async () => {
        vi.stubEnv("STRIPE_SUPPORTER_PRICE_ID", "");
        const res = await POST();
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toMatch(/not yet configured/i);
        expect(mockSessionsCreate).not.toHaveBeenCalled();
    });

    it("blocks double-subscription for an existing supporter", async () => {
        (mockClient._mockQuery.maybeSingle as Mock).mockResolvedValueOnce({
            data: { is_supporter: true, supporter_since: "2026-01-01T00:00:00Z", show_in_supporters_ledger: false },
            error: null,
        });
        const res = await POST();
        expect(res.status).toBe(400);
        expect(mockSessionsCreate).not.toHaveBeenCalled();
    });

    it("creates an annual checkout session stamped with supporter metadata", async () => {
        const res = await POST();
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.url).toBe("https://checkout.stripe.com/test");

        expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
        const arg = mockSessionsCreate.mock.calls[0][0];
        expect(arg.mode).toBe("subscription");
        expect(arg.line_items).toEqual([{ price: "price_supporter_test", quantity: 1 }]);
        expect(arg.client_reference_id).toBe("test-user-id");
        expect(arg.metadata).toMatchObject({ type: "supporter", supabase_user_id: "test-user-id" });
        // The subscription itself must carry the metadata — the webhook uses
        // it to keep supporter events away from the pro/studio tier logic.
        expect(arg.subscription_data?.metadata).toMatchObject({
            type: "supporter",
            supabase_user_id: "test-user-id",
        });
    });

    it("tolerates a not-yet-applied migration (badge read error) and still checks out", async () => {
        (mockClient._mockQuery.maybeSingle as Mock).mockResolvedValueOnce({
            data: null,
            error: { message: 'column "is_supporter" does not exist' },
        });
        const res = await POST();
        expect(res.status).toBe(200);
        expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
    });
});
