import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { metricsDb } from "@/lib/metrics/db";
import { isMissingRevenueSchema } from "@/lib/metrics/revenue";
import { paypalPathLive } from "@/lib/paypal/flag";
import { readSignatureHeaders, verifyWebhookSignature } from "@/lib/paypal/webhook";
import { getSubscription, isEntitlingStatus, planKeyForPlanId, PLAN_TIER } from "@/lib/paypal/subscriptions";
import { grantPaypalTier, revokePaypalTier } from "@/lib/paypal/entitlement";
import type { PaypalSubscription, PaypalWebhookEvent } from "@/lib/paypal/types";

// ============================================================
// PayPal Webhook Handler
// The PayPal half of MHH's billing. Structural twin of
// src/app/api/webhooks/stripe/route.ts — read that one first.
//
// Required env vars:
//   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET - REST app credentials
//   PAYPAL_WEBHOOK_ID                       - the registered webhook's id
//   PAYPAL_ENV                              - "live" or "sandbox" (default)
//   PAYPAL_PRO_PLAN_ID / PAYPAL_STUDIO_PLAN_ID - the two billing plans
//
// THE TIER OF RECORD IS auth.users.app_metadata.tier, exactly as on the
// Stripe side. subscription_state is a mirror, written alongside and never
// instead, and a mirror failure is swallowed so it cannot make PayPal
// retry an event that already took effect.
//
// ── THREE PROPERTIES THIS FILE EXISTS TO HOLD ─────────────────────
//
// 1. UNVERIFIED IS UNTRUSTED. Nothing below the signature check runs
//    until PayPal has confirmed the delivery is genuine. An unverified
//    billing webhook is an entitlement-forgery hole: the body names the
//    user to upgrade, so forging one would mint a free paid tier.
//
// 2. FAIL CLOSED. Every "we could not confirm this" path grants nothing.
//    A missing custom_id, an unrecognised plan id, an unreachable PayPal —
//    all end in no tier change rather than a guess.
//
// 3. NEVER REACH ACROSS TO STRIPE. Revocation is gated in
//    lib/paypal/entitlement.ts on PayPal having granted the tier in the
//    first place, so no PayPal event can downgrade a card subscriber.
//
// IDEMPOTENCY. PayPal retries a delivery until it gets a 2xx, and retries
// carry the same event id. Two layers cover it: every handler writes
// ABSOLUTE values (tier X, subscription id Y) rather than incrementing
// anything, so a replay is naturally a no-op; and, once migration 183 is
// pasted, an event-id ledger short-circuits the replay before it reaches
// the handler at all. The first layer is what makes this correct today,
// with 183 unapplied.
// ============================================================

type AdminClient = ReturnType<typeof getAdminClient>;

/**
 * Claim an event id, returning false if we have already processed it.
 *
 * Feature-detected: until migration 183 is pasted the RPC does not exist,
 * and we return true (proceed) because the handlers are idempotent on
 * their own. Any OTHER error also returns true — a broken ledger must not
 * be able to block a genuine activation from being honoured.
 */
async function claimEvent(
    admin: AdminClient,
    eventId: string | undefined,
    eventType: string | undefined,
): Promise<boolean> {
    if (!eventId) return true;
    try {
        const { data, error } = await metricsDb(admin).rpc("claim_paypal_webhook_event", {
            p_event_id: eventId,
            p_event_type: eventType ?? null,
        });
        if (error) {
            if (!isMissingRevenueSchema(error)) {
                logger.error("PayPalWebhook", "Event ledger errored — processing anyway", error);
            }
            return true;
        }
        return data !== false;
    } catch (err) {
        logger.error("PayPalWebhook", "Event ledger threw — processing anyway", err);
        return true;
    }
}

/**
 * The subscription an event is about, complete enough to act on.
 *
 * The signed resource is authentic, so it is used as-is when it carries
 * everything we need. When it does not — PAYMENT.SALE.COMPLETED carries a
 * sale, not a subscription — we ask PayPal directly. Returns null when the
 * subscription cannot be established at all.
 */
async function resolveSubscription(
    resource: PaypalWebhookEvent["resource"],
    subscriptionId: string | null,
): Promise<PaypalSubscription | null> {
    const hasEverything =
        !!resource?.custom_id && !!resource?.plan_id && !!resource?.status && !!resource?.id;
    if (hasEverything) return resource as PaypalSubscription;
    if (!subscriptionId) return null;
    return getSubscription(subscriptionId);
}

/** The subscription id an event refers to, whichever shape it arrives in. */
function subscriptionIdOf(event: PaypalWebhookEvent): string | null {
    const resource = event.resource;
    // BILLING.SUBSCRIPTION.* → resource.id is the subscription.
    if (event.event_type?.startsWith("BILLING.SUBSCRIPTION.")) {
        return resource?.id ?? null;
    }
    // PAYMENT.SALE.COMPLETED → the sale points at its subscription.
    return resource?.billing_agreement_id ?? null;
}

