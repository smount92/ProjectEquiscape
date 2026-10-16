import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Stripe's billing portal for the signed-in member (MHH-023): update the
 * card, see invoices, cancel. A member with a failing card had nowhere on
 * the site to fix it. The portal itself is configured in the Stripe
 * dashboard (Settings › Billing › Customer portal).
 */
export async function POST() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please log in to do that." }, { status: 401 });

    const customerId = (user.app_metadata as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    if (!customerId) {
        return NextResponse.json({ error: "There is no card on file for this account." }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${appUrl}/settings#subscription`,
        });
        return NextResponse.json({ url: session.url });
    } catch (err) {
        logger.error("BillingPortal", "Could not open the Stripe billing portal", err);
        return NextResponse.json(
            { error: "The billing page couldn't open just now. Please try again in a minute." },
            { status: 502 },
        );
    }
}
