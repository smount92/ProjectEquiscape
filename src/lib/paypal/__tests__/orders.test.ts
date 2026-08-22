import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// ── Orders v2 ──
//
// Two things in here are production-breaking rather than edge cases, and
// both get most of the attention:
//
//   1. `payer-action` vs `approve`. Specifying payment_source.paypal —
//      which we must, because experience_context lives there now —
//      changes the approval link's rel. Code that hunts only for
//      `approve` throws on the FIRST real purchase, every time.
//   2. WE have to capture. An approved order has charged nobody. If
//      capture is skipped, the member is never billed and never gets
//      what they clicked to buy — and it looks like success to them.
//
// PayPal is mocked at the `fetch` boundary, so the real token cache and
// the real error parsing execute under test.

vi.stubEnv("PAYPAL_CLIENT_ID", "test-client-id");
vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("PAYPAL_ENV", "sandbox");

import {
    approvalLinkOf,
    captureMatchesPrice,
    captureOrder,
    completedCaptureOf,
    createPrepaidOrder,
    decodePrepaidCustomId,
    encodePrepaidCustomId,
    orderCustomId,
} from "@/lib/paypal/orders";
import { resetPaypalTokenCache } from "@/lib/paypal/client";
import { termByKey } from "@/lib/billing/terms";

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

let createResponse: unknown = null;
let captureResponses: Array<{ body: unknown; status: number }> = [];
let orderFixture: unknown = null;
let requests: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];

const mockFetch = vi.fn(
    async (input: unknown, init?: { body?: string; headers?: Record<string, string> }) => {
        const url = String(input);
        if (url.includes("/v1/oauth2/token")) {
            return jsonResponse({ access_token: "test-access-token", expires_in: 32000 });
        }
        requests.push({
            url,
            body: init?.body ? JSON.parse(init.body) : null,
            headers: init?.headers ?? {},
        });

        if (url.endsWith("/v2/checkout/orders")) {
            return jsonResponse(createResponse);
        }
        if (url.includes("/capture")) {
            const next = captureResponses.shift();
            return jsonResponse(next?.body ?? {}, next?.status ?? 200);
        }
        if (url.includes("/v2/checkout/orders/")) {
            return jsonResponse(orderFixture);
        }
        return jsonResponse({ name: "UNEXPECTED_CALL" }, 500);
    },
);

vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
    vi.clearAllMocks();
    resetPaypalTokenCache();
    createResponse = null;
    captureResponses = [];
    orderFixture = null;
    requests = [];
});

afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════
describe("approvalLinkOf — the payer-action trap", () => {
    // ── The one that would break production ──
    it("finds `payer-action`, which is what payment_source.paypal returns", () => {
        expect(
            approvalLinkOf([
                { rel: "self", href: "https://api.paypal.com/v2/checkout/orders/ORDER-1" },
                { rel: "payer-action", href: "https://paypal.com/checkoutnow?token=ORDER-1" },
            ]),
        ).toBe("https://paypal.com/checkoutnow?token=ORDER-1");
    });

    it("still finds `approve`, the shape without payment_source", () => {
        expect(
            approvalLinkOf([{ rel: "approve", href: "https://paypal.com/approve/ORDER-1" }]),
        ).toBe("https://paypal.com/approve/ORDER-1");
    });

    it("prefers payer-action when PayPal sends both", () => {
        expect(
            approvalLinkOf([
                { rel: "approve", href: "https://paypal.com/approve" },
                { rel: "payer-action", href: "https://paypal.com/payer-action" },
            ]),
        ).toBe("https://paypal.com/payer-action");
    });

    it("is case-insensitive about the rel", () => {
        expect(approvalLinkOf([{ rel: "PAYER-ACTION", href: "https://p/x" }])).toBe("https://p/x");
    });

    it("is null when there is no approval link at all", () => {
        expect(approvalLinkOf([{ rel: "self", href: "https://x" }])).toBeNull();
        expect(approvalLinkOf([])).toBeNull();
        expect(approvalLinkOf(undefined)).toBeNull();
    });
});

