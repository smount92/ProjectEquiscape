import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

// ============================================================
// Stripe Webhook Handler
// Processes subscription events for MHH Pro tier management
//
// Required env vars:
//   STRIPE_SECRET_KEY - Stripe secret API key
//   STRIPE_WEBHOOK_SECRET - Webhook endpoint signing secret
// ============================================================

export async function POST(request: NextRequest) {
    // Dynamically import Stripe (only needed in this route)
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2026-02-25.clover",
    });

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
    }

    let event: import("stripe").Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "stripe" }, level: "error" });
        logger.error("StripeWebhook", "Signature verification failed", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const admin = getAdminClient();

    try {
        switch (event.type) {
            // ── New subscription or upgrade ──
            case "checkout.session.completed": {
                const session = event.data.object as import("stripe").Stripe.Checkout.Session;
                const userId = session.client_reference_id;
                const metadata = session.metadata || {};

                if (!userId) {
                    logger.error("StripeWebhook", "checkout.session.completed missing client_reference_id", { sessionId: session.id });
                    break;
                }

                // ── Route by metadata.type ──
                if (metadata.type === "promote_listing") {
                    const promotedUntil = new Date();
                    promotedUntil.setDate(promotedUntil.getDate() + 7);
                    await (admin
                        .from("user_horses") as any)
                        .update({ is_promoted_until: promotedUntil.toISOString() })
                        .eq("id", metadata.horse_id);
                    logger.error("StripeWebhook", `Horse ${metadata.horse_id} promoted until ${promotedUntil.toISOString()}`);

                } else if (metadata.type === "boost_iso") {
                    const boostedUntil = new Date();
                    boostedUntil.setHours(boostedUntil.getHours() + 48);
                    await (admin
                        .from("user_wishlists") as any)
                        .update({ is_boosted_until: boostedUntil.toISOString() })
                        .eq("id", metadata.wishlist_item_id);
                    logger.error("StripeWebhook", `ISO ${metadata.wishlist_item_id} boosted until ${boostedUntil.toISOString()}`);

                } else if (metadata.type === "insurance_report") {
                    await (admin.from("purchased_reports" as any) as any).insert({
                        user_id: metadata.supabase_user_id,
                        horse_id: metadata.horse_id,
                        report_type: "insurance",
                    });
                    logger.error("StripeWebhook", `Insurance report purchased for horse ${metadata.horse_id}`);

                } else if (metadata.type === "studio_pro") {
                    await admin.auth.admin.updateUserById(userId, {
                        app_metadata: {
                            tier: "studio",
                            stripe_customer_id: session.customer as string,
                        },
                    });
                    logger.error("StripeWebhook", `User ${userId} upgraded to Studio Pro`);

                } else {
                    // Default: MHH Pro subscription upgrade
                    await admin.auth.admin.updateUserById(userId, {
                        app_metadata: { tier: "pro", stripe_customer_id: session.customer as string },
                    });
                    logger.error("StripeWebhook", `User ${userId} upgraded to Pro`, { sessionId: session.id });
                }
                break;
            }

            // ── Subscription status change ──
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object as import("stripe").Stripe.Subscription;
                const customerId = subscription.customer as string;

                // Look up user by stored stripe_customer_id in app_metadata
                // We need to find the user — iterate auth users (admin API)
                const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
                const user = users?.users?.find(
                    (u) => u.app_metadata?.stripe_customer_id === customerId
                );

                if (!user) {
                    logger.error("StripeWebhook", `No user found for Stripe customer ${customerId}`);
                    break;
                }

                const isActive = subscription.status === "active" || subscription.status === "trialing";
                await admin.auth.admin.updateUserById(user.id, {
                    app_metadata: {
                        ...user.app_metadata,
                        tier: isActive ? "pro" : "free",
                    },
                });
                logger.error("StripeWebhook", `User ${user.id} tier set to ${isActive ? "pro" : "free"}`, {
                    subscriptionId: subscription.id,
                    status: subscription.status,
                });
                break;
            }

            default:
                // Unhandled event type — log but don't error
                break;
        }
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "stripe", event_type: event.type }, level: "fatal" });
        logger.error("StripeWebhook", `Error processing ${event.type}`, err);
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
