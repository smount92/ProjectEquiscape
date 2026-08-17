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
                    await admin
                        .from("user_horses")
                        .update({ is_promoted_until: promotedUntil.toISOString() })
                        .eq("id", metadata.horse_id);
                    logger.error("StripeWebhook", `Horse ${metadata.horse_id} promoted until ${promotedUntil.toISOString()}`);

                } else if (metadata.type === "boost_iso") {
                    const boostedUntil = new Date();
                    boostedUntil.setHours(boostedUntil.getHours() + 48);
                    await admin
                        .from("user_wishlists")
                        .update({ is_boosted_until: boostedUntil.toISOString() })
                        .eq("id", metadata.wishlist_item_id);
                    logger.error("StripeWebhook", `ISO ${metadata.wishlist_item_id} boosted until ${boostedUntil.toISOString()}`);

                } else if (metadata.type === "insurance_report") {
                    await admin.from("purchased_reports").insert({
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

                } else if (metadata.type === "supporter") {
                    // Supporter ("keep the lights on", cosmetic only) is a flag
                    // on public.users — deliberately NOT app_metadata.tier, so
                    // it can never interact with pro/studio state. Keep the
                    // original supporter_since across lapse + resubscribe.
                    const { data: existing } = await admin
                        .from("users")
                        .select("supporter_since")
                        .eq("id", userId)
                        .maybeSingle();
                    const { error: supporterWriteError } = await admin
                        .from("users")
                        .update({
                            is_supporter: true,
                            supporter_since: existing?.supporter_since ?? new Date().toISOString(),
                        })
                        .eq("id", userId);
                    if (supporterWriteError) {
                        // 500 so Stripe retries — e.g. env enabled before
                        // migration 142 is applied; the paid flag must not be
                        // silently dropped.
                        logger.error("StripeWebhook", `Failed to set supporter flag for ${userId}`, supporterWriteError);
                        return NextResponse.json({ error: "Supporter update failed" }, { status: 500 });
                    }
                    logger.error("StripeWebhook", `User ${userId} became a Supporter`, { sessionId: session.id });

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

                // ── Supporter subscriptions route here and ONLY here ──
                // Identified by the subscription metadata stamped at checkout
                // (belt-and-braces: also by the supporter price id). They must
                // never fall through to the tier logic below — a supporter
                // renewal would otherwise set tier "pro", and a supporter
                // cancellation would strip a paying Pro back to "free".
                // Mirrors the Pro cancel flow: `cancel_at_period_end` keeps
                // status "active" (plaque stays), the period-end
                // customer.subscription.deleted event clears the flag.
                const supporterPriceId = process.env.STRIPE_SUPPORTER_PRICE_ID;
                const isSupporterSubscription =
                    subscription.metadata?.type === "supporter" ||
                    (!!supporterPriceId &&
                        subscription.items?.data?.some((item) => item.price?.id === supporterPriceId));
                if (isSupporterSubscription) {
                    const supporterUserId = subscription.metadata?.supabase_user_id;
                    const supporterActive =
                        subscription.status === "active" || subscription.status === "trialing";
                    if (!supporterUserId) {
                        logger.error(
                            "StripeWebhook",
                            `Supporter subscription ${subscription.id} missing supabase_user_id metadata`
                        );
                        break;
                    }
                    // supporter_since is kept for lapsed supporters —
                    // is_supporter alone gates the plaque and the ledger.
                    const { error: supporterSubWriteError } = await admin
                        .from("users")
                        .update({ is_supporter: supporterActive })
                        .eq("id", supporterUserId);
                    if (supporterSubWriteError) {
                        // 500 so Stripe retries rather than silently dropping
                        // a supporter state change.
                        logger.error(
                            "StripeWebhook",
                            `Failed to update supporter flag for ${supporterUserId}`,
                            supporterSubWriteError
                        );
                        return NextResponse.json({ error: "Supporter update failed" }, { status: 500 });
                    }
                    logger.error(
                        "StripeWebhook",
                        `User ${supporterUserId} is_supporter set to ${supporterActive}`,
                        { subscriptionId: subscription.id, status: subscription.status }
                    );
                    break;
                }

                // ── Studio Pro subscriptions route here and ONLY here ──
                // Same isolation pattern as supporter above. Without this
                // branch, a studio renewal fell into the generic logic below
                // and set tier "pro" — silently downgrading a $10 subscriber
                // while still charging them (audit Part 2, market M1).
                const studioPriceId = process.env.STRIPE_STUDIO_PRO_PRICE_ID;
                const isStudioSubscription =
                    subscription.metadata?.type === "studio_pro" ||
                    (!!studioPriceId &&
                        subscription.items?.data?.some((item) => item.price?.id === studioPriceId));
                if (isStudioSubscription) {
                    const studioUserId = subscription.metadata?.supabase_user_id;
                    const studioActive =
                        subscription.status === "active" || subscription.status === "trialing";
                    if (!studioUserId) {
                        // Pre-fix subscriptions carry no subscription metadata —
                        // fall back to the customer-id scan below, but with the
                        // STUDIO tier, never "pro".
                        const { data: scanUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
                        const studioUser = scanUsers?.users?.find(
                            (u) => u.app_metadata?.stripe_customer_id === customerId
                        );
                        if (!studioUser) {
                            logger.error("StripeWebhook", `No user found for studio customer ${customerId}`);
                            break;
                        }
                        await admin.auth.admin.updateUserById(studioUser.id, {
                            app_metadata: {
                                ...studioUser.app_metadata,
                                tier: studioActive ? "studio" : "free",
                            },
                        });
                        break;
                    }
                    const { data: studioUserById } = await admin.auth.admin.getUserById(studioUserId);
                    if (!studioUserById?.user) {
                        logger.error("StripeWebhook", `Studio user ${studioUserId} not found`);
                        break;
                    }
                    await admin.auth.admin.updateUserById(studioUserId, {
                        app_metadata: {
                            ...studioUserById.user.app_metadata,
                            tier: studioActive ? "studio" : "free",
                        },
                    });
                    logger.error("StripeWebhook", `User ${studioUserId} tier set to ${studioActive ? "studio" : "free"}`, {
                        subscriptionId: subscription.id,
                        status: subscription.status,
                    });
                    break;
                }

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
