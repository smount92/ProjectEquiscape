import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSupporterBadge } from "@/lib/supporter";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";

// POST /api/checkout/supporter — annual "keep the lights on" contribution.
// Cosmetic recognition only (brass plaque + optional ledger line); it unlocks
// nothing and is orthogonal to the pro/studio tier. Price (amount + yearly
// interval) lives entirely in Stripe via STRIPE_SUPPORTER_PRICE_ID; when that
// env is unset the Supporter card never renders and this route just 500s with
// a friendly message. Mirrors /api/checkout/studio-pro.
export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const priceId = process.env.STRIPE_SUPPORTER_PRICE_ID;
    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json(
            { error: "The Supporter tier is not yet configured. Contact support." },
            { status: 500 }
        );
    }

    // Prevent double-subscription. Best-effort UX guard (reads via the user
    // client and tolerates a not-yet-applied migration) — the flag itself is
    // only ever written by the verified Stripe webhook.
    const badge = await fetchSupporterBadge(supabase, user.id);
    if (badge.isSupporter) {
        return NextResponse.json(
            { error: "You're already a Supporter — thank you for keeping the lights on!" },
            { status: 400 }
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
                type: "supporter",
                supabase_user_id: user.id,
            },
            // Stamped onto the subscription itself so customer.subscription.*
            // events are routed to supporter handling (and NEVER to the
            // pro/studio tier logic) without a customer-id lookup.
            subscription_data: {
                metadata: {
                    type: "supporter",
                    supabase_user_id: user.id,
                },
            },
            success_url: `${appUrl}/upgrade?status=supporter-success`,
            cancel_url: `${appUrl}/upgrade?status=cancelled`,
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
