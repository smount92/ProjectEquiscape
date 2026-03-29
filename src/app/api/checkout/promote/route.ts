import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";

// POST /api/checkout/promote — Promote a listing for 7 days ($2.99)
export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { horseId } = await request.json();
    if (!horseId) {
        return NextResponse.json({ error: "Missing horseId" }, { status: 400 });
    }

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();

    if (!horse) {
        return NextResponse.json({ error: "Horse not found or not yours" }, { status: 404 });
    }

    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: "2026-02-25.clover",
        });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `Promote: ${(horse as { custom_name: string }).custom_name}`,
                        description: "7-day promoted listing in marketplace and grids",
                    },
                    unit_amount: 299, // $2.99
                },
                quantity: 1,
            }],
            client_reference_id: user.id,
            metadata: {
                type: "promote_listing",
                horse_id: horseId,
                supabase_user_id: user.id,
            },
            success_url: `${appUrl}/stable/${horseId}?promoted=success`,
            cancel_url: `${appUrl}/stable/${horseId}`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "commerce" } });
        return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
}
