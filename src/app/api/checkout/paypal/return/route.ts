import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { paypalPathLive } from "@/lib/paypal/flag";
import { getSubscription, isEntitlingStatus, planKeyForPlanId, PLAN_TIER } from "@/lib/paypal/subscriptions";
import { grantPaypalTier } from "@/lib/paypal/entitlement";
import { logger } from "@/lib/logger";

// ============================================================
// GET /api/checkout/paypal/return — where PayPal sends the member back
//
// WHY THIS EXISTS. PayPal's redirect happens the moment the member
// approves; BILLING.SUBSCRIPTION.ACTIVATED can arrive seconds later.
// Without this leg the member lands on a success page that is not yet
// true, refreshes, still sees "Free", and opens a support ticket.
//
// WHAT MAKES IT SAFE. It trusts NOTHING in the redirect. The query string
// is attacker-controlled, so the subscription id in it is used only to ask
// PayPal — over the authenticated REST API — what that subscription
// actually is. A tier is granted only when PayPal itself says ACTIVE and
// says the subscription's custom_id is this very signed-in member. That
// is strictly stronger evidence than the webhook has, so this is not a
// weaker second door: it is the same door.
//
// It shares grantPaypalTier with the webhook, which writes absolute
// values, so whichever of the two arrives first wins and the other is a
// no-op.
// ============================================================

function redirectTo(path: string): NextResponse {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";
    return NextResponse.redirect(`${appUrl}${path}`, { status: 303 });
}

export async function GET(request: Request) {
    if (!paypalPathLive()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get("subscription_id");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return redirectTo("/login?redirectTo=/upgrade");
    }

    if (!subscriptionId) {
        // The member came back without an id — treat as an abandoned
        // approval rather than an error.
        return redirectTo("/upgrade?status=cancelled");
    }

    try {
        const subscription = await getSubscription(subscriptionId);

        // The subscription must belong to the member standing here. Without
        // this, anyone could paste someone else's subscription id and claim
        // the tier it bought.
        if (subscription?.custom_id !== user.id) {
            logger.error(
                "PayPalReturn",
                `Subscription ${subscriptionId} does not belong to ${user.id} — refusing to grant`,
            );
            return redirectTo("/upgrade?status=paypal-pending");
        }

        const planKey = planKeyForPlanId(subscription.plan_id);
        if (!planKey) {
            // An unrecognised plan id must never be guessed at.
            logger.error("PayPalReturn", `Subscription ${subscriptionId} has an unrecognised plan id`);
            return redirectTo("/upgrade?status=paypal-pending");
        }

        if (!isEntitlingStatus(subscription.status)) {
            // Approved but not yet charged, or still pending. The webhook
            // will grant when PayPal activates it.
            logger.error("PayPalReturn", `Subscription ${subscriptionId} is ${subscription.status}, not ACTIVE`);
            return redirectTo("/upgrade?status=paypal-pending");
        }

        const tier = PLAN_TIER[planKey];
        const outcome = await grantPaypalTier(getAdminClient(), {
            userId: user.id,
            tier,
            subscriptionId,
            paypalStatus: subscription.status,
            currentPeriodEnd: subscription.billing_info?.next_billing_time ?? null,
        });

        if (outcome.action !== "granted") {
            return redirectTo("/upgrade?status=paypal-pending");
        }

        return redirectTo(
            tier === "studio" ? "/studio/dashboard?upgraded=success" : "/upgrade?status=success",
        );
    } catch (err) {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(err, {
            tags: { domain: "commerce", provider: "paypal" },
            level: "error",
        });
        // Money code fails closed: we could not confirm, so we grant
        // nothing and say so honestly. The webhook remains the backstop.
        return redirectTo("/upgrade?status=paypal-pending");
    }
}
