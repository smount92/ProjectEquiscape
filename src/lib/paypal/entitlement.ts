/**
 * Granting and revoking tier for the PayPal path.
 *
 * Everything that writes a tier on behalf of PayPal goes through here, so
 * that the one property this feature must never violate lives in exactly
 * one place:
 *
 *   A PAYPAL EVENT MAY ONLY REVOKE A TIER THAT PAYPAL ITSELF GRANTED.
 *
 * The tier of record is auth.users.app_metadata.tier — the same field the
 * Stripe webhook writes and the only field the site's gates read
 * (src/lib/auth.ts). subscription_state is a reporting mirror, written
 * alongside and never instead, and a mirror failure is swallowed exactly
 * as it is on the Stripe side.
 *
 * ── HOW THE TWO PATHS STAY INDEPENDENT ────────────────────────────
 *
 * A grant stamps two extra keys next to the tier:
 *
 *   paypal_subscription_id — which PayPal subscription bought this tier
 *   paypal_tier            — what that subscription is entitled to
 *
 * A revoke refuses unless BOTH still match: the event's subscription id is
 * the one on file, AND the tier currently in force is still the one PayPal
 * granted. If Stripe has since written a different tier, the second test
 * fails and the PayPal event is ignored — a cancelled PayPal subscription
 * cannot strip a paying Stripe subscriber.
 *
 * A revoke also CLEARS both keys. That is what makes the terminal
 * sequences safe: PayPal sends SUSPENDED and then CANCELLED for the same
 * dead subscription, and the second one finds nothing to match, so it
 * cannot reach across to a tier the member has bought elsewhere in the
 * meantime. It is also what makes replay harmless.
 *
 * Nothing here ever reads or writes Stripe state. The Stripe webhook is
 * untouched by this feature and keeps its existing property: a Stripe
 * subscriber's tier changes only in response to a Stripe event.
 *
 * ── AND SINCE TIME-BOXED MEMBERSHIPS: A SECOND INVARIANT ──────────
 *
 *   A REVOKE MAY NEVER DROP A MEMBER WHOSE TERM IS STILL PAID FOR.
 *
 * PayPal can fire BILLING.SUBSCRIPTION.EXPIRED the instant the FINAL
 * charge of a fixed-term plan lands — the agreement really is over at
 * that point, PayPal is not wrong — and the member has just paid for the
 * month that follows. Honouring that event literally would take back
 * access somebody bought thirty seconds earlier.
 *
 * GUARD 0 in revokePaypalTier is the answer, and it defuses the trap for
 * the whole class rather than for that one event: any revocation, from
 * any source, checks `paid_through` first and refuses while it is in the
 * future. A member who paid for six months keeps six months even if
 * PayPal declares the agreement finished on day one.
 *
 * The single exception is a REFUND, which is the member being un-paid
 * and therefore genuinely un-entitled. It has its own door —
 * endPrepaidTerm — precisely so that "ignore paid_through" is a decision
 * made once, in the open, for the one case that deserves it.
 */

import type { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { metricsDb } from "@/lib/metrics/db";
import { isMissingRevenueSchema } from "@/lib/metrics/revenue";
import type { SubscriptionStatus } from "@/lib/metrics/revenue";
import {
    PAID_THROUGH_KEY,
    extendedPaidThrough,
    formatPaidThrough,
    paidThroughMs,
} from "@/lib/entitlement/clock";

type AdminClient = ReturnType<typeof getAdminClient>;

export type PaidTier = "pro" | "studio";

/** What a grant/revoke attempt actually did. Returned so routes can log it. */
export type EntitlementOutcome =
    | { action: "granted"; userId: string; tier: PaidTier; paidThrough?: string | null }
    | { action: "revoked"; userId: string }
    | { action: "ignored"; reason: string }
    | { action: "failed"; error: string };

// ── app_metadata keys owned by the PREPAID path ────────────────────
//
// Deliberately a separate namespace from paypal_subscription_id /
// paypal_tier. A prepaid term has no subscription, so a subscription
// event can never match its markers, and a refund can never match a
// subscription's. Keeping them apart is what stops one product's
// terminal event from reaching across and ending the other's.

/** The order that bought the term currently in force. */
const PREPAID_ORDER_KEY = "paypal_prepaid_order_id";
/** Capture ids already applied — the durable idempotency record. */
const PREPAID_CAPTURES_KEY = "paypal_prepaid_captures";
/** What the prepaid term bought, so a refund can check nothing else moved. */
const PREPAID_TIER_KEY = "paypal_prepaid_tier";

/**
 * How many capture ids to keep. Enough that a member renewing a 3-month
 * term for six years cannot replay their first purchase, small enough
 * that app_metadata stays a few hundred bytes. Oldest fall off the front.
 */
const MAX_REMEMBERED_CAPTURES = 25;

/** The capture ids on file, defensively — this comes back from an API. */
function rememberedCaptures(metadata: Record<string, unknown>): string[] {
    const raw = metadata[PREPAID_CAPTURES_KEY];
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === "string" && !!v.trim());
}

