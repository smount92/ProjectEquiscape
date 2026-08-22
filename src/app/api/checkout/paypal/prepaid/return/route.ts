import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { paypalPathLive } from "@/lib/paypal/flag";
import { termByKey, TERM_CURRENCY } from "@/lib/billing/terms";
import {
    captureMatchesPrice,
    captureOrder,
    completedCaptureOf,
    getOrder,
    orderCustomId,
} from "@/lib/paypal/orders";
import { grantPrepaidTerm } from "@/lib/paypal/entitlement";
import { logger } from "@/lib/logger";

// ============================================================
// GET /api/checkout/paypal/prepaid/return — where PayPal sends a
// prepaid buyer back, and WHERE THE MONEY IS ACTUALLY TAKEN.
//
// This is not the subscription return leg with a different name. That
// one confirms something PayPal has already done. This one DOES the
// thing: an approved order has charged nobody, and stays that way until
// somebody calls capture. If this route only looked and did not capture,
// every member who bought a term would go home unbilled and unentitled.
//
// WHAT MAKES IT SAFE. It trusts nothing in the redirect. `token` is
// attacker-controlled, so it is used only to ask PayPal — over the
// authenticated REST API — what that order is. Money moves only when
// PayPal itself says the order belongs to this signed-in member, names a
// term we sell, and is for that term's exact price.
//
// It shares grantPrepaidTerm with the webhook, and both are keyed on the
// capture id, so whichever arrives first grants and the other is a
// no-op. The member never gets two terms for one payment.
//
// DELIBERATELY NOT GATED on NEXT_PUBLIC_PREPAID_TERMS: if the flag is
// switched off while somebody is mid-approval, the honest thing is to
// finish what they started, not to strand a payment.
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
    // Orders v2 returns the order id as `token`. `orderId` is accepted
    // too, because PayPal has used both across versions of this flow.
    const orderId = url.searchParams.get("token") ?? url.searchParams.get("orderId");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return redirectTo("/login?redirectTo=/upgrade");
    }

    if (!orderId) {
        // Came back with no order — an abandoned approval, not an error.
        return redirectTo("/upgrade?status=cancelled");
    }

    try {
        const order = await getOrder(orderId);

        // The order must belong to the member standing here. Without
        // this, anyone could paste someone else's order id.
        const custom = orderCustomId(order);
        if (custom?.userId !== user.id) {
            logger.error(
                "PayPalPrepaidReturn",
                `Order ${orderId} does not belong to ${user.id} — capturing nothing`,
            );
            return redirectTo("/upgrade?status=paypal-pending");
        }

        const term = termByKey(custom.termKey);
        if (!term) {
            logger.error("PayPalPrepaidReturn", `Order ${orderId} names an unrecognised term`);
            return redirectTo("/upgrade?status=paypal-pending");
        }

        const status = (order.status ?? "").toUpperCase();

        // VOIDED or still awaiting the payer means there is nothing to
        // capture. Say so rather than charging into an error.
        if (status === "VOIDED" || status === "CREATED" || status === "PAYER_ACTION_REQUIRED") {
            logger.error("PayPalPrepaidReturn", `Order ${orderId} is ${status} — nothing to capture`);
            return redirectTo("/upgrade?status=cancelled");
        }

        // COMPLETED means somebody already captured — almost certainly
        // the webhook, moments ago. Read that capture rather than making
        // another; captureOrder would handle it too, but there is no
        // reason to send PayPal a request we know the answer to.
        const capture =
            status === "COMPLETED" ? completedCaptureOf(order) : await captureOrder(orderId);

        if (!capture?.id) {
            logger.error("PayPalPrepaidReturn", `Order ${orderId} produced no readable capture`);
            return redirectTo("/upgrade?status=paypal-pending");
        }

        // The same cent-exact check the webhook makes. An order created
        // server-side cannot be for the wrong amount, so a mismatch here
        // means something we do not understand happened — and the answer
        // to that is never "grant the membership anyway".
        if (!captureMatchesPrice(capture, term.prepaidPrice, TERM_CURRENCY)) {
            logger.error("PayPalPrepaidReturn", `Capture for ${orderId} did not match ${term.key}`);
            return redirectTo("/upgrade?status=paypal-pending");
        }

        const outcome = await grantPrepaidTerm(getAdminClient(), {
            userId: user.id,
            tier: term.tier,
            months: term.months,
            captureId: capture.id,
            orderId,
        });

        // "granted" is this call doing it; "ignored" for an already
        // applied capture is the webhook having beaten us to it. Both
        // mean the member has their term, so both land on success.
        const done =
            outcome.action === "granted" ||
            (outcome.action === "ignored" && outcome.reason === "capture-already-applied");

        if (!done) {
            return redirectTo("/upgrade?status=paypal-pending");
        }

        return redirectTo(
            term.tier === "studio"
                ? "/studio/dashboard?upgraded=success"
                : "/upgrade?status=term-success",
        );
    } catch (err) {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(err, {
            tags: { domain: "commerce", provider: "paypal" },
            level: "error",
            extra: { orderId },
        });
        // Money code fails closed: we could not confirm, so we grant
        // nothing and say so honestly. The webhook remains the backstop —
        // and it will capture the order if we did not.
        return redirectTo("/upgrade?status=paypal-pending");
    }
}
