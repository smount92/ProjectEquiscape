import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// ── Coverage for POST /api/checkout/paypal/prepaid ──
//
// The properties that matter here:
//   1. WITH THE FLAG OFF THIS ROUTE DOES NOT EXIST. That is what makes
//      the whole feature safe to merge into a live site — no order can
//      be created, so no capture can ever exist, so nothing downstream
//      can fire.
//   2. nothing is charged here. The order is created unapproved and
//      uncaptured; the money moves on the return leg.
//   3. only terms that are actually in config/membership-terms.json can
//      be bought, at the price that file says.
//   4. an existing paid member cannot buy on top of themselves.
//   5. the spread-payment mode creates a SUBSCRIPTION on the owner's
//      fixed-term plan, and refuses when that plan is not configured.

vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
vi.stubEnv("NEXT_PUBLIC_PREPAID_TERMS", "1");
vi.stubEnv("PAYPAL_CLIENT_ID", "test-client-id");
vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("PAYPAL_ENV", "sandbox");
vi.stubEnv("PAYPAL_PRO_PLAN_ID", "P-PRO-PLAN");
vi.stubEnv("PAYPAL_STUDIO_PLAN_ID", "P-STUDIO-PLAN");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://modelhorsehub.com");

let mockUser: { id: string; email?: string } | null = { id: "user-1", email: "a@b.test" };
vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: async () => ({ data: { user: mockUser } }) },
    })),
}));

let mockTier = "free";
vi.mock("@/lib/auth", async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        getUserTier: vi.fn(async () => mockTier),
    };
});

import { POST } from "@/app/api/checkout/paypal/prepaid/route";
import { resetPaypalTokenCache } from "@/lib/paypal/client";

let orderBodies: Array<Record<string, unknown>> = [];
let subscriptionBodies: Array<Record<string, unknown>> = [];
let calledPaths: string[] = [];

function jsonResponse(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const defaultFetch = async (input: unknown, init?: { body?: string }) => {
    const url = String(input);
    if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok", expires_in: 32000 });
    }
    calledPaths.push(url);
    if (url.endsWith("/v2/checkout/orders")) {
        orderBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return jsonResponse({
            id: "ORDER-NEW",
            status: "PAYER_ACTION_REQUIRED",
            links: [
                { rel: "self", href: "https://api.paypal.com/self" },
                { rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-NEW" },
            ],
        });
    }
    if (url.includes("/v1/billing/subscriptions")) {
        subscriptionBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return jsonResponse({
            id: "I-FIXED-SUB",
            status: "APPROVAL_PENDING",
            links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/subscribe?ba_token=BA-2" }],
        });
    }
    return jsonResponse({ name: "UNEXPECTED" }, 500);
};

const mockFetch = vi.fn(defaultFetch);
vi.stubGlobal("fetch", mockFetch);

function request(body: unknown) {
    return new Request("http://localhost:3000/api/checkout/paypal/prepaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks wipes recorded calls, NOT implementations — so the
    // one test that swaps fetch for a failing stub would otherwise leak
    // into every test after it.
    mockFetch.mockImplementation(defaultFetch);
    resetPaypalTokenCache();
    mockUser = { id: "user-1", email: "a@b.test" };
    mockTier = "free";
    orderBodies = [];
    subscriptionBodies = [];
    calledPaths = [];
});

afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════
describe("the flag-off path is a complete no-op", () => {
    // ── The property that makes this safe to merge dark ──
    it("is a 404 with NEXT_PUBLIC_PREPAID_TERMS off, and never contacts PayPal", async () => {
        vi.stubEnv("NEXT_PUBLIC_PREPAID_TERMS", "0");
        const res = await POST(request({ term: "pro-6" }));
        expect(res.status).toBe(404);
        expect(calledPaths).toHaveLength(0);
        expect(mockFetch).not.toHaveBeenCalled();
        vi.stubEnv("NEXT_PUBLIC_PREPAID_TERMS", "1");
    });

    it("is a 404 when the flag is unset entirely", async () => {
        vi.stubEnv("NEXT_PUBLIC_PREPAID_TERMS", "");
        const res = await POST(request({ term: "pro-6" }));
        expect(res.status).toBe(404);
        expect(mockFetch).not.toHaveBeenCalled();
        vi.stubEnv("NEXT_PUBLIC_PREPAID_TERMS", "1");
    });

    it("is a 404 when the PayPal path itself is off, even with terms on", async () => {
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "0");
        const res = await POST(request({ term: "pro-6" }));
        expect(res.status).toBe(404);
        expect(mockFetch).not.toHaveBeenCalled();
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
    });

    it("is a 404 when the server credentials are missing", async () => {
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
        const res = await POST(request({ term: "pro-6" }));
        expect(res.status).toBe(404);
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-client-secret");
    });
});

