import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { metricsDb } from "@/lib/metrics/db";
import { isMissingRevenueSchema } from "@/lib/metrics/revenue";
import { paypalPathLive } from "@/lib/paypal/flag";
import { readSignatureHeaders, verifyWebhookSignature } from "@/lib/paypal/webhook";
import {
    fixedTermPaidThrough,
    getSubscription,
    isEntitlingStatus,
    resolvePlan,
} from "@/lib/paypal/subscriptions";
import { grantPaypalTier, revokePaypalTier, grantPrepaidTerm, endPrepaidTerm } from "@/lib/paypal/entitlement";
import {
    captureMatchesPrice,
    captureOrder,
    decodePrepaidCustomId,
    getCapture,
    getOrder,
    orderCustomId,
} from "@/lib/paypal/orders";
import { termByKey, TERM_CURRENCY, type MembershipTerm } from "@/lib/billing/terms";
import type { PaypalCapture, PaypalSubscription, PaypalWebhookEvent } from "@/lib/paypal/types";

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

/**
 * The subscription id an event refers to, whichever shape it arrives in.
 *
 * ONLY MEANINGFUL FOR SUBSCRIPTION EVENTS. An order or a capture has no
 * subscription and no billing_agreement_id, so this returns null for
 * them — which is why the prepaid events below get a dispatch branch of
 * their own rather than another case label on the subscription switch.
 * A capture routed through here would look exactly like a one-off sale
 * with no agreement: silently ignored, member charged, no tier.
 */
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

            // ══ PREPAID TERMS — a different API, a different branch ══
            //
            // These carry an ORDER or a CAPTURE. Neither has a
            // subscription id, so none of the handlers above can be
            // reused for them; routing one through applyStatusFromPaypal
            // would end in "no subscription reference — ignored" with the
            // member's money already taken.

            // The backstop for someone who approved and closed the tab.
            // Approval moves no money; only a capture does, and only we
            // can make one. Without this, that member is never charged
            // and never gets what they clicked to buy.
            case "CHECKOUT.ORDER.APPROVED": {
                const result = await applyOrderApproved(admin, event);
                if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
                break;
            }

            // The money moved. This is the grant.
            case "PAYMENT.CAPTURE.COMPLETED": {
                const result = await applyCaptureCompleted(admin, event);
                if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
                break;
            }

            // The money went back. So does the term.
            case "PAYMENT.CAPTURE.REFUNDED":
            case "PAYMENT.CAPTURE.REVERSED":
            case "PAYMENT.CAPTURE.DENIED": {
                const result = await applyCaptureReversal(admin, event);
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

    // Which tier did they actually buy, and does it END? An unrecognised
    // plan grants nothing — this is the PayPal analogue of the
    // studio-priced subscription that silently granted `pro` (audit
    // Part 2, M1), and it now also covers "is this one of the fixed-term
    // plans", because nothing on the event itself says so.
    const plan = resolvePlan(subscription.plan_id);
    if (!plan) {
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
        tier: plan.tier,
        subscriptionId,
        paypalStatus: subscription.status ?? "ACTIVE",
        currentPeriodEnd: subscription.billing_info?.next_billing_time ?? null,
        // Open-ended plans get NO clock; fixed-term plans get one that
        // outlives the agreement. See fixedTermPaidThrough.
        paidThrough: plan.termMonths === null ? null : fixedTermPaidThrough(subscription),
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
        const plan = resolvePlan(subscription.plan_id);
        if (!plan) {
            logger.error("PayPalWebhook", `Subscription ${subscriptionId} has an unrecognised plan id — granting nothing`);
            return { ok: true };
        }
        const outcome = await grantPaypalTier(admin, {
            userId,
            tier: plan.tier,
            subscriptionId,
            paypalStatus: subscription.status,
            currentPeriodEnd: subscription.billing_info?.next_billing_time ?? null,
            // A renewal on a fixed-term plan pushes the clock forward by
            // the cycle it just paid for. This is the line that makes the
            // final charge survive the EXPIRED that arrives beside it.
            paidThrough: plan.termMonths === null ? null : fixedTermPaidThrough(subscription),
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

// ══════════════════════════════════════════════════════════════════
// PREPAID TERM HANDLERS
//
// Deliberately NOT gated on NEXT_PUBLIC_PREPAID_TERMS. The flag governs
// whether a term can be BOUGHT; these run after somebody already has.
// A flag flipped off between a member approving and PayPal delivering
// must not turn a completed payment into nothing — so the gate that
// makes this dark is the one upstream, at checkout, where no order can
// be created in the first place and therefore no capture can exist.
// ══════════════════════════════════════════════════════════════════

/** Everything a capture has to establish before it may buy anything. */
interface PrepaidClaim {
    userId: string;
    term: MembershipTerm;
}

/**
 * Work out who this capture is for and what it bought — or refuse.
 *
 * Three things must all line up, and every one of them can only fail
 * closed:
 *
 *   · a Supabase user id, from custom_id. The only mapping there is.
 *   · a term we actually sell. An unknown key is not guessed at from the
 *     amount: two terms could share a price and the guess would hand out
 *     the longer one.
 *   · the RIGHT amount for that term, to the cent. A stale order or a
 *     partial capture must not buy twelve months.
 *
 * `orderId` is used to fetch the order when a capture arrives carrying
 * only a bare user id, which is what an order created before the term
 * was encoded into custom_id looks like.
 */
async function resolvePrepaidClaim(
    capture: PaypalCapture | null | undefined,
    orderId: string | null,
    context: string,
): Promise<PrepaidClaim | null> {
    const decoded = decodePrepaidCustomId(capture?.custom_id);
    let userId = decoded?.userId ?? null;
    let termKey = decoded?.termKey ?? null;

    if ((!userId || !termKey) && orderId) {
        const order = await getOrder(orderId);
        const fromOrder = orderCustomId(order);
        userId = userId ?? fromOrder?.userId ?? null;
        termKey = termKey ?? fromOrder?.termKey ?? null;
    }

    if (!userId) {
        logger.error("PayPalWebhook", `${context}: no custom_id — cannot map this capture to a member`);
        return null;
    }
    const term = termByKey(termKey);
    if (!term) {
        logger.error("PayPalWebhook", `${context}: unrecognised term "${String(termKey)}" — granting nothing`);
        Sentry.captureMessage("PayPal capture for an unrecognised membership term", {
            level: "error",
            tags: { domain: "billing", provider: "paypal" },
            extra: { orderId, termKey },
        });
        return null;
    }
    if (!captureMatchesPrice(capture, term.prepaidPrice, TERM_CURRENCY)) {
        logger.error("PayPalWebhook", `${context}: amount does not match ${term.key} — granting nothing`, {
            expected: term.prepaidPrice,
            currency: TERM_CURRENCY,
        });
        Sentry.captureMessage("PayPal capture amount did not match the term price", {
            level: "error",
            tags: { domain: "billing", provider: "paypal" },
            extra: { orderId, termKey: term.key, expected: term.prepaidPrice },
        });
        return null;
    }

    return { userId, term };
}

/** Grant a term for a capture we have in hand. Shared by both entrances. */
async function grantFromCapture(
    admin: AdminClient,
    capture: PaypalCapture,
    orderId: string | null,
    context: string,
): Promise<HandlerResult> {
    const claim = await resolvePrepaidClaim(capture, orderId, context);
    if (!claim) return { ok: true };
    if (!capture.id) {
        logger.error("PayPalWebhook", `${context}: capture has no id — refusing an ungovernable grant`);
        return { ok: true };
    }

    const outcome = await grantPrepaidTerm(admin, {
        userId: claim.userId,
        tier: claim.term.tier,
        months: claim.term.months,
        captureId: capture.id,
        orderId,
    });

    return outcome.action === "failed" ? { ok: false, error: outcome.error } : { ok: true };
}

/**
 * CHECKOUT.ORDER.APPROVED → capture it ourselves, then grant.
 *
 * The member approved. Nothing has been charged. If we stop here they
 * are never charged and never get their term, and the order simply
 * expires — which is the single most expensive way this feature can
 * fail, because it looks exactly like success to the person who clicked.
 */
async function applyOrderApproved(admin: AdminClient, event: PaypalWebhookEvent): Promise<HandlerResult> {
    const orderId = event.resource?.id ?? null;
    if (!orderId) {
        logger.error("PayPalWebhook", "ORDER.APPROVED with no order id", { eventId: event.id });
        return { ok: true };
    }

    // Check the order is one of ours BEFORE taking anyone's money.
    const fromEvent = orderCustomId(event.resource);
    if (!fromEvent?.userId) {
        const order = await getOrder(orderId);
        if (!orderCustomId(order)?.userId) {
            logger.error("PayPalWebhook", `Order ${orderId} carries no custom_id — not ours, capturing nothing`);
            return { ok: true };
        }
    }

    // Idempotent at PayPal AND here: if the return leg already captured,
    // this reads that capture back rather than making a second one, and
    // grantPrepaidTerm then recognises it as already applied.
    const capture = await captureOrder(orderId);
    if (!capture) {
        // We could not establish whether money moved. Grant nothing and
        // let PayPal redeliver — the alternative is guessing about a
        // payment, which is the one thing money code may never do.
        logger.error("PayPalWebhook", `Could not capture or read back order ${orderId}`);
        return { ok: false, error: "capture-unresolved" };
    }

    return grantFromCapture(admin, capture, orderId, `ORDER.APPROVED ${orderId}`);
}

/** PAYMENT.CAPTURE.COMPLETED → the money is real. Grant the term. */
async function applyCaptureCompleted(admin: AdminClient, event: PaypalWebhookEvent): Promise<HandlerResult> {
    const capture = event.resource as PaypalCapture | undefined;
    const captureId = capture?.id ?? null;
    if (!captureId) {
        logger.error("PayPalWebhook", "CAPTURE.COMPLETED with no capture id", { eventId: event.id });
        return { ok: true };
    }

    const orderId = capture?.supplementary_data?.related_ids?.order_id ?? null;
    return grantFromCapture(admin, capture as PaypalCapture, orderId, `CAPTURE.COMPLETED ${captureId}`);
}

/**
 * The capture id a refund/reversal/denial is about.
 *
 * REVERSED and DENIED carry the capture itself, so `id` is the capture.
 * REFUNDED carries a REFUND, whose own `id` is the refund — using it
 * would look up a capture that does not exist and quietly end nothing.
 * PayPal points back at the capture in two places and neither is
 * guaranteed, so both are tried before giving up.
 */
function reversedCaptureIdOf(event: PaypalWebhookEvent): string | null {
    const resource = event.resource;
    if (event.event_type !== "PAYMENT.CAPTURE.REFUNDED") {
        return resource?.id ?? null;
    }
    const related = resource?.supplementary_data?.related_ids?.capture_id;
    if (typeof related === "string" && related.trim()) return related.trim();

    // The `up` link on a refund is the capture it refunds:
    //   .../v2/payments/captures/<capture id>
    const up = (resource?.links ?? []).find((link) => link?.rel?.toLowerCase() === "up")?.href;
    if (typeof up === "string") {
        const match = up.match(/\/captures\/([^/?#]+)/);
        if (match?.[1]) return decodeURIComponent(match[1]);
    }
    return null;
}

/**
 * A refund, reversal or denial ends the term it bought.
 *
 * This is the one path that may end a membership whose `paid_through` is
 * still in the future, because a refunded member has not, in the end,
 * paid. endPrepaidTerm keeps every other guard: it will only act on a
 * capture that actually bought the tier currently in force.
 *
 * If we cannot establish who or what, we change NOTHING and say so
 * loudly. Revoking on a guess is how a paying member gets downgraded by
 * an unrelated refund.
 */
async function applyCaptureReversal(admin: AdminClient, event: PaypalWebhookEvent): Promise<HandlerResult> {
    const captureId = reversedCaptureIdOf(event);
    const reason = (event.event_type ?? "PAYMENT.CAPTURE.REFUNDED").split(".").pop() ?? "REFUNDED";

    if (!captureId) {
        logger.error("PayPalWebhook", `${event.event_type} names no capture — ending nothing`, {
            eventId: event.id,
        });
        Sentry.captureMessage("PayPal refund event could not be traced to a capture", {
            level: "warning",
            tags: { domain: "billing", provider: "paypal" },
            extra: { eventId: event.id, eventType: event.event_type },
        });
        return { ok: true };
    }

    let userId = decodePrepaidCustomId(event.resource?.custom_id)?.userId ?? null;
    if (!userId) {
        // A refund does not always carry the capture's custom_id, so ask
        // PayPal for the capture itself.
        const capture = await getCapture(captureId);
        userId = decodePrepaidCustomId(capture?.custom_id)?.userId ?? null;
    }
    if (!userId) {
        logger.error("PayPalWebhook", `${reason} of ${captureId} has no custom_id — ending nothing`);
        return { ok: true };
    }

    const outcome = await endPrepaidTerm(admin, { userId, captureId, reason });
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
