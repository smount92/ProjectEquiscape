import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier, isPro } from "@/lib/auth";
import { paypalPathLive } from "@/lib/paypal/flag";
import { prepaidTermsEnabled, termByKey, termPlanId } from "@/lib/billing/terms";
import { createPrepaidOrder } from "@/lib/paypal/orders";
import { createSubscription } from "@/lib/paypal/subscriptions";
import { logger } from "@/lib/logger";

// ============================================================
// POST /api/checkout/paypal/prepaid — buy a time-boxed membership
//
// Two products behind one route, because to the member they are two
// buttons on the same card and the difference is one word of copy:
//
//   mode "prepaid"  → ONE PayPal charge (Orders v2). No agreement, no
//                     stored authorization, nothing to cancel. Access
//                     ends on a date and they are never charged again.
//                     This is the thing the customer asked for.
//   mode "fixed"    → an ordinary subscription with total_cycles set, so
//                     it bills monthly and stops by itself.
//
// NOTHING IS CHARGED HERE. The prepaid order is created unapproved and
// uncaptured — see lib/paypal/orders.ts on why approval alone is not
// money. The fixed-term subscription is created in APPROVAL_PENDING
// exactly like the open-ended one.
//
// Body: { "term": "pro-6", "mode": "prepaid" | "fixed" }
// ============================================================

type CheckoutMode = "prepaid" | "fixed";

function isMode(value: unknown): value is CheckoutMode {
    return value === "prepaid" || value === "fixed";
}

export async function POST(request: Request) {
    // THREE gates, all of which must hold. The PayPal path has to be
    // live (flag + credentials) and time-boxed terms have to be switched
    // on. Any of them missing ⇒ this route does not exist, which is
    // precisely how the site behaves today.
    if (!paypalPathLive() || !prepaidTermsEnabled()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let termKey: string;
    let mode: CheckoutMode;
    try {
        const body = (await request.json()) as { term?: unknown; mode?: unknown };
        if (typeof body?.term !== "string") {
            return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
        }
        termKey = body.term;
        mode = isMode(body?.mode) ? body.mode : "prepaid";
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // A term is only sellable if it is in config/membership-terms.json.
    const term = termByKey(termKey);
    if (!term) {
        return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }

    // ── Double-purchase guard ──
    //
    // The same stance as /api/checkout and /api/checkout/paypal: `tier`
    // is the single tier of record, so somebody already paying — by
    // card, by PayPal subscription, or on a term they have not used up —
    // is turned away here rather than paying twice.
    //
    // getUserTier() applies the entitlement clock, so a member whose
    // term ran out yesterday reads as `free` and is free to buy another.
    // That is the renewal path for a product with no renewals.
    const tier = await getUserTier();
    if (term.tier === "pro" && isPro(tier)) {
        return NextResponse.json(
            {
                error:
                    tier === "studio"
                        ? "Studio Pro already includes everything in MHH Pro!"
                        : "You're already on MHH Pro — buy another term when this one runs out and we'll add the months on.",
            },
            { status: 400 },
        );
    }
    if (term.tier === "studio" && (tier as string) === "studio") {
        return NextResponse.json({ error: "You're already on Studio Pro!" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    try {
        if (mode === "fixed") {
            // A fixed-term subscription needs a PayPal plan the owner has
            // created. Until that id is configured the option is not
            // offered in the UI at all, so reaching this is either a
            // hand-crafted request or a half-finished setup.
            const planId = termPlanId(term);
            if (!planId) {
                return NextResponse.json(
                    { error: "That payment plan isn't set up yet. Contact support." },
                    { status: 500 },
                );
            }

            const { id, approveUrl } = await createSubscription({
                plan: term.tier,
                planIdOverride: planId,
                userId: user.id,
                userEmail: user.email,
                // The ordinary subscription return leg handles this: a
                // fixed-term subscription IS a subscription, and its
                // plan id is what tells the grant path it ends.
                returnUrl: `${appUrl}/api/checkout/paypal/return?plan=${term.tier}`,
                cancelUrl: `${appUrl}/upgrade?status=cancelled`,
            });

            logger.error("PayPalCheckout", `Created fixed-term subscription for ${user.id}`, {
                term: term.key,
                subscriptionId: id,
            });
            return NextResponse.json({ url: approveUrl });
        }

        const { id, approveUrl } = await createPrepaidOrder({
            term,
            userId: user.id,
            // The return leg is what CAPTURES — nothing is charged until
            // it (or the webhook backstop) runs.
            returnUrl: `${appUrl}/api/checkout/paypal/prepaid/return`,
            cancelUrl: `${appUrl}/upgrade?status=cancelled`,
        });

        logger.error("PayPalCheckout", `Created prepaid order for ${user.id}`, {
            term: term.key,
            orderId: id,
        });

        return NextResponse.json({ url: approveUrl });
    } catch (err) {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(err, {
            tags: { domain: "commerce", provider: "paypal" },
            level: "error",
            extra: { term: term.key, mode },
        });
        return NextResponse.json({ error: "Failed to start PayPal checkout." }, { status: 500 });
    }
}