// ══════════════════════════════════════════════════════════════
describe("POST /api/checkout/paypal/prepaid — prepaid orders", () => {
    it("turns an anonymous caller away", async () => {
        mockUser = null;
        const res = await POST(request({ term: "pro-6" }));
        expect(res.status).toBe(401);
        expect(orderBodies).toHaveLength(0);
    });

    it("creates an order and hands back the payer-action URL", async () => {
        const res = await POST(request({ term: "pro-6", mode: "prepaid" }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            url: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-NEW",
        });
    });

    it("charges the price from the config file, with the buyer and term in custom_id", async () => {
        await POST(request({ term: "pro-6" }));
        const unit = (orderBodies[0].purchase_units as Array<Record<string, unknown>>)[0];
        expect(unit.amount).toEqual({ currency_code: "USD", value: "27.00" });
        expect(unit.custom_id).toBe("user-1|pro-6");
    });

    it("points the return leg at the route that CAPTURES", async () => {
        await POST(request({ term: "pro-12" }));
        const ctx = (
            (orderBodies[0].payment_source as Record<string, Record<string, Record<string, string>>>)
                .paypal.experience_context
        );
        expect(ctx.return_url).toBe("https://modelhorsehub.com/api/checkout/paypal/prepaid/return");
    });

    it.each(["pro-3", "pro-6", "pro-12", "studio-3", "studio-6", "studio-12"])(
        "sells the configured term %s",
        async (term) => {
            const res = await POST(request({ term }));
            expect(res.status).toBe(200);
        },
    );

    it("refuses a term that is not in the config file", async () => {
        const res = await POST(request({ term: "pro-99" }));
        expect(res.status).toBe(400);
        expect(orderBodies).toHaveLength(0);
    });

    it("refuses a missing or non-string term", async () => {
        expect((await POST(request({}))).status).toBe(400);
        expect((await POST(request({ term: 6 }))).status).toBe(400);
        expect(orderBodies).toHaveLength(0);
    });

    it("refuses a body that is not JSON", async () => {
        const res = await POST(
            new Request("http://localhost:3000/api/checkout/paypal/prepaid", {
                method: "POST",
                body: "{not json",
            }),
        );
        expect(res.status).toBe(400);
    });

    // ── Double-purchase guard ──
    it("turns away a member who is already Pro", async () => {
        mockTier = "pro";
        const res = await POST(request({ term: "pro-6" }));
        expect(res.status).toBe(400);
        expect(orderBodies).toHaveLength(0);
    });

    it("turns away a Studio member buying a Pro term", async () => {
        mockTier = "studio";
        const res = await POST(request({ term: "pro-3" }));
        expect(res.status).toBe(400);
    });

    it("lets a Pro member buy a Studio term", async () => {
        mockTier = "pro";
        const res = await POST(request({ term: "studio-6" }));
        expect(res.status).toBe(200);
    });

    // getUserTier applies the clock, so a lapsed member reads as free —
    // which IS the renewal path for a product that does not renew.
    it("lets a member whose term has run out buy another", async () => {
        mockTier = "free";
        const res = await POST(request({ term: "pro-6" }));
        expect(res.status).toBe(200);
    });

    it("reports a PayPal failure as a 500 without leaking anything", async () => {
        mockFetch.mockImplementation(async (input: unknown) => {
            if (String(input).includes("/v1/oauth2/token")) {
                return jsonResponse({ access_token: "tok", expires_in: 100 });
            }
            return jsonResponse({ name: "INTERNAL_SERVER_ERROR" }, 500);
        });
        const res = await POST(request({ term: "pro-6" }));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "Failed to start PayPal checkout." });
    });
});

// ══════════════════════════════════════════════════════════════
describe("POST /api/checkout/paypal/prepaid — spread payments", () => {
    it("refuses when the owner has not created the fixed-term plan", async () => {
        const res = await POST(request({ term: "pro-6", mode: "fixed" }));
        expect(res.status).toBe(500);
        expect(subscriptionBodies).toHaveLength(0);
    });

    it("creates a subscription on the configured plan once its id is set", async () => {
        vi.stubEnv("PAYPAL_PRO_6MO_PLAN_ID", "P-PRO-6MO");
        const res = await POST(request({ term: "pro-6", mode: "fixed" }));
        expect(res.status).toBe(200);
        expect(subscriptionBodies[0].plan_id).toBe("P-PRO-6MO");
        // The subscription path's own custom_id shape — a bare user id.
        expect(subscriptionBodies[0].custom_id).toBe("user-1");
        // And no order was created.
        expect(orderBodies).toHaveLength(0);
        vi.stubEnv("PAYPAL_PRO_6MO_PLAN_ID", "");
    });

    it("defaults to prepaid when mode is absent or unrecognised", async () => {
        await POST(request({ term: "pro-6" }));
        await POST(request({ term: "pro-6", mode: "nonsense" }));
        expect(orderBodies).toHaveLength(2);
        expect(subscriptionBodies).toHaveLength(0);
    });
});