export async function POST(request: NextRequest) {
    // Flag off or credentials absent ⇒ this endpoint does not exist.
    if (!paypalPathLive()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rawBody = await request.text();

    // ── 1. Signature, before anything else ──
    const headers = readSignatureHeaders(request.headers);
    if (!headers) {
        logger.error("PayPalWebhook", "Delivery rejected: signature headers missing");
        return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
    }

    const verified = await verifyWebhookSignature(headers, rawBody);
    if (!verified) {
        Sentry.captureMessage("PayPal webhook signature verification failed", {
            level: "error",
            tags: { domain: "billing", provider: "paypal" },
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // ── 2. Only now is the body worth parsing ──
    let event: PaypalWebhookEvent;
    try {
        event = JSON.parse(rawBody) as PaypalWebhookEvent;
    } catch {
        // Verified but unparseable should be impossible; 400 rather than
        // 500 because retrying will not change the outcome.
        logger.error("PayPalWebhook", "Verified delivery had an unparseable body");
        return NextResponse.json({ error: "Malformed body" }, { status: 400 });
    }

    const admin = getAdminClient();

    // ── 3. Replay short-circuit (needs migration 183; optional) ──
    if (!(await claimEvent(admin, event.id, event.event_type))) {
        logger.error("PayPalWebhook", `Ignoring replay of event ${event.id}`);
        return NextResponse.json({ received: true, replay: true });
    }

    try {
        switch (event.event_type) {
            // ── The subscription started paying ──
            case "BILLING.SUBSCRIPTION.ACTIVATED": {
                const result = await applyActivation(admin, event);
                if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
                break;
            }

            // ── The subscription stopped, one way or another ──
            //
            // SUSPENDED is included deliberately: PayPal suspends after
            // its retry cycle gives up, and a suspended subscription is
            // not paying. It is reversible — a later ACTIVATED re-grants.
            case "BILLING.SUBSCRIPTION.CANCELLED":
            case "BILLING.SUBSCRIPTION.EXPIRED":
            case "BILLING.SUBSCRIPTION.SUSPENDED": {
                const result = await applyRevocation(admin, event);
                if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
                break;
            }

            // ── A renewal that did not go through ──
            //
            // Same stance as the Stripe route's invoice.payment_failed: a
            // failed attempt is NOT itself a cancellation. PayPal retries,
            // and plenty of them succeed. So we ask PayPal what the
            // subscription's state actually IS and apply the ordinary
            // rule — ACTIVE keeps the tier, anything else does not.
            case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
                const result = await applyStatusFromPaypal(admin, event);
                if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
                break;
            }

            // ── A renewal that did go through ──
            //
            // Re-affirms the tier and refreshes the period end. Matters
            // for a member who was SUSPENDED and has since paid: the
            // renewal is what restores them.
            case "PAYMENT.SALE.COMPLETED": {
                const result = await applyStatusFromPaypal(admin, event);
                if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
                break;
            }

            default:
                // Unhandled event type — log but don't error. PayPal
                // sends a great deal we have no opinion about.
                break;
        }
    } catch (err) {
        Sentry.captureException(err, {
            tags: { domain: "billing", provider: "paypal", event_type: event.event_type ?? "unknown" },
            level: "fatal",
        });
        logger.error("PayPalWebhook", `Error processing ${event.event_type}`, err);
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}

type HandlerResult = { ok: true } | { ok: false; error: string };

/** ACTIVATED → grant the tier the plan id says, and only that tier. */
async function applyActivation(admin: AdminClient, event: PaypalWebhookEvent): Promise<HandlerResult> {
    const subscriptionId = subscriptionIdOf(event);
    const subscription = await resolveSubscription(event.resource, subscriptionId);

    if (!subscription || !subscriptionId) {
        logger.error("PayPalWebhook", `ACTIVATED with no resolvable subscription`, { eventId: event.id });
        return { ok: true };
    }

    const userId = subscription.custom_id;
    if (!userId) {
        // The only mapping back to a member. Without it we cannot know
        // who to upgrade, and we must not guess.
        logger.error("PayPalWebhook", `Subscription ${subscriptionId} has no custom_id — cannot map to a member`);
        return { ok: true };
    }

    // Which tier did they actually buy? An unrecognised plan grants
    // nothing — this is the PayPal analogue of the studio-priced
    // subscription that silently granted `pro` (audit Part 2, M1).
    const planKey = planKeyForPlanId(subscription.plan_id);
    if (!planKey) {
        logger.error("PayPalWebhook", `Subscription ${subscriptionId} has an unrecognised plan id — granting nothing`);
        Sentry.captureMessage("PayPal subscription activated on an unrecognised plan", {
            level: "error",
            tags: { domain: "billing", provider: "paypal" },
            extra: { subscriptionId },
        });
        return { ok: true };
    }

    const outcome = await grantPaypalTier(admin, {
        userId,
        tier: PLAN_TIER[planKey],
        subscriptionId,
        paypalStatus: subscription.status ?? "ACTIVE",
        currentPeriodEnd: subscription.billing_info?.next_billing_time ?? null,
    });

    return outcome.action === "failed" ? { ok: false, error: outcome.error } : { ok: true };
}

/** CANCELLED / EXPIRED / SUSPENDED → revoke, if PayPal granted it. */
async function applyRevocation(admin: AdminClient, event: PaypalWebhookEvent): Promise<HandlerResult> {
    const subscriptionId = subscriptionIdOf(event);
    const userId = event.resource?.custom_id;

    if (!subscriptionId) {
        logger.error("PayPalWebhook", `${event.event_type} with no subscription id`, { eventId: event.id });
        return { ok: true };
    }

    // A revocation does not need the plan id, only who and which
    // subscription — but it does need custom_id, so fetch if it is absent.
    let resolvedUserId = userId;
    if (!resolvedUserId) {
        const subscription = await resolveSubscription(event.resource, subscriptionId);
        resolvedUserId = subscription?.custom_id;
    }
    if (!resolvedUserId) {
        logger.error("PayPalWebhook", `Subscription ${subscriptionId} has no custom_id — cannot map to a member`);
        return { ok: true };
    }

    const outcome = await revokePaypalTier(admin, {
        userId: resolvedUserId,
        subscriptionId,
        paypalStatus: event.resource?.status ?? statusFromEventType(event.event_type),
        currentPeriodEnd: event.resource?.billing_info?.next_billing_time ?? null,
    });

    return outcome.action === "failed" ? { ok: false, error: outcome.error } : { ok: true };
}

/**
 * Ask PayPal what the subscription IS, then apply the ordinary rule.
 *
 * Shared by the renewal-succeeded and renewal-failed events, because for
 * both of them the event itself is not the fact we care about — the
 * subscription's current status is. Fetching also means a
 * PAYMENT.SALE.COMPLETED, whose resource is a sale with no custom_id and
 * no plan id, arrives here fully resolved.
 */
async function applyStatusFromPaypal(admin: AdminClient, event: PaypalWebhookEvent): Promise<HandlerResult> {
    const subscriptionId = subscriptionIdOf(event);
    if (!subscriptionId) {
        // A one-off sale with no billing agreement is not ours.
        logger.error("PayPalWebhook", `${event.event_type} with no subscription reference`, {
            eventId: event.id,
        });
        return { ok: true };
    }

    const subscription = await getSubscription(subscriptionId);
    const userId = subscription?.custom_id;
    if (!userId) {
        logger.error("PayPalWebhook", `Subscription ${subscriptionId} has no custom_id — cannot map to a member`);
        return { ok: true };
    }

    logger.error("PayPalWebhook", `${event.event_type} for ${subscriptionId}`, {
        status: subscription.status,
    });

    if (isEntitlingStatus(subscription.status)) {
        const planKey = planKeyForPlanId(subscription.plan_id);
        if (!planKey) {
            logger.error("PayPalWebhook", `Subscription ${subscriptionId} has an unrecognised plan id — granting nothing`);
            return { ok: true };
        }
        const outcome = await grantPaypalTier(admin, {
            userId,
            tier: PLAN_TIER[planKey],
            subscriptionId,
            paypalStatus: subscription.status,
            currentPeriodEnd: subscription.billing_info?.next_billing_time ?? null,
        });
        return outcome.action === "failed" ? { ok: false, error: outcome.error } : { ok: true };
    }

    const outcome = await revokePaypalTier(admin, {
        userId,
        subscriptionId,
        paypalStatus: subscription.status,
        currentPeriodEnd: subscription.billing_info?.next_billing_time ?? null,
    });
    return outcome.action === "failed" ? { ok: false, error: outcome.error } : { ok: true };
}

/** Fallback status when the resource omits one, derived from the event. */
function statusFromEventType(eventType: string | undefined): string {
    switch (eventType) {
        case "BILLING.SUBSCRIPTION.CANCELLED":
            return "CANCELLED";
        case "BILLING.SUBSCRIPTION.EXPIRED":
            return "EXPIRED";
        case "BILLING.SUBSCRIPTION.SUSPENDED":
            return "SUSPENDED";
        default:
            return "CANCELLED";
    }
}
