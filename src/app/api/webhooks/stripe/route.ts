import { NextRequest, NextResponse } from "next/server";
import type { Stripe } from "stripe";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { metricsDb } from "@/lib/metrics/db";
import { isMissingRevenueSchema, normalizeSubscriptionStatus } from "@/lib/metrics/revenue";
import * as Sentry from "@sentry/nextjs";

// ============================================================
// Stripe Webhook Handler
// Processes subscription events for MHH Pro tier management
//
// Required env vars:
//   STRIPE_SECRET_KEY - Stripe secret API key
//   STRIPE_WEBHOOK_SECRET - Webhook endpoint signing secret
//
// THE TIER OF RECORD IS auth.users.app_metadata.tier. Every gate on
// the site reads it and nothing else. Migration 176 adds a SECOND
// write — subscription_state — purely so the business can ask "what is
// MRR" without exporting from Stripe. It is a mirror, never a gate:
// every mirror write below happens ALONGSIDE the app_metadata write it
// reflects, never instead of it, and a mirror failure is swallowed so
// it can never make Stripe retry an event that already took effect.
// ============================================================

type AdminClient = ReturnType<typeof getAdminClient>;

/**
 * When the paid-for period ends, as an ISO string.
 *
 * `current_period_end` moved off the Subscription and onto its ITEMS in
 * Stripe's 2025 API rewrite; the version this route pins
 * (2026-02-25.clover) has no subscription-level field at all. The
 * latest item wins, which for our single-item subscriptions is the only
 * item.
 */
function periodEndIso(subscription: Stripe.Subscription): string | null {
    const ends = (subscription.items?.data ?? [])
        .map((item) => (item as { current_period_end?: number }).current_period_end)
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (ends.length === 0) return null;
    return new Date(Math.max(...ends) * 1000).toISOString();
}

/**
 * Write the reporting mirror (migration 176). Swallows everything.
 *
 * Two failure modes are treated as normal rather than exceptional:
 * migration 176 not pasted yet (the function does not exist), and a
 * member deleted between the event and its retry (the RPC returns
 * without writing). Neither is worth failing an event over — the tier
 * the site actually reads was already written by the caller.
 */
async function mirrorSubscriptionState(
    admin: AdminClient,
    args: {
        userId: string;
        tier: "free" | "pro" | "studio";
        status: string;
        currentPeriodEnd?: string | null;
        stripeCustomerId?: string | null;
        stripeSubscriptionId?: string | null;
    },
): Promise<void> {
    try {
        const { error } = await metricsDb(admin).rpc("record_subscription_state", {
            p_user_id: args.userId,
            p_tier: args.tier,
            p_status: args.status,
            p_current_period_end: args.currentPeriodEnd ?? null,
            p_stripe_customer_id: args.stripeCustomerId ?? null,
            p_stripe_subscription_id: args.stripeSubscriptionId ?? null,
        });
        if (error && !isMissingRevenueSchema(error)) {
            logger.error("StripeWebhook", `subscription_state mirror failed for ${args.userId}`, error);
        }
    } catch (err) {
        logger.error("StripeWebhook", `subscription_state mirror threw for ${args.userId}`, err);
    }
}

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
                    // MERGE app_metadata — a bare object here erased every
                    // other key (audit N5; is_suspended now lives there, so
                    // an overwrite would silently unsuspend on purchase).
                    const { data: studioBuyer } = await admin.auth.admin.getUserById(userId);
                    await admin.auth.admin.updateUserById(userId, {
                        app_metadata: {
                            ...(studioBuyer?.user?.app_metadata ?? {}),
                            tier: "studio",
                            stripe_customer_id: session.customer as string,
                        },
                    });
                    // Mirror (176). No period end here — the checkout
                    // session does not carry one; the subscription events
                    // that follow fill it in, and the RPC treats a null
                    // argument as "leave what you have".
                    await mirrorSubscriptionState(admin, {
                        userId,
                        tier: "studio",
                        status: "active",
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId:
                            typeof session.subscription === "string" ? session.subscription : null,
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
                    // Default: MHH Pro subscription upgrade (merge — see
                    // studio branch note).
                    const { data: proBuyer } = await admin.auth.admin.getUserById(userId);
                    await admin.auth.admin.updateUserById(userId, {
                        app_metadata: {
                            ...(proBuyer?.user?.app_metadata ?? {}),
                            tier: "pro",
                            stripe_customer_id: session.customer as string,
                        },
                    });
                    // Mirror (176) — see the studio branch note above.
                    await mirrorSubscriptionState(admin, {
                        userId,
                        tier: "pro",
                        status: "active",
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId:
                            typeof session.subscription === "string" ? session.subscription : null,
                    });
                    logger.error("StripeWebhook", `User ${userId} upgraded to Pro`, { sessionId: session.id });
                }
                break;
            }

            // ── Subscription status change ──
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const result = await handleSubscriptionChange(
                    admin,
                    event.data.object as Stripe.Subscription,
                );
                if (!result.ok) {
                    return NextResponse.json({ error: result.error }, { status: 500 });
                }
                break;
            }

            // ── A renewal that did not go through ──
            //
            // The gap this closes (docs/business-research/repo-ground-truth.md
            // §7): a failed renewal was visible NOWHERE in the app. Stripe
            // would dun the customer for days while the site carried on as
            // if nothing had happened.
            //
            // It deliberately does NOT infer a downgrade from the failure
            // itself. One failed attempt is not a cancellation — Stripe
            // retries, and plenty of them succeed. Instead it asks Stripe
            // what the subscription's state actually IS and applies exactly
            // the rule the rest of this file applies: active or trialing
            // keeps the tier, anything else does not. Since a payment
            // failure moves a subscription to past_due, that rule usually
            // does downgrade — but because the status says so, not because
            // an invoice bounced.
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                // The subscription reference moved under `parent` in the API
                // version this route pins; `invoice.subscription` is gone.
                const ref = invoice.parent?.subscription_details?.subscription;
                const subscriptionId = typeof ref === "string" ? ref : (ref?.id ?? null);

                if (!subscriptionId) {
                    // A one-off charge failing (promote/boost) has no
                    // subscription and nothing to downgrade.
                    logger.error("StripeWebhook", `invoice.payment_failed with no subscription`, {
                        invoiceId: invoice.id,
                    });
                    break;
                }

                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                logger.error("StripeWebhook", `Payment failed for subscription ${subscriptionId}`, {
                    invoiceId: invoice.id,
                    status: subscription.status,
                    attempt: invoice.attempt_count,
                });

                const result = await handleSubscriptionChange(admin, subscription);
                if (!result.ok) {
                    return NextResponse.json({ error: result.error }, { status: 500 });
                }
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