/**
 * PayPal's subscription status in the mirror's vocabulary (which is
 * Stripe's, stored verbatim per migration 176). Unknown statuses fall back
 * to the caller's own entitlement reading so the two records can never
 * disagree about whether someone is paying.
 */
export function toMirrorStatus(paypalStatus: string | null | undefined, isActive: boolean): SubscriptionStatus {
    switch ((paypalStatus ?? "").toUpperCase()) {
        case "ACTIVE":
            return "active";
        case "SUSPENDED":
            return "paused";
        case "CANCELLED":
        case "EXPIRED":
            return "canceled";
        case "APPROVAL_PENDING":
        case "APPROVED":
            return "incomplete";
        case "PAYMENT_FAILED":
            return "past_due";
        default:
            return isActive ? "active" : "canceled";
    }
}

/**
 * Write the reporting mirror. Swallows everything, exactly like the
 * Stripe webhook's mirrorSubscriptionState.
 *
 * THREE LEVELS OF FALLBACK, newest schema first: the term-aware RPC from
 * 185, then the provider-aware RPC from 183, then the original
 * record_subscription_state from 176 with NULL Stripe ids — that one
 * COALESCEs its id arguments, so even the oldest fallback records the
 * tier and status correctly (MRR stays right from day one) without
 * inventing a Stripe id for a PayPal purchase or erasing one that is
 * genuinely there. Each step down loses only reporting detail; none of
 * them loses the tier, which is written separately and is what gates the
 * site.
 */
async function mirrorPaypalState(
    admin: AdminClient,
    args: {
        userId: string;
        tier: "free" | PaidTier;
        status: SubscriptionStatus;
        currentPeriodEnd?: string | null;
        paypalSubscriptionId?: string | null;
        /** The entitlement clock, for the reports. undefined = don't care. */
        paidThrough?: string | null;
    },
): Promise<void> {
    try {
        if (args.paidThrough !== undefined) {
            const { error: termError } = await metricsDb(admin).rpc("record_paypal_term_state", {
                p_user_id: args.userId,
                p_tier: args.tier,
                p_status: args.status,
                p_current_period_end: args.currentPeriodEnd ?? null,
                p_paypal_subscription_id: args.paypalSubscriptionId ?? null,
                p_paid_through: args.paidThrough,
            });
            if (!termError) return;
            if (!isMissingRevenueSchema(termError)) {
                logger.error("PayPalWebhook", `term_state mirror failed for ${args.userId}`, termError);
                return;
            }
            // 185 not pasted — fall through to the 183 RPC below, which
            // records everything except the clock.
        }

        const { error } = await metricsDb(admin).rpc("record_paypal_subscription_state", {
            p_user_id: args.userId,
            p_tier: args.tier,
            p_status: args.status,
            p_current_period_end: args.currentPeriodEnd ?? null,
            p_paypal_subscription_id: args.paypalSubscriptionId ?? null,
        });
        if (!error) return;
        if (!isMissingRevenueSchema(error)) {
            logger.error("PayPalWebhook", `subscription_state mirror failed for ${args.userId}`, error);
            return;
        }
        // 183 not pasted — degrade to the 176 RPC.
        const { error: fallbackError } = await metricsDb(admin).rpc("record_subscription_state", {
            p_user_id: args.userId,
            p_tier: args.tier,
            p_status: args.status,
            p_current_period_end: args.currentPeriodEnd ?? null,
            p_stripe_customer_id: null,
            p_stripe_subscription_id: null,
        });
        if (fallbackError && !isMissingRevenueSchema(fallbackError)) {
            logger.error("PayPalWebhook", `subscription_state fallback mirror failed for ${args.userId}`, fallbackError);
        }
    } catch (err) {
        logger.error("PayPalWebhook", `subscription_state mirror threw for ${args.userId}`, err);
    }
}

