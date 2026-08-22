/**
 * PayPal Orders v2 — a single charge that buys a fixed run of access.
 *
 * The subscription API creates an agreement and then bills against it
 * forever. This one does not: there is no agreement, no stored
 * authorization, and nothing for the member to remember to cancel. That
 * is the entire point. It is what the customer who prompted this feature
 * actually asked for.
 *
 * ── THE THING THAT WILL BITE YOU: WE HAVE TO CAPTURE ──────────────
 *
 * A subscription charges itself. An order does NOT. `intent: "CAPTURE"`
 * is a statement of what we intend, not an instruction PayPal carries
 * out — the payer approving the order moves no money at all. If the
 * member approves and closes the tab and we never call capture, they are
 * simply never charged, and if we granted a tier on approval we have
 * given a membership away.
 *
 * So there are two capture paths and both are load-bearing:
 *   · the return leg, which captures while the member is watching;
 *   · CHECKOUT.ORDER.APPROVED on the webhook, which captures for the
 *     member who wandered off.
 * Whichever gets there first wins; the second finds ORDER_ALREADY_CAPTURED
 * and reads back the capture the first one made.
 *
 * ── THE SECOND THING: `payer-action`, NOT `approve` ───────────────
 *
 * Specifying `payment_source.paypal` on create — which we do, because it
 * is where experience_context now lives — changes the response. The order
 * comes back PAYER_ACTION_REQUIRED instead of CREATED, and the link to
 * send the member to has rel `payer-action` instead of `approve`. Code
 * that hunts only for `approve` (as subscriptions.ts legitimately does,
 * on a different API) throws here, in production, on the first real
 * purchase. `approvalLinkOf` accepts either.
 *
 * `application_context` is deprecated in Orders v2 in favour of
 * `payment_source.paypal.experience_context`; the old field still works
 * today and is deliberately not sent, so there is one source of truth for
 * the return URL rather than two that can drift.
 */

import { paypalFetch, PaypalApiError } from "./client";
import { logger } from "@/lib/logger";
import { TERM_CURRENCY, type MembershipTerm } from "@/lib/billing/terms";
import type { PaypalCapture, PaypalLink, PaypalOrder } from "./types";

/**
 * The approval URL out of an Orders v2 response.
 *
 * BOTH rels, deliberately. See this file's header — which one PayPal
 * sends depends on whether payment_source was specified, and being wrong
 * about it is a 100%-reproducible production failure rather than an edge
 * case. `payer-action` is preferred when both are present because it is
 * the one that matches the payment_source flow we asked for.
 */
export function approvalLinkOf(links: PaypalLink[] | undefined | null): string | null {
    const list = links ?? [];
    const byRel = (rel: string) =>
        list.find((link) => link?.rel?.toLowerCase() === rel)?.href ?? null;
    return byRel("payer-action") ?? byRel("approve") ?? null;
}

// ── custom_id: who bought what ─────────────────────────────────────
//
// The subscription path only has to carry a user id, because the plan id
// travels on every subscription event and says what was bought. Orders
// have no equivalent: a PAYMENT.CAPTURE.COMPLETED carries a user id and
// an amount, and nothing at all about which TERM the amount was for.
// Deriving the term from the price would mean two terms at the same price
// becoming indistinguishable, which is a pricing decision away from being
// a bug that hands out the longer one.
//
// So both ride in custom_id, which PayPal copies from the purchase unit
// down onto the capture. "|" is the separator because it appears in
// neither a UUID nor a term key. PayPal allows 127 characters; a UUID
// plus the longest term key is 46.
//
// The order is still fetched as a fallback when a capture arrives with a
// bare user id — an order created before this encoding existed, or one
// PayPal has truncated.

const CUSTOM_ID_SEPARATOR = "|";

export function encodePrepaidCustomId(userId: string, termKey: string): string {
    return `${userId}${CUSTOM_ID_SEPARATOR}${termKey}`;
}

