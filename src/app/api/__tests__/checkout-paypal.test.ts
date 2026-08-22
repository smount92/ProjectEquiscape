import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// ── Coverage for POST /api/checkout/paypal ──
//
// The properties that matter here:
//   1. flag off / credentials missing ⇒ the route does not exist (404),
//      which is exactly how the site behaves today
//   2. anonymous callers get nothing
//   3. an existing PAID member — by card OR by PayPal — cannot start a
//      second subscription (this is the double-billing guard, and it
//      works across providers because `tier` is the single tier of record)
//   4. the Supabase user id rides along as custom_id, which is the only
//      thing that lets the webhook map the subscription back to a member

vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
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

import { POST } from "@/app/api/checkout/paypal/route";
import { resetPaypalTokenCache } from "@/lib/paypal/client";

let createdBodies: Array<Record<string, unknown>> = [];

function jsonResponse(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const mockFetch = vi.fn(async (input: unknown, init?: { body?: string }) => {
    const url = String(input);
    if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok", expires_in: 32000 });
    }
    if (url.includes("/v1/billing/subscriptions")) {
        createdBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return jsonResponse({
            id: "I-NEW-SUB",
            status: "APPROVAL_PENDING",
            links: [
                { rel: "self", href: "https://api.paypal.com/self" },
                { rel: "approve", href: "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-1" },
            ],
        });
    }
    return jsonResponse({ name: "UNEXPECTED" }, 500);
});
vi.stubGlobal("fetch", mockFetch);

function request(body: unknown) {
    return new Request("http://localhost:3000/api/checkout/paypal", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    resetPaypalTokenCache();
    createdBodies = [];
    mockUser = { id: "user-1", email: "a@b.test" };
    mockTier = "free";
});

afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe("POST /api/checkout/paypal", () => {
    it("returns the PayPal approval URL for a free member", async () => {
        const res = await POST(request({ plan: "pro" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.url).toContain("paypal.com");
    });

    it("carries the Supabase user id through custom_id", async () => {
        await POST(request({ plan: "pro" }));
        expect(createdBodies).toHaveLength(1);
        expect(createdBodies[0].custom_id).toBe("user-1");
        expect(createdBodies[0].plan_id).toBe("P-PRO-PLAN");
    });

    it("uses the studio plan id for the studio plan", async () => {
        await POST(request({ plan: "studio" }));
        expect(createdBodies[0].plan_id).toBe("P-STUDIO-PLAN");
    });

    it("sends the member back through the verifying return route", async () => {
        await POST(request({ plan: "pro" }));
        const context = createdBodies[0].application_context as Record<string, string>;
        expect(context.return_url).toContain("/api/checkout/paypal/return");
        expect(context.cancel_url).toContain("/upgrade?status=cancelled");
    });

    // ── The double-billing guard ──
    it("refuses a member who is already Pro (however they pay)", async () => {
        mockTier = "pro";
        const res = await POST(request({ plan: "pro" }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain("already on MHH Pro");
        expect(createdBodies).toHaveLength(0);
    });

    it("refuses a Studio member trying to add a Pro subscription", async () => {
        mockTier = "studio";
        const res = await POST(request({ plan: "pro" }));
        expect(res.status).toBe(400);
        expect(createdBodies).toHaveLength(0);
    });

    it("refuses a Studio member trying to buy Studio again", async () => {
        mockTier = "studio";
        const res = await POST(request({ plan: "studio" }));
        expect(res.status).toBe(400);
        expect(createdBodies).toHaveLength(0);
    });

    it("lets a Pro member upgrade to Studio", async () => {
        mockTier = "pro";
        const res = await POST(request({ plan: "studio" }));
        expect(res.status).toBe(200);
        expect(createdBodies[0].plan_id).toBe("P-STUDIO-PLAN");
    });

    it("rejects an anonymous caller", async () => {
        mockUser = null;
        const res = await POST(request({ plan: "pro" }));
        expect(res.status).toBe(401);
        expect(createdBodies).toHaveLength(0);
    });

    it("rejects an unknown plan", async () => {
        const res = await POST(request({ plan: "enterprise" }));
        expect(res.status).toBe(400);
        expect(createdBodies).toHaveLength(0);
    });

    it("rejects a malformed body", async () => {
        const res = await POST(request("{not json"));
        expect(res.status).toBe(400);
        expect(createdBodies).toHaveLength(0);
    });

    it("is a 404 with the flag off, and never contacts PayPal", async () => {
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "0");
        const res = await POST(request({ plan: "pro" }));
        expect(res.status).toBe(404);
        expect(mockFetch).not.toHaveBeenCalled();
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
    });

    it("is a 404 when credentials are missing", async () => {
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
        const res = await POST(request({ plan: "pro" }));
        expect(res.status).toBe(404);
        expect(mockFetch).not.toHaveBeenCalled();
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-client-secret");
    });

    it("reports a clean error when the plan id is not configured", async () => {
        vi.stubEnv("PAYPAL_PRO_PLAN_ID", "");
        const res = await POST(request({ plan: "pro" }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toContain("not yet configured");
        expect(createdBodies).toHaveLength(0);
        vi.stubEnv("PAYPAL_PRO_PLAN_ID", "P-PRO-PLAN");
    });

    it("does not leak PayPal internals when the API fails", async () => {
        mockFetch.mockImplementationOnce(async () => jsonResponse({ access_token: "t", expires_in: 300 }));
        mockFetch.mockImplementationOnce(async () =>
            jsonResponse({ name: "INTERNAL_SERVICE_ERROR", debug_id: "abc123" }, 500),
        );
        const res = await POST(request({ plan: "pro" }));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe("Failed to start PayPal checkout.");
        expect(JSON.stringify(body)).not.toContain("debug_id");
    });
});