/**
 * Warn when a member appears to be paying twice.
 *
 * Detection only — it deliberately does NOT cancel anything. Cancelling a
 * subscription the member did not ask us to cancel is worse than telling
 * them about it, and we cannot know which one they meant to keep. The
 * member gets a notification and the incident goes to Sentry so the owner
 * can refund and tidy up by hand.
 */
async function warnOnDoubleSubscription(
    admin: AdminClient,
    userId: string,
    priorMetadata: Record<string, unknown>,
): Promise<void> {
    const hadStripeCustomer = typeof priorMetadata.stripe_customer_id === "string";
    const priorTier = priorMetadata.tier;
    const wasAlreadyPaid = priorTier === "pro" || priorTier === "studio";
    // Only a genuine overlap: a Stripe customer id AND a paid tier that
    // PayPal did not put there.
    const grantedByPaypal = typeof priorMetadata.paypal_subscription_id === "string";
    if (!hadStripeCustomer || !wasAlreadyPaid || grantedByPaypal) return;

    logger.error(
        "PayPalWebhook",
        `DOUBLE SUBSCRIPTION: user ${userId} started PayPal billing while holding a paid Stripe tier`,
        { priorTier },
    );

    try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureMessage("PayPal subscription started by an existing Stripe subscriber", {
            level: "warning",
            tags: { domain: "billing", provider: "paypal" },
            extra: { userId, priorTier },
        });
    } catch {
        // Sentry must never break a billing write.
    }

    try {
        // createNotification is server-only: dynamic import inside
        // try/catch so a notify failure can never break billing.
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({
            userId,
            type: "billing_double_subscription",
            content:
                "You now have both a card subscription and a PayPal subscription for Model Horse Hub. " +
                "You only need one — contact support and we'll cancel the other and refund the overlap.",
            linkUrl: "/upgrade",
        });
    } catch (err) {
        logger.error("PayPalWebhook", "Double-subscription notice failed to send", err);
    }
    void admin;
}

/**
 * Grant a tier on behalf of a PayPal subscription.
 *
 * Idempotent: it writes absolute values (tier X, subscription id Y), never
 * increments, so replaying an ACTIVATED event lands on exactly the state
 * the first delivery produced.
 *
 * ── paidThrough: WHAT THE CLOCK MEANS FOR A SUBSCRIPTION ──────────
 *
 * OPEN-ENDED plans (the $5 and $10 monthlies, and every Stripe
 * subscription) pass nothing. The key is REMOVED, which is the only safe
 * default: an open-ended subscription that somehow acquired a clock would
 * expire a paying member the moment the date passed, and no renewal
 * webhook has to be missed for that to happen — it just happens. Absent
 * is the state that means "this ends when the provider says so".
 *
 * FIXED-TERM plans (3/6/12 cycles) pass the horizon of the cycle just
 * paid for. The webhook refreshes it on every renewal, and on the final
 * one — where PayPal reports no next_billing_time, because there is no
 * next — the caller substitutes one month, which is exactly the month
 * that final charge bought. That is what makes the EXPIRED-on-final-
 * charge trap harmless: the clock outlives the agreement.
 */