/**
 * Everything that happens when a subscription's state changes.
 *
 * Extracted verbatim from the `customer.subscription.updated` /
 * `.deleted` case so that `invoice.payment_failed` can reach the same
 * three isolated code paths (supporter, studio, pro) instead of growing
 * a fourth copy of them. The logic below is unchanged — only `break`
 * became `return`, and the mirror writes are new.
 */
async function handleSubscriptionChange(
    admin: AdminClient,
    subscription: Stripe.Subscription,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const customerId = subscription.customer as string;
    const periodEnd = periodEndIso(subscription);

    // ── Supporter subscriptions route here and ONLY here ──
    // Identified by the subscription metadata stamped at checkout
    // (belt-and-braces: also by the supporter price id). They must
    // never fall through to the tier logic below — a supporter
    // renewal would otherwise set tier "pro", and a supporter
    // cancellation would strip a paying Pro back to "free".
    // Mirrors the Pro cancel flow: `cancel_at_period_end` keeps
    // status "active" (plaque stays), the period-end
    // customer.subscription.deleted event clears the flag.
    //
    // Nothing is mirrored to subscription_state on this path, by
    // design: supporter is not a tier, grants nothing, and its price
    // is not in the repo (migration 176 header explains at length).
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
            return { ok: true };
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
            return { ok: false, error: "Supporter update failed" };
        }
        logger.error(
            "StripeWebhook",
            `User ${supporterUserId} is_supporter set to ${supporterActive}`,
            { subscriptionId: subscription.id, status: subscription.status }
        );
        return { ok: true };
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
        const studioStatus = normalizeSubscriptionStatus(subscription.status, studioActive);
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
                return { ok: true };
            }
            await admin.auth.admin.updateUserById(studioUser.id, {
                app_metadata: {
                    ...studioUser.app_metadata,
                    tier: studioActive ? "studio" : "free",
                },
            });
            await mirrorSubscriptionState(admin, {
                userId: studioUser.id,
                tier: studioActive ? "studio" : "free",
                status: studioStatus,
                currentPeriodEnd: periodEnd,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
            });
            return { ok: true };
        }
        const { data: studioUserById } = await admin.auth.admin.getUserById(studioUserId);
        if (!studioUserById?.user) {
            logger.error("StripeWebhook", `Studio user ${studioUserId} not found`);
            return { ok: true };
        }
        await admin.auth.admin.updateUserById(studioUserId, {
            app_metadata: {
                ...studioUserById.user.app_metadata,
                tier: studioActive ? "studio" : "free",
            },
        });
        await mirrorSubscriptionState(admin, {
            userId: studioUserId,
            tier: studioActive ? "studio" : "free",
            status: studioStatus,
            currentPeriodEnd: periodEnd,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
        });
        logger.error("StripeWebhook", `User ${studioUserId} tier set to ${studioActive ? "studio" : "free"}`, {
            subscriptionId: subscription.id,
            status: subscription.status,
        });
        return { ok: true };
    }

    // Look up user by stored stripe_customer_id in app_metadata
    // We need to find the user — iterate auth users (admin API)
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = users?.users?.find(
        (u) => u.app_metadata?.stripe_customer_id === customerId
    );

    if (!user) {
        logger.error("StripeWebhook", `No user found for Stripe customer ${customerId}`);
        return { ok: true };
    }

    const isActive = subscription.status === "active" || subscription.status === "trialing";
    await admin.auth.admin.updateUserById(user.id, {
        app_metadata: {
            ...user.app_metadata,
            tier: isActive ? "pro" : "free",
        },
    });
    await mirrorSubscriptionState(admin, {
        userId: user.id,
        tier: isActive ? "pro" : "free",
        status: normalizeSubscriptionStatus(subscription.status, isActive),
        currentPeriodEnd: periodEnd,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
    });
    logger.error("StripeWebhook", `User ${user.id} tier set to ${isActive ? "pro" : "free"}`, {
        subscriptionId: subscription.id,
        status: subscription.status,
    });
    return { ok: true };
}
