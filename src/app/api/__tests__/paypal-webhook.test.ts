import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";

// ── Adversarial coverage for the PayPal webhook ──
//
// This is money code on a live site, so the tests are weighted toward the
// NEGATIVES — the things that must never happen:
//
//   1. an unverified delivery grants nothing (forgery = free paid tiers)
//   2. a PayPal event never downgrades a tier PayPal did not grant
//      (a cancelled PayPal sub must not strip a paying Stripe subscriber)
//   3. an unrecognised plan grants nothing rather than guessing a tier
//   4. replays land on exactly the state the first delivery produced
//   5. with the flag off the endpoint behaves as if it does not exist
//
// The PayPal API is mocked at the `fetch` boundary rather than by stubbing
// our own modules, so the real token cache, the real cert-URL check and
// the real verification-payload construction all execute under test.

vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
vi.stubEnv("PAYPAL_CLIENT_ID", "test-client-id");
vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-CONFIGURED-ID");
vi.stubEnv("PAYPAL_ENV", "sandbox");
vi.stubEnv("PAYPAL_PRO_PLAN_ID", "P-PRO-PLAN");
vi.stubEnv("PAYPAL_STUDIO_PLAN_ID", "P-STUDIO-PLAN");

// ── Admin client mock ──
const mockRpc = vi.fn();
const mockGetUserById = vi.fn();
const mockUpdateUserById = vi.fn();
const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({
        from: mockFrom,
        rpc: mockRpc,
        auth: { admin: { getUserById: mockGetUserById, updateUserById: mockUpdateUserById } },
    })),
}));

import { POST } from "@/app/api/webhooks/paypal/route";
import { resetPaypalTokenCache } from "@/lib/paypal/client";

// ── PayPal HTTP mock ──
let verifyVerdict = "SUCCESS";
let subscriptionFixtures: Record<string, unknown> = {};
let verifyPayloads: Array<Record<string, unknown>> = [];
let fetchedPaths: string[] = [];

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const mockFetch = vi.fn(async (input: unknown, init?: { body?: string }) => {
    const url = String(input);
    fetchedPaths.push(url);

    if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "test-access-token", expires_in: 32000 });
    }
    if (url.includes("/v1/notifications/verify-webhook-signature")) {
        verifyPayloads.push(JSON.parse(String(init?.body ?? "{}")));
        return jsonResponse({ verification_status: verifyVerdict });
    }
    const match = url.match(/\/v1\/billing\/subscriptions\/([^/?]+)$/);
    if (match) {
        const fixture = subscriptionFixtures[decodeURIComponent(match[1])];
        return fixture ? jsonResponse(fixture) : jsonResponse({ name: "RESOURCE_NOT_FOUND" }, 404);
    }
    return jsonResponse({ name: "UNEXPECTED_CALL" }, 500);
});

vi.stubGlobal("fetch", mockFetch);

// ── Request builder ──
const GOOD_HEADERS: Record<string, string> = {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-abc",
    "paypal-transmission-id": "tx-1",
    "paypal-transmission-sig": "sig-1",
    "paypal-transmission-time": "2026-08-21T10:00:00Z",
};

function webhookRequest(body: unknown, headers: Record<string, string> | null = GOOD_HEADERS) {
    return new NextRequest(new URL("http://localhost:3000/api/webhooks/paypal"), {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: headers ?? {},
    });
}

function activatedEvent(overrides: Record<string, unknown> = {}) {
    return {
        id: "WH-EVENT-1",
        event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        resource_type: "subscription",
        resource: {
            id: "I-SUB-1",
            status: "ACTIVE",
            plan_id: "P-PRO-PLAN",
            custom_id: "user-1",
            billing_info: { next_billing_time: "2026-09-21T10:00:00Z" },
            ...((overrides.resource as Record<string, unknown>) ?? {}),
        },
        ...overrides,
        ...(overrides.resource ? {} : {}),
    };
}

function terminalEvent(eventType: string, overrides: Record<string, unknown> = {}) {
    return {
        id: `WH-${eventType}`,
        event_type: eventType,
        resource_type: "subscription",
        resource: {
            id: "I-SUB-1",
            status: eventType.split(".").pop(),
            plan_id: "P-PRO-PLAN",
            custom_id: "user-1",
            ...((overrides.resource as Record<string, unknown>) ?? {}),
        },
    };
}