/** Split a custom_id back up. `termKey` is null for the bare-id shape. */
export function decodePrepaidCustomId(
    value: unknown,
): { userId: string; termKey: string | null } | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const index = trimmed.indexOf(CUSTOM_ID_SEPARATOR);
    if (index === -1) return { userId: trimmed, termKey: null };
    const userId = trimmed.slice(0, index).trim();
    const termKey = trimmed.slice(index + 1).trim();
    if (!userId) return null;
    return { userId, termKey: termKey || null };
}

/** The buyer and term an order carries, or null if it carries neither. */
export function orderCustomId(
    order: PaypalOrder | null | undefined,
): { userId: string; termKey: string | null } | null {
    const unit = order?.purchase_units?.[0];
    const decoded = decodePrepaidCustomId(unit?.custom_id);
    if (!decoded) return null;
    // reference_id is set to the term key on create, so it is a free
    // second opinion when custom_id carries only the id.
    if (!decoded.termKey && typeof unit?.reference_id === "string" && unit.reference_id.trim()) {
        return { userId: decoded.userId, termKey: unit.reference_id.trim() };
    }
    return decoded;
}

/**
 * Is this capture for the amount the term actually costs?
 *
 * The last fail-closed check before a term is granted. An order is
 * created server-side with a price from config, so a mismatch is not
 * something a member can arrange — but it IS what a stale order, an
 * edited price or a partial capture looks like, and none of those should
 * quietly buy twelve months. Compared in whole cents so "50.0" and
 * "50.00" agree.
 */
export function captureMatchesPrice(
    capture: PaypalCapture | null | undefined,
    expectedValue: string,
    expectedCurrency: string,
): boolean {
    const amount = capture?.amount;
    if (!amount?.value || !amount?.currency_code) return false;
    if (amount.currency_code.toUpperCase() !== expectedCurrency.toUpperCase()) return false;
    const paid = Number(amount.value);
    const expected = Number(expectedValue);
    if (!Number.isFinite(paid) || !Number.isFinite(expected)) return false;
    return Math.round(paid * 100) === Math.round(expected * 100);
}

/** The completed capture on an order, if it has one. */
export function completedCaptureOf(order: PaypalOrder | null | undefined): PaypalCapture | null {
    const captures = order?.purchase_units?.[0]?.payments?.captures ?? [];
    return captures.find((c) => c?.status?.toUpperCase() === "COMPLETED") ?? captures[0] ?? null;
}

export interface CreatePrepaidOrderArgs {
    term: MembershipTerm;
    /** Supabase user id — rides along as purchase_units[0].custom_id. */
    userId: string;
    returnUrl: string;
    cancelUrl: string;
}

/**
 * Create an order for one prepaid term and hand back where to send the
 * member. Creating charges nothing; see the header.
 *
 * `custom_id` is set on the purchase unit because that is where Orders v2
 * keeps it, and PayPal copies it down onto the capture — so the webhook
 * can map a capture back to a member without a round trip. It is the only
 * mapping there is; without it we grant nothing.
 */
