import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";

// POST /api/checkout/studio-pro — Studio Pro artist subscription ($10/mo)
export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prevent double-subscription
    const tier = await getUserTier();
    if ((tier as string) === "studio") {
        return NextResponse.json(
            { error: "You're already on Studio Pro!" },
            { status: 400 }
        );
    }

    // A tier bought through PayPal is billed by PayPal. Starting a Stripe
    // subscription on top of it would charge the member twice, in two
    // systems, with no way for either side to know about the other — and
    // the tier field can only record one of them. Send them to cancel the
    // PayPal one first rather than quietly taking a second payment.
    if ((user.app_metadata as Record<string, unknown> | undefined)?.paypal_subscription_id) {
        return NextResponse.json(
            {
                error: "Your subscription is currently billed through PayPal. Cancel that one first, then you can subscribe here — otherwise you'd be charged twice.",
            },
            { status: 400 }
        );
    }

    const priceId = process.env.STRIPE_STUDIO_PRO_PRICE_ID;
    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json(
            { error: "Studio Pro is not yet configured. Contact support." },
            { status: 500 }
        );
    }

    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2026-02-25.clover",
        });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            client_reference_id: user.id,
            customer_email: user.email,
            metadata: {
                type: "studio_pro",
                supabase_user_id: user.id,
            },
            // CRITICAL: stamp the SUBSCRIPTION too (the session metadata
            // above never rides on customer.subscription.* events). Without
            // this, every renewal fell into the generic pro branch and
            // silently downgraded studio -> pro while still charging $10
            // (audit Part 2, market M1). Mirrors the supporter checkout.
            subscription_data: {
                metadata: {
                    type: "studio_pro",
                    supabase_user_id: user.id,
                },
            },
            success_url: `${appUrl}/studio/dashboard?upgraded=success`,
            cancel_url: `${appUrl}/upgrade`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "commerce" } });
        return NextResponse.json(
            { error: "Failed to create checkout session." },
            { status: 500 }
        );
    }
}
