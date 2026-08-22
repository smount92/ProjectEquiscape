import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier, isPro } from "@/lib/auth";
import { paypalPathLive } from "@/lib/paypal/flag";
import { createSubscription, planIdFor } from "@/lib/paypal/subscriptions";
import type { PaypalPlanKey } from "@/lib/paypal/types";
import { logger } from "@/lib/logger";

// ============================================================
// POST /api/checkout/paypal — Create a PayPal subscription
//
// The PayPal counterpart of /api/checkout and /api/checkout/studio-pro.
// Same shape as both: authenticate, refuse a double-subscription, create
// the thing at the provider, hand the client back a `url` to send the
// member to.
//
// Nothing is charged and no tier is granted here. The subscription is
// created in APPROVAL_PENDING; the tier arrives only when PayPal confirms
// activation, on the webhook (and on the verified return leg).
//
// Body: { "plan": "pro" | "studio" }
// ============================================================

const VALID_PLANS: readonly PaypalPlanKey[] = ["pro", "studio"];

function isPlanKey(value: unknown): value is PaypalPlanKey {
    return typeof value === "string" && (VALID_PLANS as readonly string[]).includes(value);
}

export async function POST(request: Request) {
    // Flag off, or credentials absent ⇒ this route does not exist, which
    // is exactly how the site behaves today.
    if (!paypalPathLive()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let plan: PaypalPlanKey;
    try {
        const body = (await request.json()) as { plan?: unknown };
        if (!isPlanKey(body?.plan)) {
            return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
        }
        plan = body.plan;
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // ── Double-subscription guard ──
    // Mirrors /api/checkout exactly, and deliberately covers BOTH
    // providers: `tier` is the single tier of record, so a member paying
    // by card is already `pro`/`studio` here and gets turned away before
    // a second subscription can be created anywhere.
    const tier = await getUserTier();
    if (plan === "pro" && isPro(tier)) {
        return NextResponse.json(
            {
                error:
                    tier === "studio"
                        ? "Studio Pro already includes everything in MHH Pro!"
                        : "You're already on MHH Pro! No need to upgrade again.",
            },
            { status: 400 },
        );
    }
    if (plan === "studio" && (tier as string) === "studio") {
        return NextResponse.json({ error: "You're already on Studio Pro!" }, { status: 400 });
    }

    if (!planIdFor(plan)) {
        return NextResponse.json(
            { error: "PayPal billing is not yet configured. Contact support." },
            { status: 500 },
        );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    try {
        const { id, approveUrl } = await createSubscription({
            plan,
            userId: user.id,
            userEmail: user.email,
            // The return leg confirms activation with PayPal directly
            // before showing anyone a success page — see that route.
            returnUrl: `${appUrl}/api/checkout/paypal/return?plan=${plan}`,
            cancelUrl: `${appUrl}/upgrade?status=cancelled`,
        });

        logger.error("PayPalCheckout", `Created PayPal subscription for ${user.id}`, {
            plan,
            subscriptionId: id,
        });

        return NextResponse.json({ url: approveUrl });
    } catch (err) {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(err, {
            tags: { domain: "commerce", provider: "paypal" },
            level: "error",
        });
        return NextResponse.json({ error: "Failed to start PayPal checkout." }, { status: 500 });
    }
}
