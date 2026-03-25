import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// ============================================================
// POST /api/checkout — Create a Stripe Checkout Session
// Redirects user to Stripe's hosted checkout page
// ============================================================

export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRO_PRICE_ID;

    if (!stripeKey || !priceId) {
        return NextResponse.json(
            { error: "Stripe is not configured. Contact support." },
            { status: 500 }
        );
    }

    const stripe = new Stripe(stripeKey, {
        apiVersion: "2026-02-25.clover",
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            // Uses whatever payment methods you've enabled in Stripe Dashboard
            // (card, PayPal, Apple Pay, Google Pay, etc.)
            line_items: [{ price: priceId, quantity: 1 }],
            // This is the critical link — maps Stripe customer back to Supabase user
            client_reference_id: user.id,
            customer_email: user.email,
            success_url: `${appUrl}/upgrade?status=success`,
            cancel_url: `${appUrl}/upgrade?status=cancelled`,
            metadata: {
                supabase_user_id: user.id,
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        console.error("Stripe checkout error:", err);
        return NextResponse.json(
            { error: "Failed to create checkout session." },
            { status: 500 }
        );
    }
}
