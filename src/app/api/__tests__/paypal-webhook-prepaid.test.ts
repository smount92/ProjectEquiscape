import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";

// ── The prepaid / fixed-term half of the PayPal webhook ──
//
// Weighted toward the things that would cost real money on a live site:
//
//   1. A CAPTURE IS NOT A SUBSCRIPTION. subscriptionIdOf() returns
//      billing_agreement_id, which is null for a capture — so a capture
//      routed through the subscription handlers would be silently
//      ignored with the member's money already taken. These events need
//      their own branch, and this file proves they have one.
//   2. APPROVAL IS NOT PAYMENT. CHECKOUT.ORDER.APPROVED must make us
//      capture; without that, the member who closes the tab is never
//      charged and never gets the term they clicked to buy.
//   3. BILLING.SUBSCRIPTION.EXPIRED CAN ARRIVE BESIDE THE FINAL CHARGE
//      of a fixed-term plan. It must not take back the month that
//      charge just bought.
//   4. A refund ends the term. A refund of somebody else's payment does
//      not.
//
// PayPal is mocked at the `fetch` boundary so the real signature
// verification, token cache and error parsing all execute.

vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
vi.stubEnv("NEXT_PUBLIC_PREPAID_TERMS", "1");
vi.stubEnv("PAYPAL_CLIENT_ID", "test-client-id");
vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-CONFIGURED-ID");
vi.stubEnv("PAYPAL_ENV", "sandbox");
vi.stubEnv("PAYPAL_PRO_PLAN_ID", "P-PRO-PLAN");
vi.stubEnv("PAYPAL_STUDIO_PLAN_ID", "P-STUDIO-PLAN");
vi.stubEnv("PAYPAL_PRO_6MO_PLAN_ID", "P-PRO-6MO");

const mockRpc = vi.fn();
const mockGetUserById = vi.fn();
const mockUpdateUserById = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({
        from: vi.fn(),
        rpc: mockRpc,
        auth: { admin: { getUserById: mockGetUserById, updateUserById: mockUpdateUserById } },
    })),
}));

vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/webhooks/paypal/route";
import { resetPaypalTokenCache } from "@/lib/paypal/client";

// ── PayPal HTTP mock ──
let orderFixtures: Record<string, unknown> = {};
let captureFixtures: Record<string, unknown> = {};
let subscriptionFixtures: Record<string, unknown> = {};
let captureCalls: string[] = [];
let captureResult: { body: unknown; status: number } | null = null;

function jsonResponse(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const defaultFetch = async (input: unknown) => {
    const url = String(input);
    if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok", expires_in: 32000 });
    }
    if (url.includes("/v1/notifications/verify-webhook-signature")) {
        return jsonResponse({ verification_status: "SUCCESS" });
    }
    const capturing = url.match(/\/v2\/checkout\/orders\/([^/?]+)\/capture$/);
    if (capturing) {
        captureCalls.push(decodeURIComponent(capturing[1]));
        return jsonResponse(captureResult?.body ?? {}, captureResult?.status ?? 201);
    }
    const order = url.match(/\/v2\/checkout\/orders\/([^/?]+)$/);
    if (order) {
        const fixture = orderFixtures[decodeURIComponent(order[1])];
        return fixture ? jsonResponse(fixture) : jsonResponse({ name: "RESOURCE_NOT_FOUND" }, 404);
    }
    const capture = url.match(/\/v2\/payments\/captures\/([^/?]+)$/);
    if (capture) {
        const fixture = captureFixtures[decodeURIComponent(capture[1])];
        return fixture ? jsonResponse(fixture) : jsonResponse({ name: "RESOURCE_NOT_FOUND" }, 404);
    }
    const subscription = url.match(/\/v1\/billing\/subscriptions\/([^/?]+)$/);
    if (subscription) {
        const fixture = subscriptionFixtures[decodeURIComponent(subscription[1])];
        return fixture ? jsonResponse(fixture) : jsonResponse({ name: "RESOURCE_NOT_FOUND" }, 404);
    }
    return jsonResponse({ name: "UNEXPECTED_CALL" }, 500);
};

const mockFetch = vi.fn(defaultFetch);
vi.stubGlobal("fetch", mockFetch);

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
        body: JSON.stringify(body),
        headers: headers ?? {},
    });
}