export async function grantPaypalTier(
    admin: AdminClient,
    args: {
        userId: string;
        tier: PaidTier;
        subscriptionId: string;
        paypalStatus?: string | null;
        currentPeriodEnd?: string | null;
        /** ISO instant for a fixed term; omit or null for open-ended. */
        paidThrough?: string | null;
    },
): Promise<EntitlementOutcome> {
    const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(args.userId);
    if (lookupError || !existing?.user) {
        // A member deleted between the event and its retry. Nothing to
        // grant and nothing to retry for.
        logger.error("PayPalWebhook", `No such user ${args.userId} for subscription ${args.subscriptionId}`);
        return { action: "ignored", reason: "user-not-found" };
    }

    const priorMetadata = (existing.user.app_metadata ?? {}) as Record<string, unknown>;

    // MERGE app_metadata. A bare object here erases every other key —
    // is_suspended lives there, so an overwrite would silently unsuspend
    // a banned member on purchase (audit N5).
    //
    // `paid_through` is destructured OUT rather than set to undefined,
    // because undefined survives a spread and would leave the key present
    // and unreadable. Open-ended grants genuinely delete it.
    const { [PAID_THROUGH_KEY]: _priorPaidThrough, ...carried } = priorMetadata;

    const nextMetadata: Record<string, unknown> = {
        ...carried,
        tier: args.tier,
        paypal_subscription_id: args.subscriptionId,
        paypal_tier: args.tier,
    };
    if (args.paidThrough) {
        nextMetadata[PAID_THROUGH_KEY] = args.paidThrough;
    }

    const { error: writeError } = await admin.auth.admin.updateUserById(args.userId, {
        app_metadata: nextMetadata,
    });

    if (writeError) {
        // 500 upstream so PayPal retries — a paid-for tier must not be
        // silently dropped.
        logger.error("PayPalWebhook", `Failed to grant ${args.tier} to ${args.userId}`, writeError);
        return { action: "failed", error: "tier-write-failed" };
    }

    await mirrorPaypalState(admin, {
        userId: args.userId,
        tier: args.tier,
        status: toMirrorStatus(args.paypalStatus ?? "ACTIVE", true),
        currentPeriodEnd: args.currentPeriodEnd,
        paypalSubscriptionId: args.subscriptionId,
        // `undefined` when no clock is involved either way, so the
        // overwhelmingly common case — an open-ended subscriber who has
        // never bought a term — does not pay for a round trip to a
        // migration that may never be pasted. A clock being SET or
        // CLEARED is what makes the term-aware mirror worth asking for.
        paidThrough: args.paidThrough
            ? args.paidThrough
            : _priorPaidThrough != null
              ? null
              : undefined,
    });

    await warnOnDoubleSubscription(admin, args.userId, priorMetadata);

    logger.error("PayPalWebhook", `User ${args.userId} tier set to ${args.tier} via PayPal`, {
        subscriptionId: args.subscriptionId,
        paidThrough: args.paidThrough ?? null,
    });
    return { action: "granted", userId: args.userId, tier: args.tier, paidThrough: args.paidThrough ?? null };
}

/**
 * Revoke a tier on behalf of a PayPal subscription — but only if PayPal is
 * the one that granted it. See this file's header for why both guards are
 * needed and why the markers are cleared.
 */
