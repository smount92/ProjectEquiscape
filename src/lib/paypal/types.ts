/**
 * The slices of PayPal's REST payloads this codebase actually reads.
 *
 * Deliberately partial. These are hand-written rather than pulled from an
 * SDK because we consume perhaps a dozen fields across two endpoints, and
 * a dependency that ships its own HTTP stack and OAuth cache is a poor
 * trade for that. Everything is optional and every consumer treats a
 * missing field as "unknown", so a PayPal payload change degrades to a
 * refusal to act rather than a crash.
 */

/** The tiers PayPal can sell. Mirrors the two Stripe subscription prices. */
export type PaypalPlanKey = "pro" | "studio";

/**
 * PayPal subscription lifecycle states.
 * https://developer.paypal.com/docs/api/subscriptions/v1/
 */
export type PaypalSubscriptionStatus =
    | "APPROVAL_PENDING"
    | "APPROVED"
    | "ACTIVE"
    | "SUSPENDED"
    | "CANCELLED"
    | "EXPIRED";

export interface PaypalLink {
    href?: string;
    rel?: string;
    method?: string;
}

export interface PaypalSubscription {
    id?: string;
    status?: string;
    plan_id?: string;
    /**
     * Our Supabase user id. This is the PayPal analogue of Stripe's
     * `client_reference_id` and is the ONLY thing that maps a PayPal
     * subscription back to a member. If it is absent we refuse to grant.
     */
    custom_id?: string;
    billing_info?: {
        next_billing_time?: string;
        final_payment_time?: string;
    };
    links?: PaypalLink[];
}

/** A PAYMENT.SALE.COMPLETED resource (a renewal charge). */
export interface PaypalSale {
    id?: string;
    state?: string;
    /** The subscription ("I-...") this sale belongs to. */
    billing_agreement_id?: string;
    amount?: { total?: string; currency?: string };
}

// ── Orders v2: the one-time, non-recurring half ────────────────────
//
// A prepaid term is an ORDER, not a subscription, and the two APIs share
// almost no vocabulary. The differences that matter:
//
//   · our Supabase user id rides on purchase_units[].custom_id, one level
//     deeper than a subscription's top-level custom_id;
//   · an order is not money until WE capture it. Approval alone charges
//     nobody — see orders.ts;
//   · the link to send the payer to is `payer-action`, not `approve`,
//     whenever payment_source.paypal is specified on create.

/** One purchase_unit. We only ever send exactly one. */
export interface PaypalPurchaseUnit {
    reference_id?: string;
    /** OUR Supabase user id. The order-shaped custom_id. */
    custom_id?: string;
    description?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: {
        captures?: PaypalCapture[];
        refunds?: Array<{ id?: string; status?: string }>;
    };
}

/**
 * Orders v2 lifecycle.
 *
 * PAYER_ACTION_REQUIRED is the one that surprises people: it is what a
 * create returns when payment_source.paypal is present, in place of the
 * CREATED you get without it.
 */
export type PaypalOrderStatus =
    | "CREATED"
    | "SAVED"
    | "APPROVED"
    | "PAYER_ACTION_REQUIRED"
    | "VOIDED"
    | "COMPLETED";

export interface PaypalOrder {
    id?: string;
    status?: string;
    intent?: string;
    purchase_units?: PaypalPurchaseUnit[];
    links?: PaypalLink[];
}

/** A capture — the moment money actually moves. */
export interface PaypalCapture {
    id?: string;
    status?: string;
    /** Copied down from the purchase unit by PayPal. Our user id. */
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    /** Present on capture webhooks; carries the order this capture is for. */
    supplementary_data?: {
        related_ids?: { order_id?: string; capture_id?: string; authorization_id?: string };
    };
    links?: PaypalLink[];
    seller_receivable_breakdown?: { net_amount?: { value?: string; currency_code?: string } };
}

/** A refund resource (PAYMENT.CAPTURE.REFUNDED). */
export interface PaypalRefund {
    id?: string;
    status?: string;
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
    links?: PaypalLink[];
}

/** The webhook envelope PayPal POSTs to us. */
export interface PaypalWebhookEvent {
    id?: string;
    event_type?: string;
    resource_type?: string;
    summary?: string;
    resource?: PaypalSubscription & PaypalSale & PaypalOrder & PaypalCapture & PaypalRefund;
}

/** Every event type this integration acts on. Anything else is a no-op. */
export const HANDLED_EVENT_TYPES = [
    "BILLING.SUBSCRIPTION.ACTIVATED",
    "BILLING.SUBSCRIPTION.CANCELLED",
    "BILLING.SUBSCRIPTION.EXPIRED",
    "BILLING.SUBSCRIPTION.SUSPENDED",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    "PAYMENT.SALE.COMPLETED",
    // ── Prepaid terms (Orders v2) ──
    // APPROVED is the server-side backstop for a member who approved and
    // then closed the tab: without a capture there is no money, so we
    // capture it ourselves rather than leave a term paid for by nobody.
    "CHECKOUT.ORDER.APPROVED",
    "PAYMENT.CAPTURE.COMPLETED",
    // A term that has been given back is a term that has ended.
    "PAYMENT.CAPTURE.REFUNDED",
    "PAYMENT.CAPTURE.REVERSED",
    "PAYMENT.CAPTURE.DENIED",
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(value: unknown): value is HandledEventType {
    return typeof value === "string" && (HANDLED_EVENT_TYPES as readonly string[]).includes(value);
}