/** A member whose paid tier came from PayPal subscription I-SUB-1. */
function paypalSubscriberMetadata(tier = "pro") {
    return {
        tier,
        paypal_subscription_id: "I-SUB-1",
        paypal_tier: tier,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    resetPaypalTokenCache();
    verifyVerdict = "SUCCESS";
    subscriptionFixtures = {};
    verifyPayloads = [];
    fetchedPaths = [];
    // Default: the replay ledger says "first time, proceed".
    mockRpc.mockResolvedValue({ data: true, error: null });
    mockGetUserById.mockResolvedValue({
        data: { user: { id: "user-1", app_metadata: {} } },
        error: null,
    });
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
});

afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════
describe("POST /api/webhooks/paypal — signature verification", () => {
    it("rejects a delivery with no signature headers, without calling PayPal or the DB", async () => {
        const res = await POST(webhookRequest(activatedEvent(), null));
        expect(res.status).toBe(400);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
        expect(mockRpc).not.toHaveBeenCalled();
        // Never even asked PayPal to verify — there was nothing to verify.
        expect(fetchedPaths.some((p) => p.includes("verify-webhook-signature"))).toBe(false);
    });

    it("rejects a delivery missing even one signature header", async () => {
        const partial = { ...GOOD_HEADERS };
        delete partial["paypal-transmission-sig"];
        const res = await POST(webhookRequest(activatedEvent(), partial));
        expect(res.status).toBe(400);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("rejects a FAILURE verdict from PayPal and grants nothing", async () => {
        verifyVerdict = "FAILURE";
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Invalid signature" });
        expect(mockUpdateUserById).not.toHaveBeenCalled();
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it("rejects a delivery whose cert_url is not a PayPal host, without forwarding it", async () => {
        const forged = { ...GOOD_HEADERS, "paypal-cert-url": "https://paypal.com.evil.test/cert" };
        const res = await POST(webhookRequest(activatedEvent(), forged));
        expect(res.status).toBe(400);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
        // The attacker-controlled URL never reached the verification call.
        expect(verifyPayloads).toHaveLength(0);
    });

    it("sends the raw body verbatim as webhook_event, with the configured webhook id", async () => {
        const event = activatedEvent();
        await POST(webhookRequest(event));
        expect(verifyPayloads).toHaveLength(1);
        const payload = verifyPayloads[0];
        expect(payload.webhook_id).toBe("WH-CONFIGURED-ID");
        expect(payload.transmission_id).toBe("tx-1");
        // The event survived the round trip byte-identically.
        expect(payload.webhook_event).toEqual(event);
    });

    it("grants nothing when PAYPAL_WEBHOOK_ID is absent", async () => {
        vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(400);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
        vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-CONFIGURED-ID");
    });

    it("treats an unreachable verification service as unverified (fails closed)", async () => {
        mockFetch.mockImplementationOnce(async () => jsonResponse({ access_token: "t", expires_in: 3000 }));
        mockFetch.mockImplementationOnce(async () => {
            throw new Error("network down");
        });
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(400);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
describe("POST /api/webhooks/paypal — BILLING.SUBSCRIPTION.ACTIVATED", () => {
    it("grants the Pro tier and stamps the subscription that bought it", async () => {
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(200);

        expect(mockUpdateUserById).toHaveBeenCalledWith("user-1", {
            app_metadata: {
                tier: "pro",
                paypal_subscription_id: "I-SUB-1",
                paypal_tier: "pro",
            },
        });
    });

    it("grants Studio for the studio plan id — never the cheaper tier", async () => {
        const event = activatedEvent();
        event.resource.plan_id = "P-STUDIO-PLAN";
        const res = await POST(webhookRequest(event));
        expect(res.status).toBe(200);

        const write = mockUpdateUserById.mock.calls[0][1] as { app_metadata: Record<string, unknown> };
        expect(write.app_metadata.tier).toBe("studio");
        expect(write.app_metadata.paypal_tier).toBe("studio");
    });

    it("preserves other app_metadata keys — a purchase must not unsuspend anyone", async () => {
        mockGetUserById.mockResolvedValue({
            data: { user: { id: "user-1", app_metadata: { is_suspended: true, favourite: "yes" } } },
            error: null,
        });
        await POST(webhookRequest(activatedEvent()));
        const write = mockUpdateUserById.mock.calls[0][1] as { app_metadata: Record<string, unknown> };
        expect(write.app_metadata.is_suspended).toBe(true);
        expect(write.app_metadata.favourite).toBe("yes");
        expect(write.app_metadata.tier).toBe("pro");
    });

    it("grants nothing when the plan id is unrecognised", async () => {
        const event = activatedEvent();
        event.resource.plan_id = "P-SOMETHING-ELSE";
        const res = await POST(webhookRequest(event));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("grants nothing when custom_id is missing (no way to map to a member)", async () => {
        const event = activatedEvent();
        delete (event.resource as Record<string, unknown>).custom_id;
        // Resource is now incomplete, so the route re-fetches — and the
        // fetched copy has no custom_id either.
        subscriptionFixtures["I-SUB-1"] = {
            id: "I-SUB-1",
            status: "ACTIVE",
            plan_id: "P-PRO-PLAN",
        };
        const res = await POST(webhookRequest(event));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("mirrors into subscription_state alongside the tier write", async () => {
        await POST(webhookRequest(activatedEvent()));
        const mirror = mockRpc.mock.calls.find((c) => c[0] === "record_paypal_subscription_state");
        expect(mirror).toBeDefined();
        expect(mirror![1]).toMatchObject({
            p_user_id: "user-1",
            p_tier: "pro",
            p_status: "active",
            p_paypal_subscription_id: "I-SUB-1",
        });
    });

    it("falls back to the 176 mirror when migration 183 is not pasted yet", async () => {
        mockRpc.mockImplementation(async (name: string) => {
            if (name === "claim_paypal_webhook_event") {
                return { data: null, error: { code: "42883", message: "function does not exist" } };
            }
            if (name === "record_paypal_subscription_state") {
                return { data: null, error: { code: "42883", message: "function does not exist" } };
            }
            return { data: null, error: null };
        });

        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(200);
        // The tier still landed — that is the part that gates the site.
        expect(mockUpdateUserById).toHaveBeenCalled();
        // And the mirror degraded to the Stripe-era RPC with null ids.
        const fallback = mockRpc.mock.calls.find((c) => c[0] === "record_subscription_state");
        expect(fallback).toBeDefined();
        expect(fallback![1]).toMatchObject({
            p_user_id: "user-1",
            p_tier: "pro",
            p_stripe_customer_id: null,
            p_stripe_subscription_id: null,
        });
    });

    it("returns 500 so PayPal retries when the tier write fails", async () => {
        mockUpdateUserById.mockResolvedValue({ data: null, error: { message: "auth unavailable" } });
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(500);
    });

    it("does not retry forever for a member who no longer exists", async () => {
        mockGetUserById.mockResolvedValue({ data: { user: null }, error: null });
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
describe("POST /api/webhooks/paypal — cancellation, expiry, suspension", () => {
    for (const eventType of [
        "BILLING.SUBSCRIPTION.CANCELLED",
        "BILLING.SUBSCRIPTION.EXPIRED",
        "BILLING.SUBSCRIPTION.SUSPENDED",
    ]) {
        it(`${eventType} revokes a tier PayPal granted, and clears its markers`, async () => {
            mockGetUserById.mockResolvedValue({
                data: { user: { id: "user-1", app_metadata: paypalSubscriberMetadata() } },
                error: null,
            });

            const res = await POST(webhookRequest(terminalEvent(eventType)));
            expect(res.status).toBe(200);

            const write = mockUpdateUserById.mock.calls[0][1] as {
                app_metadata: Record<string, unknown>;
            };
            expect(write.app_metadata.tier).toBe("free");
            // Markers gone, so a second terminal event cannot reach across
            // to whatever the member buys next.
            expect(write.app_metadata).not.toHaveProperty("paypal_subscription_id");
            expect(write.app_metadata).not.toHaveProperty("paypal_tier");
        });
    }

    it("preserves unrelated app_metadata while revoking", async () => {
        mockGetUserById.mockResolvedValue({
            data: {
                user: {
                    id: "user-1",
                    app_metadata: { ...paypalSubscriberMetadata(), is_suspended: true },
                },
            },
            error: null,
        });
        await POST(webhookRequest(terminalEvent("BILLING.SUBSCRIPTION.CANCELLED")));
        const write = mockUpdateUserById.mock.calls[0][1] as { app_metadata: Record<string, unknown> };
        expect(write.app_metadata.is_suspended).toBe(true);
    });

    // ── The property this whole feature lives or dies on ──
    it("NEVER downgrades a Stripe subscriber whose tier PayPal did not grant", async () => {
        mockGetUserById.mockResolvedValue({
            data: {
                user: {
                    id: "user-1",
                    // Paying by card. No PayPal markers at all.
                    app_metadata: { tier: "pro", stripe_customer_id: "cus_live_1" },
                },
            },
            error: null,
        });

        const res = await POST(webhookRequest(terminalEvent("BILLING.SUBSCRIPTION.CANCELLED")));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("ignores a terminal event for a DIFFERENT PayPal subscription than the one on file", async () => {
        mockGetUserById.mockResolvedValue({
            data: {
                user: {
                    id: "user-1",
                    app_metadata: { tier: "pro", paypal_subscription_id: "I-SUB-NEWER", paypal_tier: "pro" },
                },
            },
            error: null,
        });

        const res = await POST(webhookRequest(terminalEvent("BILLING.SUBSCRIPTION.CANCELLED")));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("ignores a stale event when the tier in force is no longer the one PayPal granted", async () => {
        mockGetUserById.mockResolvedValue({
            data: {
                user: {
                    id: "user-1",
                    // PayPal sold them pro; something has since made them studio.
                    app_metadata: {
                        tier: "studio",
                        paypal_subscription_id: "I-SUB-1",
                        paypal_tier: "pro",
                    },
                },
            },
            error: null,
        });

        const res = await POST(webhookRequest(terminalEvent("BILLING.SUBSCRIPTION.CANCELLED")));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("SUSPENDED then CANCELLED downgrades exactly once", async () => {
        // First: suspended, markers present → revoke.
        mockGetUserById.mockResolvedValue({
            data: { user: { id: "user-1", app_metadata: paypalSubscriberMetadata() } },
            error: null,
        });
        await POST(webhookRequest(terminalEvent("BILLING.SUBSCRIPTION.SUSPENDED")));
        expect(mockUpdateUserById).toHaveBeenCalledTimes(1);

        // Then: PayPal cancels the same dead subscription. The markers are
        // gone, so this is a no-op — even if the member has re-subscribed
        // by card in between.
        mockUpdateUserById.mockClear();
        mockGetUserById.mockResolvedValue({
            data: { user: { id: "user-1", app_metadata: { tier: "pro", stripe_customer_id: "cus_1" } } },
            error: null,
        });
        await POST(webhookRequest(terminalEvent("BILLING.SUBSCRIPTION.CANCELLED")));
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
describe("POST /api/webhooks/paypal — renewals and payment failures", () => {
    it("PAYMENT.SALE.COMPLETED re-affirms the tier via the subscription it names", async () => {
        subscriptionFixtures["I-SUB-1"] = {
            id: "I-SUB-1",
            status: "ACTIVE",
            plan_id: "P-PRO-PLAN",
            custom_id: "user-1",
            billing_info: { next_billing_time: "2026-10-21T10:00:00Z" },
        };

        const res = await POST(
            webhookRequest({
                id: "WH-SALE-1",
                event_type: "PAYMENT.SALE.COMPLETED",
                resource_type: "sale",
                resource: { id: "SALE-1", state: "completed", billing_agreement_id: "I-SUB-1" },
            }),
        );

        expect(res.status).toBe(200);
        const write = mockUpdateUserById.mock.calls[0][1] as { app_metadata: Record<string, unknown> };
        expect(write.app_metadata.tier).toBe("pro");

        const mirror = mockRpc.mock.calls.find((c) => c[0] === "record_paypal_subscription_state");
        expect(mirror![1]).toMatchObject({ p_current_period_end: "2026-10-21T10:00:00Z" });
    });

    it("a sale with no billing agreement (one-off) changes nothing", async () => {
        const res = await POST(
            webhookRequest({
                id: "WH-SALE-2",
                event_type: "PAYMENT.SALE.COMPLETED",
                resource_type: "sale",
                resource: { id: "SALE-2", state: "completed" },
            }),
        );
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("PAYMENT.FAILED does NOT downgrade while PayPal still reports ACTIVE", async () => {
        // One failed attempt is not a cancellation — PayPal retries.
        subscriptionFixtures["I-SUB-1"] = {
            id: "I-SUB-1",
            status: "ACTIVE",
            plan_id: "P-PRO-PLAN",
            custom_id: "user-1",
        };

        const res = await POST(
            webhookRequest({
                id: "WH-FAIL-1",
                event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
                resource: { id: "I-SUB-1", custom_id: "user-1" },
            }),
        );

        expect(res.status).toBe(200);
        const write = mockUpdateUserById.mock.calls[0][1] as { app_metadata: Record<string, unknown> };
        expect(write.app_metadata.tier).toBe("pro");
    });

    it("PAYMENT.FAILED downgrades once PayPal reports the subscription suspended", async () => {
        subscriptionFixtures["I-SUB-1"] = {
            id: "I-SUB-1",
            status: "SUSPENDED",
            plan_id: "P-PRO-PLAN",
            custom_id: "user-1",
        };
        mockGetUserById.mockResolvedValue({
            data: { user: { id: "user-1", app_metadata: paypalSubscriberMetadata() } },
            error: null,
        });

        const res = await POST(
            webhookRequest({
                id: "WH-FAIL-2",
                event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
                resource: { id: "I-SUB-1", custom_id: "user-1" },
            }),
        );

        expect(res.status).toBe(200);
        const write = mockUpdateUserById.mock.calls[0][1] as { app_metadata: Record<string, unknown> };
        expect(write.app_metadata.tier).toBe("free");
    });

    it("returns 500 so PayPal retries when it cannot read the subscription back", async () => {
        // No fixture registered → the API 404s → we must not guess.
        const res = await POST(
            webhookRequest({
                id: "WH-FAIL-3",
                event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
                resource: { id: "I-MISSING", custom_id: "user-1" },
            }),
        );
        expect(res.status).toBe(500);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
describe("POST /api/webhooks/paypal — idempotency", () => {
    it("short-circuits a replay once the event ledger exists", async () => {
        mockRpc.mockImplementation(async (name: string) => {
            if (name === "claim_paypal_webhook_event") return { data: false, error: null };
            return { data: null, error: null };
        });

        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: true, replay: true });
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("a replay without the ledger lands on the same state, never a double grant", async () => {
        // 183 unapplied: the ledger RPC is absent, so both deliveries run
        // the handler in full. The end state must be identical.
        mockRpc.mockResolvedValue({ data: null, error: { code: "42883", message: "does not exist" } });

        await POST(webhookRequest(activatedEvent()));
        const firstWrite = mockUpdateUserById.mock.calls[0][1];

        // Second delivery — same event id, same body.
        mockGetUserById.mockResolvedValue({
            data: { user: { id: "user-1", app_metadata: paypalSubscriberMetadata() } },
            error: null,
        });
        mockUpdateUserById.mockClear();
        await POST(webhookRequest(activatedEvent()));
        const secondWrite = mockUpdateUserById.mock.calls[0][1];

        expect(secondWrite).toEqual(firstWrite);
    });

    it("a replayed cancellation is a no-op the second time", async () => {
        mockRpc.mockResolvedValue({ data: null, error: { code: "42883", message: "does not exist" } });
        mockGetUserById.mockResolvedValue({
            data: { user: { id: "user-1", app_metadata: paypalSubscriberMetadata() } },
            error: null,
        });

        await POST(webhookRequest(terminalEvent("BILLING.SUBSCRIPTION.CANCELLED")));
        expect(mockUpdateUserById).toHaveBeenCalledTimes(1);

        // After the first revoke the markers are gone.
        mockUpdateUserById.mockClear();
        mockGetUserById.mockResolvedValue({
            data: { user: { id: "user-1", app_metadata: { tier: "free" } } },
            error: null,
        });
        await POST(webhookRequest(terminalEvent("BILLING.SUBSCRIPTION.CANCELLED")));
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("processes the event anyway when the ledger itself errors", async () => {
        mockRpc.mockImplementation(async (name: string) => {
            if (name === "claim_paypal_webhook_event") {
                return { data: null, error: { code: "57014", message: "statement timeout" } };
            }
            return { data: null, error: null };
        });
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(200);
        // A broken ledger must never block a genuine activation.
        expect(mockUpdateUserById).toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
describe("POST /api/webhooks/paypal — flag and configuration gates", () => {
    it("is a 404 with the flag off, and never contacts PayPal or the DB", async () => {
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "0");
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(404);
        expect(fetchedPaths).toHaveLength(0);
        expect(mockRpc).not.toHaveBeenCalled();
        expect(mockUpdateUserById).not.toHaveBeenCalled();
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
    });

    it("is a 404 when the flag is unset entirely", async () => {
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "");
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(404);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
    });

    it("is a 404 when credentials are missing even with the flag on", async () => {
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
        const res = await POST(webhookRequest(activatedEvent()));
        expect(res.status).toBe(404);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-client-secret");
    });

    it("acknowledges an event type it has no opinion about, changing nothing", async () => {
        const res = await POST(
            webhookRequest({
                id: "WH-OTHER",
                event_type: "BILLING.SUBSCRIPTION.CREATED",
                resource: { id: "I-SUB-1", custom_id: "user-1" },
            }),
        );
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("rejects a verified-but-unparseable body without retrying forever", async () => {
        const res = await POST(webhookRequest("{not json"));
        expect(res.status).toBe(400);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
});