export async function revokePaypalTier(
    admin: AdminClient,
    args: {
        userId: string;
        subscriptionId: string;
        paypalStatus?: string | null;
        currentPeriodEnd?: string | null;
    },
): Promise<EntitlementOutcome> {
    const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(args.userId);
    if (lookupError || !existing?.user) {
        logger.error("PayPalWebhook", `No such user ${args.userId} for subscription ${args.subscriptionId}`);
        return { action: "ignored", reason: "user-not-found" };
    }

    const metadata = (existing.user.app_metadata ?? {}) as Record<string, unknown>;

    // GUARD 0 — HAVE THEY ALREADY PAID FOR TIME THEY HAVE NOT HAD?
    //
    // First, because it outranks everything below it. PayPal fires
    // BILLING.SUBSCRIPTION.EXPIRED the moment a fixed-term agreement
    // completes, which can be the same second as its final successful
    // charge. The agreement is over; the month it just bought is not.
    // Nothing downstream can tell those apart, so this does, once, here.
    //
    // A member with no clock — every open-ended subscriber on the site —
    // sails straight past: paidThroughMs returns null and the guard does
    // not fire. Only a refund is allowed to ignore this, and it goes
    // through endPrepaidTerm instead of coming through here at all.
    const paidThrough = paidThroughMs(metadata);
    if (paidThrough !== null && paidThrough > Date.now()) {
        logger.error(
            "PayPalWebhook",
            `Ignoring revoke for ${args.userId}: paid through ${String(metadata[PAID_THROUGH_KEY])}`,
            { subscriptionId: args.subscriptionId, status: args.paypalStatus },
        );
        return { action: "ignored", reason: "paid-through-in-future" };
    }

    // GUARD 1 — is this the subscription that bought the current tier?
    if (metadata.paypal_subscription_id !== args.subscriptionId) {
        logger.error(
            "PayPalWebhook",
            `Ignoring revoke for ${args.subscriptionId}: not the subscription on file for ${args.userId}`,
        );
        return { action: "ignored", reason: "not-the-granting-subscription" };
    }

    // GUARD 2 — is the tier in force still the one PayPal granted? If
    // something else (Stripe, an admin) has written a different tier
    // since, this event is stale and must not touch it.
    if (metadata.paypal_tier && metadata.tier !== metadata.paypal_tier) {
        logger.error(
            "PayPalWebhook",
            `Ignoring revoke for ${args.userId}: current tier ${String(metadata.tier)} was not granted by PayPal`,
        );
        return { action: "ignored", reason: "tier-not-granted-by-paypal" };
    }

    // Clear the markers as we downgrade. `undefined` would survive the
    // spread, so the keys are destructured out. The clock goes too: we
    // only reach this line when it has already run out (guard 0), and a
    // spent date left lying next to a free tier is just something for a
    // future reader to misinterpret.
    const {
        paypal_subscription_id: _droppedId,
        paypal_tier: _droppedTier,
        [PAID_THROUGH_KEY]: _droppedClock,
        ...rest
    } = metadata;

    const { error: writeError } = await admin.auth.admin.updateUserById(args.userId, {
        app_metadata: { ...rest, tier: "free" },
    });

    if (writeError) {
        logger.error("PayPalWebhook", `Failed to revoke tier for ${args.userId}`, writeError);
        return { action: "failed", error: "tier-write-failed" };
    }

    await mirrorPaypalState(admin, {
        userId: args.userId,
        tier: "free",
        status: toMirrorStatus(args.paypalStatus, false),
        currentPeriodEnd: args.currentPeriodEnd,
        paypalSubscriptionId: args.subscriptionId,
        // Only worth clearing if there was something to clear. See the
        // same reasoning in grantPaypalTier.
        paidThrough: _droppedClock != null ? null : undefined,
    });

    logger.error("PayPalWebhook", `User ${args.userId} tier revoked to free via PayPal`, {
        subscriptionId: args.subscriptionId,
        status: args.paypalStatus,
    });

    // Tell them WHY, and say the useful thing.
    //
    // The members this path exists for are the ones paying from a PayPal
    // balance built up selling horses. PayPal's Subscriptions API does not
    // fall back to another instrument when a renewal comes up short — it
    // retries, then suspends. So a balance that dips below the price is a
    // silent churn: the member simply stops having Pro and never learns
    // that topping up a few dollars would have kept it. A suspension is
    // reversible, so this is worth an explanation.
    try {
        // createNotification is server-only: dynamic import inside
        // try/catch so a notify failure can never break billing.
        const { createNotification } = await import("@/lib/notifications/createNotification");
        const suspended = (args.paypalStatus ?? "").toUpperCase() === "SUSPENDED";
        await createNotification({
            userId: args.userId,
            type: "billing_subscription_ended",
            content: suspended
                ? "PayPal couldn't collect your Model Horse Hub subscription, so it's paused. This usually means the PayPal balance or card behind it came up short — top it up and the subscription picks up where it left off."
                : "Your PayPal subscription to Model Horse Hub has ended. Your horses, photos and records are all still here, and you can resubscribe any time.",
            linkUrl: "/upgrade",
        });
    } catch (err) {
        logger.error("PayPalWebhook", "Subscription-ended notice failed to send", err);
    }

    return { action: "revoked", userId: args.userId };
}

