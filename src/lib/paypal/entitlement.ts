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
 */

import type { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { metricsDb } from "@/lib/metrics/db";
import { isMissingRevenueSchema } from "@/lib/metrics/revenue";
import type { SubscriptionStatus } from "@/lib/metrics/revenue";

type AdminClient = ReturnType<typeof getAdminClient>;

export type PaidTier = "pro" | "studio";

/** What a grant/revoke attempt actually did. Returned so routes can log it. */
export type EntitlementOutcome =
    | { action: "granted"; userId: string; tier: PaidTier }
    | { action: "revoked"; userId: string }
    | { action: "ignored"; reason: string }
    | { action: "failed"; error: string };

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
 * Tries the provider-aware RPC from migration 183 first. If 183 has not
 * been pasted yet, falls back to the existing record_subscription_state
 * with NULL Stripe ids — that RPC COALESCEs its id arguments, so the
 * fallback records the tier and status correctly (MRR stays right from day
 * one) without inventing a Stripe id for a PayPal subscription or erasing
 * one that is genuinely there.
 */
async function mirrorPaypalState(
    admin: AdminClient,
    args: {
        userId: string;
        tier: "free" | PaidTier;
        status: SubscriptionStatus;
        currentPeriodEnd?: string | null;
        paypalSubscriptionId?: string | null;
    },
): Promise<void> {
    try {
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
 */
export async function grantPaypalTier(
    admin: AdminClient,
    args: {
        userId: string;
        tier: PaidTier;
        subscriptionId: string;
        paypalStatus?: string | null;
        currentPeriodEnd?: string | null;
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
    const { error: writeError } = await admin.auth.admin.updateUserById(args.userId, {
        app_metadata: {
            ...priorMetadata,
            tier: args.tier,
            paypal_subscription_id: args.subscriptionId,
            paypal_tier: args.tier,
        },
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
    });

    await warnOnDoubleSubscription(admin, args.userId, priorMetadata);

    logger.error("PayPalWebhook", `User ${args.userId} tier set to ${args.tier} via PayPal`, {
        subscriptionId: args.subscriptionId,
    });
    return { action: "granted", userId: args.userId, tier: args.tier };
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
    // spread, so the keys are destructured out.
    const {
        paypal_subscription_id: _droppedId,
        paypal_tier: _droppedTier,
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
