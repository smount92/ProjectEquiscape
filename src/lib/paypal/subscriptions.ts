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
import { addMonthsUtc } from "@/lib/entitlement/clock";
import { termByKey, termForPlanId, termPlanId, type MembershipTerm } from "@/lib/billing/terms";
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

// ── Fixed-term plans (3 / 6 / 12 monthly cycles, then stop) ────────
//
// A second family of plans alongside the two open-ended ones. Same API,
// same webhook, same grant path — the ONLY thing that distinguishes them
// is `total_cycles`, which PayPal holds and we never see on an event. So
// the distinction has to come from the plan id, which is why every plan
// id on the site resolves through resolvePlan() below and why an
// unrecognised one grants nothing.
//
// Getting this wrong in either direction is a real failure:
//   · a fixed-term plan mistaken for open-ended gets no clock, so it
//     never ends and the member has a free membership for life;
//   · an open-ended plan mistaken for fixed-term gets a one-month clock
//     and a paying subscriber loses access the moment a renewal webhook
//     is late.
// Hence: exact id match, both directions, no inference.

/** What a plan id resolves to. `termMonths: null` means open-ended. */
export interface ResolvedPlan {
    tier: "pro" | "studio";
    /** Months per full term, or null when the plan bills until cancelled. */
    termMonths: number | null;
    /** The membership-terms.json key, for fixed-term plans only. */
    term: MembershipTerm | null;
}

/**
 * Which plan is this, open-ended or fixed-term? Null for "not ours".
 *
 * Open-ended is checked first so the two existing live plans keep
 * resolving exactly as they did before fixed terms existed, even in the
 * pathological case of the same id being pasted into two env vars.
 */
export function resolvePlan(planId: string | null | undefined): ResolvedPlan | null {
    const openEnded = planKeyForPlanId(planId);
    if (openEnded) {
        return { tier: PLAN_TIER[openEnded], termMonths: null, term: null };
    }
    const term = termForPlanId(planId);
    if (term) {
        return { tier: term.tier, termMonths: term.months, term };
    }
    return null;
}

/**
 * Grace added to a fixed-term subscription's clock.
 *
 * PayPal's renewal charge and its webhook are not simultaneous, and a
 * clock set to the exact billing instant would drop a paying member for
 * however long the delivery took. Three days is longer than any delivery
 * and shorter than a billing cycle, so it can never let one missed
 * renewal look like a paid one.
 *
 * It also makes the fixed-term path self-healing: if PayPal goes quiet
 * altogether, the clock runs out on its own three days after the last
 * confirmed payment. No cron, no reconciliation, no orphaned membership.
 */
const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * How far a fixed-term subscription is paid through, after the cycle we
 * have just been told about.
 *
 * `next_billing_time` is PayPal's own answer to "when does the paid-for
 * period end", so it is used when it makes sense. Two cases where it
 * does not:
 *
 *   · THE FINAL CYCLE. There is no next billing, so PayPal sends no
 *     next_billing_time — and this is the exact moment PayPal also fires
 *     BILLING.SUBSCRIPTION.EXPIRED. Falling back to one month is what
 *     gives the member the month that final charge actually bought, and
 *     is what makes the EXPIRED arriving alongside it harmless.
 *   · A DATE ALREADY IN THE PAST, from a delayed delivery. We have just
 *     been told a payment succeeded; treating that as buying zero time
 *     would be absurd, so it falls back to a month as well.
 */
export function fixedTermPaidThrough(
    subscription: PaypalSubscription | null | undefined,
    now: number = Date.now(),
): string {
    const nextBilling = subscription?.billing_info?.next_billing_time;
    if (typeof nextBilling === "string" && nextBilling.trim()) {
        const parsed = Date.parse(nextBilling);
        if (Number.isFinite(parsed) && parsed > now) {
            return new Date(parsed + RENEWAL_GRACE_MS).toISOString();
        }
    }
    return new Date(addMonthsUtc(now, 1) + RENEWAL_GRACE_MS).toISOString();
}

/** The configured plan id for a fixed term, or null if unset. */
export function fixedTermPlanId(termKey: string): string | null {
    const term = termByKey(termKey);
    return term ? termPlanId(term) : null;
}

export interface CreateSubscriptionArgs {
    plan: PaypalPlanKey;
    /** Supabase user id — rides along as custom_id. */
    userId: string;
    userEmail?: string;
    returnUrl: string;
    cancelUrl: string;
    /**
     * A fixed-term plan id to use INSTEAD of the open-ended plan for
     * `plan`. The tier still comes from `plan`; only the billing shape
     * differs, which is what keeps one create path for both families.
     */
    planIdOverride?: string | null;
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
    const planId = args.planIdOverride?.trim() || planIdFor(args.plan);
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
                // UNRESTRICTED governs INSTANT vs DELAYED funding — it does
                // not control whether a balance is offered, and no merchant
                // setting does. It still matters: the alternative,
                // IMMEDIATE_PAYMENT_REQUIRED, forbids delayed bank funding
                // and would shut out bank-only members, so leave this as is.
                // (An earlier comment here claimed this existed to let
                // members spend a balance. It doesn't; PayPal decides the
                // funding source, and its published order draws an
                // available balance first regardless of this field.)
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
