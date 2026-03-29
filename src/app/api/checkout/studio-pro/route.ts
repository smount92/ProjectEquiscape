import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";

// POST /api/checkout/studio-pro — Studio Pro artist subscription ($9.99/mo)
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
            client_reference_id: user.id,
            customer_email: user.email,
            metadata: {
                type: "studio_pro",
                supabase_user_id: user.id,
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