// ══════════════════════════════════════════════════════════════════
// PREPAID TERMS
//
// One charge, N months, nothing renews. The money has already moved by
// the time anything below runs — a capture is not a promise, it is a
// completed payment — so the job here is narrower than a subscription's
// and the failure modes are different:
//
//   · NEVER apply the same capture twice. A subscription grant is
//     naturally idempotent because it writes absolute values; a term is
//     not, because it ADDS months. Replay protection has to be real.
//   · Buying a second term while one is running EXTENDS it. Someone with
//     two months left who buys six has eight, not six.
// ══════════════════════════════════════════════════════════════════

/**
 * Atomically claim a capture id, once migration 185 exists.
 *
 * "first"     — nobody has this capture; go ahead and grant.
 * "duplicate" — someone else has it and finished; do nothing.
 * "unknown"   — 185 is not pasted, or the ledger errored. The caller
 *               falls back to the capture-id list in app_metadata, which
 *               is durable and correct for every sequential replay. What
 *               it cannot cover is two deliveries landing inside the same
 *               few hundred milliseconds (the return leg racing the
 *               webhook), where both would read the list before either
 *               wrote it. Pasting 185 closes that window; until then the
 *               worst case is one member getting a longer term than they
 *               paid for, which is the right direction to be wrong in.
 *
 * A ledger error never returns "duplicate": refusing to grant a term
 * somebody has already been charged for is far worse than the race it
 * would be protecting against.
 */
async function claimCapture(
    admin: AdminClient,
    args: { captureId: string; userId: string; orderId: string | null; months: number },
): Promise<"first" | "duplicate" | "unknown"> {
    try {
        const { data, error } = await metricsDb(admin).rpc("claim_paypal_capture", {
            p_capture_id: args.captureId,
            p_user_id: args.userId,
            p_order_id: args.orderId,
            p_months: args.months,
        });
        if (error) {
            if (!isMissingRevenueSchema(error)) {
                logger.error("PayPalPrepaid", "Capture ledger errored — falling back to metadata", error);
            }
            return "unknown";
        }
        return data === false ? "duplicate" : "first";
    } catch (err) {
        logger.error("PayPalPrepaid", "Capture ledger threw — falling back to metadata", err);
        return "unknown";
    }
}

/** Close the ledger row out. Best effort: the grant has already landed. */
async function markCaptureApplied(
    admin: AdminClient,
    captureId: string,
    paidThrough: string,
): Promise<void> {
    try {
        const { error } = await metricsDb(admin).rpc("mark_paypal_capture_applied", {
            p_capture_id: captureId,
            p_paid_through: paidThrough,
        });
        if (error && !isMissingRevenueSchema(error)) {
            logger.error("PayPalPrepaid", `Could not mark capture ${captureId} applied`, error);
        }
    } catch (err) {
        logger.error("PayPalPrepaid", `Marking capture ${captureId} applied threw`, err);
    }
}

/**
 * Grant a prepaid term: tier now, ending `months` from the later of now
 * and whatever the member has already paid for.
 *
 * IDEMPOTENCY, in the order the checks fire:
 *
 *   1. The capture id is already in app_metadata → this exact payment has
 *      already bought its months. Return without touching anything. This
 *      is the check that matters, because it is the one that is true
 *      whether or not any migration has been pasted, and it is decided
 *      against the same record the grant itself writes.
 *   2. The 185 ledger says duplicate AND metadata agrees it is unknown →
 *      a concurrent delivery is mid-flight. Stand down.
 *
 * A ledger that says "duplicate" while metadata has never heard of the
 * capture is the signature of an earlier attempt that claimed and then
 * failed to write. That one DOES proceed — see the reclaim window in
 * migration 185, which is what makes the claim recoverable rather than a
 * one-shot that can swallow a paid-for term.
 */
