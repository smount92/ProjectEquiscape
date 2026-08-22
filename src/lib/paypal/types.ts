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

/** The webhook envelope PayPal POSTs to us. */
export interface PaypalWebhookEvent {
    id?: string;
    event_type?: string;
    resource_type?: string;
    summary?: string;
    resource?: PaypalSubscription & PaypalSale;
}

/** Every event type this integration acts on. Anything else is a no-op. */
export const HANDLED_EVENT_TYPES = [
    "BILLING.SUBSCRIPTION.ACTIVATED",
    "BILLING.SUBSCRIPTION.CANCELLED",
    "BILLING.SUBSCRIPTION.EXPIRED",
    "BILLING.SUBSCRIPTION.SUSPENDED",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    "PAYMENT.SALE.COMPLETED",
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(value: unknown): value is HandledEventType {
    return typeof value === "string" && (HANDLED_EVENT_TYPES as readonly string[]).includes(value);
}