function userWith(app_metadata: Record<string, unknown>) {
    mockGetUserById.mockResolvedValue({
        data: { user: { id: "user-1", app_metadata } },
        error: null,
    });
}

function written(): Record<string, unknown> {
    return (mockUpdateUserById.mock.calls[0][1] as { app_metadata: Record<string, unknown> })
        .app_metadata;
}

/** A PAYMENT.CAPTURE.COMPLETED for a $27 six-month Pro term. */
function captureEvent(overrides: Record<string, unknown> = {}) {
    return {
        id: "WH-CAP-1",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource_type: "capture",
        resource: {
            id: "CAP-1",
            status: "COMPLETED",
            custom_id: "user-1|pro-6",
            amount: { currency_code: "USD", value: "27.00" },
            supplementary_data: { related_ids: { order_id: "ORDER-1" } },
            ...((overrides.resource as Record<string, unknown>) ?? {}),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(defaultFetch);
    resetPaypalTokenCache();
    orderFixtures = {};
    captureFixtures = {};
    subscriptionFixtures = {};
    captureCalls = [];
    captureResult = null;
    mockRpc.mockResolvedValue({ data: true, error: null });
    userWith({});
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
});

afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════
describe("PAYMENT.CAPTURE.COMPLETED — a capture is not a subscription", () => {
    // ── The dispatch trap ──
    it("grants the term, rather than being ignored as a sale with no agreement", async () => {
        const res = await POST(webhookRequest(captureEvent()));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).toHaveBeenCalledTimes(1);
        expect(written().tier).toBe("pro");
        expect(written().paypal_prepaid_captures).toEqual(["CAP-1"]);
        expect(typeof written().paid_through).toBe("string");
    });

    it("sets a clock roughly six months out for a six-month term", async () => {
        await POST(webhookRequest(captureEvent()));
        const paidThrough = Date.parse(written().paid_through as string);
        const months = (paidThrough - Date.now()) / (30.44 * 24 * 3600 * 1000);
        expect(months).toBeGreaterThan(5.8);
        expect(months).toBeLessThan(6.2);
    });

    it("grants Studio for a studio term — never the cheaper tier", async () => {
        const event = captureEvent();
        event.resource.custom_id = "user-1|studio-12";
        event.resource.amount = { currency_code: "USD", value: "100.00" };
        await POST(webhookRequest(event));
        expect(written().tier).toBe("studio");
    });

    // ── Fail closed ──
    it("grants NOTHING when the amount does not match the term", async () => {
        const event = captureEvent();
        event.resource.amount = { currency_code: "USD", value: "1.00" };
        const res = await POST(webhookRequest(event));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("grants NOTHING for a currency we do not sell in", async () => {
        const event = captureEvent();
        event.resource.amount = { currency_code: "CAD", value: "27.00" };
        await POST(webhookRequest(event));
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("grants NOTHING for a term that is not in the config file", async () => {
        const event = captureEvent();
        event.resource.custom_id = "user-1|pro-99";
        await POST(webhookRequest(event));
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("grants NOTHING when there is no custom_id and no order to ask", async () => {
        const event = captureEvent();
        delete (event.resource as Record<string, unknown>).custom_id;
        delete (event.resource as Record<string, unknown>).supplementary_data;
        await POST(webhookRequest(event));
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("falls back to the ORDER when a capture carries only a bare user id", async () => {
        orderFixtures["ORDER-1"] = {
            id: "ORDER-1",
            purchase_units: [{ custom_id: "user-1", reference_id: "pro-6" }],
        };
        const event = captureEvent();
        event.resource.custom_id = "user-1";
        await POST(webhookRequest(event));
        expect(written().tier).toBe("pro");
    });

    it("ignores an unrelated capture that is not one of ours", async () => {
        const event = captureEvent();
        event.resource.custom_id = "some-other-system-reference";
        delete (event.resource as Record<string, unknown>).supplementary_data;
        const res = await POST(webhookRequest(event));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    // ── Idempotency at the route level ──
    it("a redelivered capture does not buy the months twice", async () => {
        // 183's ledger absent, so the handler runs in full both times.
        mockRpc.mockResolvedValue({ data: null, error: { code: "42883", message: "no" } });

        await POST(webhookRequest(captureEvent()));
        const first = written();
        expect(first.paypal_prepaid_captures).toEqual(["CAP-1"]);

        mockUpdateUserById.mockClear();
        userWith({
            tier: "pro",
            paid_through: first.paid_through,
            paypal_prepaid_captures: ["CAP-1"],
            paypal_prepaid_tier: "pro",
        });
        const res = await POST(webhookRequest(captureEvent()));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("returns 500 so PayPal retries when the write fails", async () => {
        mockUpdateUserById.mockResolvedValue({ data: null, error: { message: "auth down" } });
        const res = await POST(webhookRequest(captureEvent()));
        expect(res.status).toBe(500);
    });

    it("does not retry forever for a member who no longer exists", async () => {
        mockGetUserById.mockResolvedValue({ data: { user: null }, error: null });
        const res = await POST(webhookRequest(captureEvent()));
        expect(res.status).toBe(200);
    });
});

// ══════════════════════════════════════════════════════════════
describe("CHECKOUT.ORDER.APPROVED — approval is not payment", () => {
    const approvedEvent = {
        id: "WH-ORDER-1",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource_type: "checkout-order",
        resource: {
            id: "ORDER-1",
            status: "APPROVED",
            purchase_units: [{ custom_id: "user-1|pro-6", reference_id: "pro-6" }],
        },
    };

    // ── The backstop for the member who closed the tab ──
    it("CAPTURES the order itself, then grants", async () => {
        captureResult = {
            status: 201,
            body: {
                id: "ORDER-1",
                status: "COMPLETED",
                purchase_units: [
                    {
                        payments: {
                            captures: [
                                {
                                    id: "CAP-BACKSTOP",
                                    status: "COMPLETED",
                                    custom_id: "user-1|pro-6",
                                    amount: { currency_code: "USD", value: "27.00" },
                                },
                            ],
                        },
                    },
                ],
            },
        };

        const res = await POST(webhookRequest(approvedEvent));
        expect(res.status).toBe(200);
        expect(captureCalls).toEqual(["ORDER-1"]);
        expect(written().tier).toBe("pro");
        expect(written().paypal_prepaid_captures).toEqual(["CAP-BACKSTOP"]);
    });

    it("does not capture an order that is not ours", async () => {
        orderFixtures["ORDER-X"] = { id: "ORDER-X", purchase_units: [{}] };
        const res = await POST(
            webhookRequest({
                id: "WH-ORDER-X",
                event_type: "CHECKOUT.ORDER.APPROVED",
                resource: { id: "ORDER-X", purchase_units: [{}] },
            }),
        );
        expect(res.status).toBe(200);
        expect(captureCalls).toHaveLength(0);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("returns 500 so PayPal retries when the capture cannot be resolved", async () => {
        // Capture returns a body with no readable capture at all.
        captureResult = { status: 201, body: { id: "ORDER-1", status: "COMPLETED" } };
        const res = await POST(webhookRequest(approvedEvent));
        expect(res.status).toBe(500);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    // ── The return leg beat us to it ──
    it("reads back the existing capture when the order is already captured", async () => {
        captureResult = {
            status: 422,
            body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] },
        };
        orderFixtures["ORDER-1"] = {
            id: "ORDER-1",
            status: "COMPLETED",
            purchase_units: [
                {
                    custom_id: "user-1|pro-6",
                    payments: {
                        captures: [
                            {
                                id: "CAP-FROM-RETURN",
                                status: "COMPLETED",
                                custom_id: "user-1|pro-6",
                                amount: { currency_code: "USD", value: "27.00" },
                            },
                        ],
                    },
                },
            ],
        };

        // The return leg already applied it, so this is a no-op.
        userWith({
            tier: "pro",
            paid_through: "2099-01-01T00:00:00.000Z",
            paypal_prepaid_captures: ["CAP-FROM-RETURN"],
            paypal_prepaid_tier: "pro",
        });

        const res = await POST(webhookRequest(approvedEvent));
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
describe("refunds, reversals and denials end the term", () => {
    const termHolder = {
        tier: "pro",
        paid_through: "2099-01-01T00:00:00.000Z",
        paypal_prepaid_captures: ["CAP-1"],
        paypal_prepaid_tier: "pro",
        paypal_prepaid_order_id: "ORDER-1",
    };

    it("PAYMENT.CAPTURE.REFUNDED ends the term even though it is paid into the future", async () => {
        userWith(termHolder);
        const res = await POST(
            webhookRequest({
                id: "WH-REFUND-1",
                event_type: "PAYMENT.CAPTURE.REFUNDED",
                resource_type: "refund",
                resource: {
                    // NOTE: the resource id is the REFUND, not the capture.
                    id: "REFUND-9",
                    status: "COMPLETED",
                    custom_id: "user-1|pro-6",
                    supplementary_data: { related_ids: { capture_id: "CAP-1" } },
                },
            }),
        );

        expect(res.status).toBe(200);
        expect(written().tier).toBe("free");
        expect(written()).not.toHaveProperty("paid_through");
    });

    it("finds the capture through the refund's `up` link when related_ids is absent", async () => {
        userWith(termHolder);
        await POST(
            webhookRequest({
                id: "WH-REFUND-2",
                event_type: "PAYMENT.CAPTURE.REFUNDED",
                resource: {
                    id: "REFUND-9",
                    custom_id: "user-1|pro-6",
                    links: [
                        { rel: "self", href: "https://api.paypal.com/v2/payments/refunds/REFUND-9" },
                        { rel: "up", href: "https://api.paypal.com/v2/payments/captures/CAP-1" },
                    ],
                },
            }),
        );
        expect(written().tier).toBe("free");
    });

    it("asks PayPal for the capture when the refund carries no custom_id", async () => {
        userWith(termHolder);
        captureFixtures["CAP-1"] = { id: "CAP-1", custom_id: "user-1|pro-6" };
        await POST(
            webhookRequest({
                id: "WH-REFUND-3",
                event_type: "PAYMENT.CAPTURE.REFUNDED",
                resource: {
                    id: "REFUND-9",
                    supplementary_data: { related_ids: { capture_id: "CAP-1" } },
                },
            }),
        );
        expect(written().tier).toBe("free");
    });

    it.each(["PAYMENT.CAPTURE.REVERSED", "PAYMENT.CAPTURE.DENIED"])(
        "%s uses the resource id, which IS the capture",
        async (eventType) => {
            userWith(termHolder);
            await POST(
                webhookRequest({
                    id: `WH-${eventType}`,
                    event_type: eventType,
                    resource: { id: "CAP-1", status: "REVERSED", custom_id: "user-1|pro-6" },
                }),
            );
            expect(written().tier).toBe("free");
        },
    );

    it("changes NOTHING when the refunded capture never bought a term here", async () => {
        userWith(termHolder);
        const res = await POST(
            webhookRequest({
                id: "WH-REFUND-4",
                event_type: "PAYMENT.CAPTURE.REFUNDED",
                resource: {
                    id: "REFUND-9",
                    custom_id: "user-1|pro-6",
                    supplementary_data: { related_ids: { capture_id: "CAP-SOMEONE-ELSE" } },
                },
            }),
        );
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("changes NOTHING when the refund cannot be traced to a capture at all", async () => {
        userWith(termHolder);
        const res = await POST(
            webhookRequest({
                id: "WH-REFUND-5",
                event_type: "PAYMENT.CAPTURE.REFUNDED",
                resource: { id: "REFUND-9", custom_id: "user-1|pro-6", links: [] },
            }),
        );
        expect(res.status).toBe(200);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
describe("fixed-term subscriptions — the EXPIRED-on-final-charge trap", () => {
    it("ACTIVATED on a fixed-term plan sets a clock; the open-ended plans do not", async () => {
        await POST(
            webhookRequest({
                id: "WH-ACT-FIXED",
                event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
                resource: {
                    id: "I-FIXED-1",
                    status: "ACTIVE",
                    plan_id: "P-PRO-6MO",
                    custom_id: "user-1",
                    billing_info: { next_billing_time: "2099-02-01T00:00:00Z" },
                },
            }),
        );
        expect(written().tier).toBe("pro");
        expect(typeof written().paid_through).toBe("string");

        mockUpdateUserById.mockClear();
        await POST(
            webhookRequest({
                id: "WH-ACT-OPEN",
                event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
                resource: {
                    id: "I-OPEN-1",
                    status: "ACTIVE",
                    plan_id: "P-PRO-PLAN",
                    custom_id: "user-1",
                    billing_info: { next_billing_time: "2099-02-01T00:00:00Z" },
                },
            }),
        );
        expect(written()).not.toHaveProperty("paid_through");
    });

    it("the FINAL charge still buys a month, even with no next_billing_time", async () => {
        await POST(
            webhookRequest({
                id: "WH-ACT-FINAL",
                event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
                resource: {
                    id: "I-FIXED-1",
                    status: "ACTIVE",
                    plan_id: "P-PRO-6MO",
                    custom_id: "user-1",
                    // PayPal sends no next billing on the last cycle.
                    billing_info: {},
                },
            }),
        );
        const paidThrough = Date.parse(written().paid_through as string);
        expect(paidThrough).toBeGreaterThan(Date.now() + 27 * 24 * 3600 * 1000);
    });

    // ── THE TRAP, end to end ──
    it("EXPIRED arriving right after the final charge does NOT drop the member", async () => {
        // The member's clock was set by that final charge.
        userWith({
            tier: "pro",
            paid_through: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            paypal_subscription_id: "I-FIXED-1",
            paypal_tier: "pro",
        });

        const res = await POST(
            webhookRequest({
                id: "WH-EXPIRED-1",
                event_type: "BILLING.SUBSCRIPTION.EXPIRED",
                resource: {
                    id: "I-FIXED-1",
                    status: "EXPIRED",
                    plan_id: "P-PRO-6MO",
                    custom_id: "user-1",
                },
            }),
        );

        expect(res.status).toBe(200);
        // Not downgraded. They paid for this month.
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("and once that month is up, the member reads free WITHOUT any further event", async () => {
        // Nothing revoked the tier — read-time expiry is the mechanism,
        // and it needs no webhook, no cron and no migration.
        const { entitledTier } = await import("@/lib/entitlement/clock");
        expect(
            entitledTier({
                tier: "pro",
                paid_through: new Date(Date.now() - 1000).toISOString(),
                paypal_subscription_id: "I-FIXED-1",
            }),
        ).toBe("free");
    });

    it("a renewal on a fixed-term plan pushes the clock forward", async () => {
        subscriptionFixtures["I-FIXED-1"] = {
            id: "I-FIXED-1",
            status: "ACTIVE",
            plan_id: "P-PRO-6MO",
            custom_id: "user-1",
            billing_info: { next_billing_time: "2099-03-01T00:00:00Z" },
        };
        await POST(
            webhookRequest({
                id: "WH-SALE-FIXED",
                event_type: "PAYMENT.SALE.COMPLETED",
                resource: { id: "SALE-1", billing_agreement_id: "I-FIXED-1" },
            }),
        );
        expect(Date.parse(written().paid_through as string)).toBeGreaterThan(
            Date.parse("2099-03-01T00:00:00Z"),
        );
    });

    it("EXPIRED still downgrades once the clock has genuinely run out", async () => {
        userWith({
            tier: "pro",
            paid_through: new Date(Date.now() - 1000).toISOString(),
            paypal_subscription_id: "I-FIXED-1",
            paypal_tier: "pro",
        });
        await POST(
            webhookRequest({
                id: "WH-EXPIRED-2",
                event_type: "BILLING.SUBSCRIPTION.EXPIRED",
                resource: { id: "I-FIXED-1", status: "EXPIRED", custom_id: "user-1" },
            }),
        );
        expect(written().tier).toBe("free");
    });
});

// ══════════════════════════════════════════════════════════════
describe("signature verification covers the new events too", () => {
    it.each([
        "CHECKOUT.ORDER.APPROVED",
        "PAYMENT.CAPTURE.COMPLETED",
        "PAYMENT.CAPTURE.REFUNDED",
    ])("%s is rejected unsigned, and captures nothing", async (eventType) => {
        const res = await POST(
            webhookRequest(
                { id: "WH-FORGED", event_type: eventType, resource: { id: "ORDER-1", custom_id: "user-1|pro-6" } },
                null,
            ),
        );
        expect(res.status).toBe(400);
        expect(captureCalls).toHaveLength(0);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("a FAILURE verdict grants nothing for a capture", async () => {
        mockFetch.mockImplementation(async (input: unknown) => {
            const url = String(input);
            if (url.includes("/v1/oauth2/token")) {
                return jsonResponse({ access_token: "tok", expires_in: 3000 });
            }
            if (url.includes("verify-webhook-signature")) {
                return jsonResponse({ verification_status: "FAILURE" });
            }
            return jsonResponse({}, 500);
        });
        const res = await POST(webhookRequest(captureEvent()));
        expect(res.status).toBe(400);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
});
