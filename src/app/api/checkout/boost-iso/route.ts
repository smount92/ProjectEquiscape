import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";

// POST /api/checkout/boost-iso — Boost an ISO/wanted post for 48 hours ($1.99)
export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { wishlistItemId } = await request.json();
    if (!wishlistItemId) {
        return NextResponse.json({ error: "Missing wishlistItemId" }, { status: 400 });
    }

    // Verify ownership
    const { data: item } = await supabase
        .from("user_wishlists")
        .select("id, notes")
        .eq("id", wishlistItemId)
        .eq("user_id", user.id)
        .single();

    if (!item) {
        return NextResponse.json({ error: "Wishlist item not found or not yours" }, { status: 404 });
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
                        name: "Boost ISO Listing",
                        description: "48-hour pinned ISO in the Activity Feed",
                    },
                    unit_amount: 199, // $1.99
                },
                quantity: 1,
            }],
            client_reference_id: user.id,
            metadata: {
                type: "boost_iso",
                wishlist_item_id: wishlistItemId,
                supabase_user_id: user.id,
            },
            success_url: `${appUrl}/wishlist?boosted=success`,
            cancel_url: `${appUrl}/wishlist`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "commerce" } });
        return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
}