export async function grantPrepaidTerm(
    admin: AdminClient,
    args: {
        userId: string;
        tier: PaidTier;
        months: number;
        /** The capture — the payment itself. The idempotency key. */
        captureId: string;
        orderId?: string | null;
        /** Injectable for tests; defaults to now. */
        now?: number;
    },
): Promise<EntitlementOutcome> {
    const now = args.now ?? Date.now();

    const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(args.userId);
    if (lookupError || !existing?.user) {
        logger.error("PayPalPrepaid", `No such user ${args.userId} for capture ${args.captureId}`);
        return { action: "ignored", reason: "user-not-found" };
    }

    const priorMetadata = (existing.user.app_metadata ?? {}) as Record<string, unknown>;
    const applied = rememberedCaptures(priorMetadata);

    // ── 1. Already bought its months ──
    if (applied.includes(args.captureId)) {
        logger.error("PayPalPrepaid", `Capture ${args.captureId} already applied for ${args.userId}`);
        return { action: "ignored", reason: "capture-already-applied" };
    }

    // ── 2. Somebody else is holding the claim right now ──
    const claim = await claimCapture(admin, {
        captureId: args.captureId,
        userId: args.userId,
        orderId: args.orderId ?? null,
        months: args.months,
    });
    if (claim === "duplicate") {
        logger.error("PayPalPrepaid", `Capture ${args.captureId} claimed elsewhere — standing down`);
        return { action: "ignored", reason: "capture-claimed-elsewhere" };
    }

    // ── The stacking rule lives in the clock, not here ──
    const paidThrough = extendedPaidThrough(priorMetadata, args.months, now);

    const nextCaptures = [...applied, args.captureId].slice(-MAX_REMEMBERED_CAPTURES);

    const { error: writeError } = await admin.auth.admin.updateUserById(args.userId, {
        // MERGE, for the same reason grantPaypalTier merges: is_suspended
        // and every other key live in here too.
        app_metadata: {
            ...priorMetadata,
            tier: args.tier,
            [PAID_THROUGH_KEY]: paidThrough,
            [PREPAID_ORDER_KEY]: args.orderId ?? null,
            [PREPAID_CAPTURES_KEY]: nextCaptures,
            [PREPAID_TIER_KEY]: args.tier,
        },
    });

    if (writeError) {
        // 500 upstream so PayPal retries. The member has been charged;
        // losing the grant here would be losing their money.
        logger.error("PayPalPrepaid", `Failed to grant ${args.tier} term to ${args.userId}`, writeError);
        return { action: "failed", error: "term-write-failed" };
    }

    await markCaptureApplied(admin, args.captureId, paidThrough);

    await mirrorPaypalState(admin, {
        userId: args.userId,
        tier: args.tier,
        status: "active",
        currentPeriodEnd: paidThrough,
        paypalSubscriptionId: null,
        paidThrough,
    });

    logger.error("PayPalPrepaid", `User ${args.userId} bought a ${args.months}-month ${args.tier} term`, {
        captureId: args.captureId,
        paidThrough,
    });

    // Say the two things she actually wants to hear: when it ends, and
    // that nothing is going to charge her again.
    try {
        // createNotification is server-only: dynamic import inside
        // try/catch so a notify failure can never break billing.
        const { createNotification } = await import("@/lib/notifications/createNotification");
        const until = formatPaidThrough(paidThrough);
        const stacked = applied.length > 0 && paidThroughMs(priorMetadata) !== null;
        await createNotification({
            userId: args.userId,
            type: "billing_term_started",
            content:
                `${args.tier === "studio" ? "Studio Pro" : "MHH Pro"} is yours` +
                (until ? ` through ${until}` : ` for ${args.months} months`) +
                (stacked ? " — your new months were added on to the time you already had." : ".") +
                " This was a one-off payment: nothing renews and nothing will be charged again.",
            linkUrl: "/upgrade",
        });
    } catch (err) {
        logger.error("PayPalPrepaid", "Term-started notice failed to send", err);
    }

    return { action: "granted", userId: args.userId, tier: args.tier, paidThrough };
}

