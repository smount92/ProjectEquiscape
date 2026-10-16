/**
 * Telling people about money events from Stripe (MHH-023).
 *
 * The webhook used to apply tier changes in silence: a failed renewal, a
 * refund or a chargeback reached nobody. These helpers find the member a
 * Stripe customer belongs to and word the notices; the webhook decides
 * when to send them. Tiers still follow the subscription's real status in
 * Stripe (handleSubscriptionChange): a refund never touches a plan at all,
 * because a goodwill refund must not silently end a membership, and a
 * member may since have moved to PayPal or a prepaid term. If the owner
 * cancels in Stripe, customer.subscription.deleted arrives by itself.
 */
import type { User } from "@supabase/supabase-js";
import type { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

type AdminClient = ReturnType<typeof getAdminClient>;

/** The member whose app_metadata holds this Stripe customer id, or null. */
export async function findUserByCustomer(admin: AdminClient, customerId: string | null): Promise<User | null> {
    if (!customerId) return null;
    // Page through every member, not just the first thousand.
    for (let page = 1; page <= 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) {
            logger.error("StripeWebhook", `Member lookup failed on page ${page}`, error);
            return null;
        }
        const users = data?.users ?? [];
        const hit = users.find((u) => u.app_metadata?.stripe_customer_id === customerId);
        if (hit) return hit;
        if (users.length < 1000) return null;
    }
    return null;
}

export async function findUserIdByCustomer(admin: AdminClient, customerId: string | null): Promise<string | null> {
    return (await findUserByCustomer(admin, customerId))?.id ?? null;
}

/**
 * What THIS refund gave back. charge.amount_refunded is the running total,
 * so a second partial refund would otherwise report both added together.
 */
export function refundedThisTime(
    charge: { amount_refunded: number },
    previous: { amount_refunded?: number } | null | undefined,
): number {
    const before = typeof previous?.amount_refunded === "number" ? previous.amount_refunded : 0;
    return Math.max(0, charge.amount_refunded - before);
}

/**
 * Record that an event's notices are going out (migration 238). False when
 * they already went out on an earlier delivery. Before 238 is pasted, or on
 * any other error, it says go ahead: a repeated notice beats a lost one.
 */
export async function claimNotices(admin: AdminClient, eventId: string, eventType: string): Promise<boolean> {
    try {
        const db = admin as unknown as {
            from: (t: string) => {
                insert: (r: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>;
            };
        };
        const { error } = await db.from("stripe_notice_events").insert({ event_id: eventId, event_type: eventType });
        if (!error) return true;
        if (error.code === "23505") return false;
        return true;
    } catch (err) {
        logger.warn("StripeWebhook", "Notice ledger unavailable; sending anyway", err);
        return true;
    }
}

/** "$10.00" from Stripe's smallest-unit amount and currency code. */
export function formatStripeAmount(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
            amount / 100,
        );
    } catch {
        return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
    }
}

/** The Stripe dashboard page for a customer, for the owner's notices. */
export function stripeCustomerUrl(customerId: string): string {
    return `https://dashboard.stripe.com/customers/${customerId}`;
}

export const BILLING_PAGE = "/settings#subscription";

/** The member's words for each event. */
export const memberNotice = {
    paymentFailed: (attempt: number) =>
        attempt <= 1
            ? "💳 Your membership payment didn't go through. Stripe will try again over the next few days; to avoid a gap, update your card in Settings › Subscription."
            : "💳 Your membership payment still hasn't gone through. Update your card in Settings › Subscription to keep your plan.",
    refunded: (amount: string, full: boolean) =>
        `💳 A ${full ? "" : "partial "}refund of ${amount} is on its way to your card. Banks usually take 5–10 days to show it.`,
};

/** The owner's words for each event. */
export const ownerNotice = {
    refunded: (amount: string, full: boolean, who: string) =>
        `💳 Stripe ${full ? "full" : "partial"} refund of ${amount} for ${who}. Their plan follows the subscription in Stripe: cancel it there to end their access.`,
    disputed: (amount: string, reason: string, who: string) =>
        `⚠️ Chargeback opened: ${amount} by ${who} (reason: ${reason.replace(/_/g, " ")}). Respond in Stripe before the deadline; cancel the subscription there if access should end.`,
};
