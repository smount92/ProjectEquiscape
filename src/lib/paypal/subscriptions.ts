/**
 * Creating and reading PayPal subscriptions.
 *
 * The PayPal analogue of a Stripe Checkout Session: we create the
 * subscription server-side in APPROVAL_PENDING, then send the member to
 * PayPal's approval URL. Nothing is charged and no tier is granted until
 * PayPal tells us it activated — which arrives on the webhook, and is
 * confirmed independently on the return leg.
 */

import { paypalFetch } from "./client";
import type { PaypalPlanKey, PaypalSubscription } from "./types";

/**
 * Which env var holds which plan id. The owner creates one PayPal
 * *product* and two *plans* under it ($5/mo, $10/mo) and pastes the plan
 * ids here — exactly the shape of STRIPE_PRO_PRICE_ID /
 * STRIPE_STUDIO_PRO_PRICE_ID.
 */
const PLAN_ENV_VAR: Record<PaypalPlanKey, string> = {
    pro: "PAYPAL_PRO_PLAN_ID",
    studio: "PAYPAL_STUDIO_PLAN_ID",
};

/** The tier a given plan grants. Kept next to the plan mapping on purpose. */
export const PLAN_TIER: Record<PaypalPlanKey, "pro" | "studio"> = {
    pro: "pro",
    studio: "studio",
};

/** The configured plan id for a tier, or null if the owner has not set it. */
export function planIdFor(plan: PaypalPlanKey): string | null {
    const value = process.env[PLAN_ENV_VAR[plan]];
    return value && value.trim() ? value.trim() : null;
}

/**
 * Reverse lookup: which of our plan keys does this PayPal plan id belong
 * to? Used by the webhook to decide which tier an event grants, so that a
 * subscription to the $5 plan can never be read as the $10 tier (the
 * PayPal version of the studio→pro downgrade bug, audit Part 2 / M1).
 *
 * Returns null for an unrecognised plan — the caller must then refuse to
 * grant rather than guess.
 */
export function planKeyForPlanId(planId: string | null | undefined): PaypalPlanKey | null {
    if (!planId) return null;
    const trimmed = planId.trim();
    if (!trimmed) return null;
    for (const key of Object.keys(PLAN_ENV_VAR) as PaypalPlanKey[]) {
        if (planIdFor(key) === trimmed) return key;
    }
    return null;
}

export interface CreateSubscriptionArgs {
    plan: PaypalPlanKey;
    /** Supabase user id — rides along as custom_id. */
    userId: string;
    userEmail?: string;
    returnUrl: string;
    cancelUrl: string;
}

/**
 * Create a subscription and hand back its id plus the URL to send the
 * member to.
 *
 * `custom_id` carries the Supabase user id. It is the PayPal counterpart
 * of Stripe's `client_reference_id`, it survives onto every subsequent
 * BILLING.SUBSCRIPTION.* event, and it is the only mapping back to a
 * member the webhook has. Without it the webhook grants nothing.
 */
export async function createSubscription(
    args: CreateSubscriptionArgs,
): Promise<{ id: string; approveUrl: string }> {
    const planId = planIdFor(args.plan);
    if (!planId) {
        throw new Error(`PayPal plan id missing for ${args.plan}`);
    }

    const body: Record<string, unknown> = {
        plan_id: planId,
        custom_id: args.userId,
        application_context: {
            brand_name: "Model Horse Hub",
            // Show the member a "Subscribe Now" button rather than
            // "Continue", so approval completes in one step.
            user_action: "SUBSCRIBE_NOW",
            shipping_preference: "NO_SHIPPING",
            payment_method: {
                payer_selected: "PAYPAL",
                // Accept a PayPal balance or any funding source the payer
                // has. The whole reason this path exists is members who
                // want to spend a balance, so we must not force instant
                // funding only.
                payee_preferred: "UNRESTRICTED",
            },
            return_url: args.returnUrl,
            cancel_url: args.cancelUrl,
        },
    };

    if (args.userEmail) {
        body.subscriber = { email_address: args.userEmail };
    }

    const created = await paypalFetch<PaypalSubscription>("/v1/billing/subscriptions", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            // PayPal-side idempotency for the create call itself, so a
            // network retry inside PayPal's edge cannot mint two
            // subscriptions for one click.
            "PayPal-Request-Id": `mhh-${args.userId}-${args.plan}-${Date.now()}`,
            Prefer: "return=representation",
        },
    });

    const id = created?.id;
    const approveUrl = (created?.links ?? []).find(
        (link) => link?.rel?.toLowerCase() === "approve",
    )?.href;

    if (!id || !approveUrl) {
        throw new Error("PayPal did not return a subscription id and approval link");
    }

    return { id, approveUrl };
}

/** Read a subscription back from PayPal. The authoritative status source. */
export async function getSubscription(subscriptionId: string): Promise<PaypalSubscription> {
    return paypalFetch<PaypalSubscription>(
        `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
}

/**
 * Does this PayPal status mean "currently entitled"?
 *
 * ACTIVE alone. Notably APPROVED does NOT count: it means the payer
 * approved the agreement but PayPal has not taken the first payment yet.
 * Granting on APPROVED would hand out a tier for an unpaid subscription.
 */
export function isEntitlingStatus(status: string | null | undefined): boolean {
    return typeof status === "string" && status.toUpperCase() === "ACTIVE";
}