// ══════════════════════════════════════════════════════════════
describe("createPrepaidOrder", () => {
    const term = termByKey("pro-6")!;

    it("returns the id and the payer-action URL from a PAYER_ACTION_REQUIRED response", async () => {
        // The exact shape live PayPal returns for our request.
        createResponse = {
            id: "ORDER-1",
            status: "PAYER_ACTION_REQUIRED",
            links: [
                { rel: "self", href: "https://api/v2/checkout/orders/ORDER-1" },
                { rel: "payer-action", href: "https://paypal.com/checkoutnow?token=ORDER-1" },
            ],
        };

        const result = await createPrepaidOrder({
            term,
            userId: "11111111-2222-3333-4444-555555555555",
            returnUrl: "https://modelhorsehub.com/return",
            cancelUrl: "https://modelhorsehub.com/upgrade?status=cancelled",
        });

        expect(result).toEqual({
            id: "ORDER-1",
            approveUrl: "https://paypal.com/checkoutnow?token=ORDER-1",
        });
    });

    it("sends intent CAPTURE, the term's exact price, and the buyer in custom_id", async () => {
        createResponse = {
            id: "ORDER-1",
            links: [{ rel: "payer-action", href: "https://p/x" }],
        };

        await createPrepaidOrder({
            term,
            userId: "user-uuid",
            returnUrl: "https://modelhorsehub.com/return",
            cancelUrl: "https://modelhorsehub.com/cancel",
        });

        const body = requests[0].body as {
            intent: string;
            purchase_units: Array<{
                custom_id: string;
                reference_id: string;
                amount: { value: string; currency_code: string };
            }>;
            payment_source: { paypal: { experience_context: Record<string, string> } };
        };

        expect(body.intent).toBe("CAPTURE");
        expect(body.purchase_units[0].amount).toEqual({ currency_code: "USD", value: "27.00" });
        expect(body.purchase_units[0].custom_id).toBe("user-uuid|pro-6");
        expect(body.purchase_units[0].reference_id).toBe("pro-6");

        // experience_context, NOT the deprecated application_context.
        expect(body.payment_source.paypal.experience_context.return_url).toBe(
            "https://modelhorsehub.com/return",
        );
        expect(body.payment_source.paypal.experience_context.user_action).toBe("PAY_NOW");
        expect(body).not.toHaveProperty("application_context");

        // Idempotency for the create itself.
        expect(requests[0].headers["PayPal-Request-Id"]).toContain("mhh-order-user-uuid-pro-6");
    });

    it("throws rather than guessing when PayPal returns no approval link", async () => {
        createResponse = { id: "ORDER-1", status: "CREATED", links: [{ rel: "self", href: "x" }] };
        await expect(
            createPrepaidOrder({
                term,
                userId: "u",
                returnUrl: "https://r",
                cancelUrl: "https://c",
            }),
        ).rejects.toThrow(/approval link/i);
    });
});

// ══════════════════════════════════════════════════════════════
describe("captureOrder — taking the money, exactly once", () => {
    it("captures and returns the COMPLETED capture", async () => {
        captureResponses = [
            {
                status: 201,
                body: {
                    id: "ORDER-1",
                    status: "COMPLETED",
                    purchase_units: [
                        {
                            payments: {
                                captures: [
                                    { id: "CAP-1", status: "COMPLETED", amount: { value: "27.00" } },
                                ],
                            },
                        },
                    ],
                },
            },
        ];

        const capture = await captureOrder("ORDER-1");
        expect(capture?.id).toBe("CAP-1");
    });

    it("uses a request id derived from the order alone, so both paths send the same one", async () => {
        captureResponses = [
            {
                status: 201,
                body: {
                    purchase_units: [
                        { payments: { captures: [{ id: "CAP-1", status: "COMPLETED" }] } },
                    ],
                },
            },
        ];
        await captureOrder("ORDER-77");
        expect(requests[0].headers["PayPal-Request-Id"]).toBe("mhh-capture-ORDER-77");
    });

    // ── The return leg and the webhook racing each other ──
    it("reads back the existing capture when PayPal says ORDER_ALREADY_CAPTURED", async () => {
        captureResponses = [
            {
                status: 422,
                body: {
                    name: "UNPROCESSABLE_ENTITY",
                    debug_id: "abc123",
                    details: [{ issue: "ORDER_ALREADY_CAPTURED" }],
                },
            },
        ];
        orderFixture = {
            id: "ORDER-1",
            status: "COMPLETED",
            purchase_units: [
                { payments: { captures: [{ id: "CAP-EXISTING", status: "COMPLETED" }] } },
            ],
        };

        const capture = await captureOrder("ORDER-1");
        // The FIRST path's capture, not a second charge.
        expect(capture?.id).toBe("CAP-EXISTING");
    });

    it("rethrows a genuine 422 that is not an already-captured", async () => {
        captureResponses = [
            {
                status: 422,
                body: {
                    name: "UNPROCESSABLE_ENTITY",
                    details: [{ issue: "INSTRUMENT_DECLINED" }],
                },
            },
        ];
        await expect(captureOrder("ORDER-1")).rejects.toThrow();
    });

    it("returns null — granting nothing — when the capture is unreadable", async () => {
        captureResponses = [{ status: 201, body: { id: "ORDER-1", status: "COMPLETED" } }];
        expect(await captureOrder("ORDER-1")).toBeNull();
    });
});