/**
 * End a prepaid term because the money went back.
 *
 * The one path allowed to ignore `paid_through`, and it is allowed
 * because a refunded member is not a member who paid — the premise guard
 * 0 protects no longer holds. That exception is why this is its own
 * function rather than a flag on revokePaypalTier: a boolean called
 * `force` would eventually be passed by something that should not have.
 *
 * It keeps the shape of the invariant it is exempt from. A refund may
 * only end a term the PREPAID path granted:
 *
 *   · the refunded capture must be one we applied, and
 *   · the tier in force must still be the one that capture bought.
 *
 * So a refund on an old, already-superseded purchase cannot strip a
 * member of a subscription or a term they have since bought, and a
 * partial refund of an unrelated payment cannot touch membership at all.
 */
export async function endPrepaidTerm(
    admin: AdminClient,
    args: {
        userId: string;
        /** The capture that was refunded, reversed or denied. */
        captureId: string;
        /** REFUNDED | REVERSED | DENIED — for the log and the notice. */
        reason: string;
    },
): Promise<EntitlementOutcome> {
    const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(args.userId);
    if (lookupError || !existing?.user) {
        logger.error("PayPalPrepaid", `No such user ${args.userId} for refund of ${args.captureId}`);
        return { action: "ignored", reason: "user-not-found" };
    }

    const metadata = (existing.user.app_metadata ?? {}) as Record<string, unknown>;

    // GUARD 1 — did the prepaid path grant anything for this capture?
    if (!rememberedCaptures(metadata).includes(args.captureId)) {
        logger.error(
            "PayPalPrepaid",
            `Ignoring ${args.reason} of ${args.captureId}: not a capture that bought a term for ${args.userId}`,
        );
        return { action: "ignored", reason: "not-a-granting-capture" };
    }

    // GUARD 2 — is the tier in force still the one that capture bought?
    const prepaidTier = metadata[PREPAID_TIER_KEY];
    if (prepaidTier && metadata.tier !== prepaidTier) {
        logger.error(
            "PayPalPrepaid",
            `Ignoring ${args.reason} for ${args.userId}: current tier ${String(metadata.tier)} was not bought by this term`,
        );
        return { action: "ignored", reason: "tier-not-granted-by-term" };
    }

    const {
        [PAID_THROUGH_KEY]: _droppedClock,
        [PREPAID_ORDER_KEY]: _droppedOrder,
        [PREPAID_TIER_KEY]: _droppedTier,
        ...rest
    } = metadata;

    const { error: writeError } = await admin.auth.admin.updateUserById(args.userId, {
        app_metadata: {
            ...rest,
            tier: "free",
            // The capture id list SURVIVES. It is the replay guard, and
            // clearing it would let a redelivered PAYMENT.CAPTURE.COMPLETED
            // for the very capture we just refunded buy the term all over
            // again — for money that has already gone back.
            [PREPAID_CAPTURES_KEY]: rememberedCaptures(metadata),
        },
    });

    if (writeError) {
        logger.error("PayPalPrepaid", `Failed to end term for ${args.userId}`, writeError);
        return { action: "failed", error: "term-write-failed" };
    }

    await mirrorPaypalState(admin, {
        userId: args.userId,
        tier: "free",
        status: "canceled",
        currentPeriodEnd: null,
        paypalSubscriptionId: null,
        paidThrough: null,
    });

    logger.error("PayPalPrepaid", `Term ended for ${args.userId} after ${args.reason}`, {
        captureId: args.captureId,
    });

    try {
        // createNotification is server-only: dynamic import inside
        // try/catch so a notify failure can never break billing.
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({
            userId: args.userId,
            type: "billing_term_ended",
            content:
                "Your prepaid Model Horse Hub membership has been refunded, so it has ended. " +
                "Your horses, photos and records are all still here, and you can buy another term any time.",
            linkUrl: "/upgrade",
        });
    } catch (err) {
        logger.error("PayPalPrepaid", "Term-ended notice failed to send", err);
    }

    return { action: "revoked", userId: args.userId };
}