export async function createPrepaidOrder(
    args: CreatePrepaidOrderArgs,
): Promise<{ id: string; approveUrl: string }> {
    const { term, userId } = args;

    const body = {
        intent: "CAPTURE",
        purchase_units: [
            {
                reference_id: term.key,
                custom_id: encodePrepaidCustomId(userId, term.key),
                description: `Model Horse Hub ${term.tier === "studio" ? "Studio Pro" : "Pro"} — ${term.label}`,
                amount: { currency_code: TERM_CURRENCY, value: term.prepaidPrice },
            },
        ],
        payment_source: {
            paypal: {
                experience_context: {
                    brand_name: "Model Horse Hub",
                    landing_page: "LOGIN",
                    shipping_preference: "NO_SHIPPING",
                    // "Pay Now" rather than "Continue": there is no cart
                    // and no second step, so the member should be told
                    // the button they are pressing completes the payment.
                    user_action: "PAY_NOW",
                    return_url: args.returnUrl,
                    cancel_url: args.cancelUrl,
                },
            },
        },
    };

    const created = await paypalFetch<PaypalOrder>("/v2/checkout/orders", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            // PayPal-side idempotency for the create itself, so a retry
            // inside PayPal's edge cannot mint two orders for one click.
            "PayPal-Request-Id": `mhh-order-${userId}-${term.key}-${Date.now()}`,
            Prefer: "return=representation",
        },
    });

    const id = created?.id;
    const approveUrl = approvalLinkOf(created?.links);

    if (!id || !approveUrl) {
        // Loud, because this is the failure the `payer-action` trap
        // produces and it would otherwise look like a generic outage.
        logger.error("PayPalOrders", "Create returned no id or no approval link", {
            status: created?.status ?? null,
            rels: (created?.links ?? []).map((l) => l?.rel ?? "?").join(","),
        });
        throw new Error("PayPal did not return an order id and approval link");
    }

    return { id, approveUrl };
}

/** Read an order back. The authoritative answer about its status. */
export async function getOrder(orderId: string): Promise<PaypalOrder> {
    return paypalFetch<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

/** Read one capture back, for the events that only name a capture id. */
export async function getCapture(captureId: string): Promise<PaypalCapture> {
    return paypalFetch<PaypalCapture>(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
}

/** Issues that mean "this order is already captured", not "this failed". */
const ALREADY_CAPTURED_ISSUES = new Set([
    "ORDER_ALREADY_CAPTURED",
    "ORDER_ALREADY_COMPLETED",
]);

/**
 * Take the money.
 *
 * Returns the COMPLETED capture, whether this call made it or found it.
 *
 * IDEMPOTENT IN TWO LAYERS, because both capture paths can race:
 *
 *   1. `PayPal-Request-Id` is derived from the ORDER ID and nothing else,
 *      so it is byte-identical across the return leg, the webhook, and
 *      any retry of either. PayPal answers a repeat of the same request
 *      id with the same result instead of charging again.
 *   2. If PayPal answers ORDER_ALREADY_CAPTURED anyway — which it will
 *      when the two paths are far enough apart in time for the request-id
 *      window to have closed — we read the order back and return the
 *      capture that already exists. A second charge is not possible from
 *      here; the worst case is that we learn about the first one late.
 *
 * Returns null when PayPal took the money but told us about it in a shape
 * we cannot read. Nothing is granted on a null: money code fails closed,
 * and a capture we cannot identify is a capture we cannot make idempotent.
 */
export async function captureOrder(orderId: string): Promise<PaypalCapture | null> {
    try {
        const captured = await paypalFetch<PaypalOrder>(
            `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
            {
                method: "POST",
                // An empty JSON body, not an absent one: PayPal rejects a
                // capture with Content-Type json and no body on some paths.
                body: "{}",
                headers: {
                    "PayPal-Request-Id": `mhh-capture-${orderId}`,
                    Prefer: "return=representation",
                },
            },
        );
        const capture = completedCaptureOf(captured);
        if (capture?.id) return capture;

        logger.error("PayPalOrders", `Capture of ${orderId} returned no readable capture`, {
            status: captured?.status ?? null,
        });
        return null;
    } catch (err) {
        const alreadyCaptured =
            err instanceof PaypalApiError &&
            err.status === 422 &&
            !!err.issue &&
            ALREADY_CAPTURED_ISSUES.has(err.issue);

        if (!alreadyCaptured) throw err;

        // The other path got there first. Its capture is the real one.
        logger.error("PayPalOrders", `Order ${orderId} was already captured — reading it back`);
        const order = await getOrder(orderId);
        const capture = completedCaptureOf(order);
        return capture?.id ? capture : null;
    }
}