// ══════════════════════════════════════════════════════════════
describe("custom_id — who bought what", () => {
    it("round-trips a user id and a term key", () => {
        const encoded = encodePrepaidCustomId("abc-123", "studio-12");
        expect(encoded).toBe("abc-123|studio-12");
        expect(decodePrepaidCustomId(encoded)).toEqual({ userId: "abc-123", termKey: "studio-12" });
    });

    it("reads a bare user id as a user id with no term", () => {
        expect(decodePrepaidCustomId("abc-123")).toEqual({ userId: "abc-123", termKey: null });
    });

    it("is null for nothing at all", () => {
        expect(decodePrepaidCustomId(undefined)).toBeNull();
        expect(decodePrepaidCustomId("")).toBeNull();
        expect(decodePrepaidCustomId("   ")).toBeNull();
        expect(decodePrepaidCustomId(42)).toBeNull();
        expect(decodePrepaidCustomId("|pro-3")).toBeNull();
    });

    it("falls back to reference_id when custom_id carries only the id", () => {
        expect(
            orderCustomId({
                purchase_units: [{ custom_id: "abc-123", reference_id: "pro-12" }],
            }),
        ).toEqual({ userId: "abc-123", termKey: "pro-12" });
    });

    it("prefers the term in custom_id over reference_id", () => {
        expect(
            orderCustomId({
                purchase_units: [{ custom_id: "abc-123|pro-3", reference_id: "pro-12" }],
            }),
        ).toEqual({ userId: "abc-123", termKey: "pro-3" });
    });
});

// ══════════════════════════════════════════════════════════════
describe("captureMatchesPrice — the last gate before a grant", () => {
    it("accepts the exact price", () => {
        expect(
            captureMatchesPrice({ amount: { value: "27.00", currency_code: "USD" } }, "27.00", "USD"),
        ).toBe(true);
    });

    it("accepts a differently formatted but equal amount", () => {
        expect(
            captureMatchesPrice({ amount: { value: "27.0", currency_code: "usd" } }, "27.00", "USD"),
        ).toBe(true);
    });

    it("REFUSES a short payment", () => {
        expect(
            captureMatchesPrice({ amount: { value: "1.00", currency_code: "USD" } }, "27.00", "USD"),
        ).toBe(false);
    });

    it("REFUSES a different currency", () => {
        expect(
            captureMatchesPrice({ amount: { value: "27.00", currency_code: "CAD" } }, "27.00", "USD"),
        ).toBe(false);
    });

    it("REFUSES an amount it cannot read", () => {
        expect(captureMatchesPrice({}, "27.00", "USD")).toBe(false);
        expect(captureMatchesPrice(null, "27.00", "USD")).toBe(false);
        expect(
            captureMatchesPrice({ amount: { value: "lots", currency_code: "USD" } }, "27.00", "USD"),
        ).toBe(false);
    });
});

describe("completedCaptureOf", () => {
    it("prefers a COMPLETED capture", () => {
        expect(
            completedCaptureOf({
                purchase_units: [
                    {
                        payments: {
                            captures: [
                                { id: "CAP-PENDING", status: "PENDING" },
                                { id: "CAP-DONE", status: "COMPLETED" },
                            ],
                        },
                    },
                ],
            })?.id,
        ).toBe("CAP-DONE");
    });

    it("is null when there are no captures", () => {
        expect(completedCaptureOf({ purchase_units: [{}] })).toBeNull();
        expect(completedCaptureOf(null)).toBeNull();
    });
});
