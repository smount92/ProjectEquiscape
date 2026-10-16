/**
 * Telling people about money events from Stripe (MHH-023).
 *
 * The webhook used to apply tier changes in silence: a failed renewal, a
 * refund or a chargeback reached nobody. These helpers find the member a
 * Stripe customer belongs to and word the notices; the webhook decides
 * when to send them. Tiers still follow the subscription's real status in
 * Stripe (handleSubscriptionChange): a refund never cancels anyone by
 * itself, because a goodwill refund must not silently end a membership.
 */
import type { getAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof getAdminClient>;

/** The member whose app_metadata holds this Stripe customer id, or null. */
export async function findUserIdByCustomer(admin: AdminClient, customerId: string | null): Promise<string | null> {
    if (!customerId) return null;
    // Page through every member, not just the first thousand.
    for (let page = 1; page <= 50; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        const users = data?.users ?? [];
        const hit = users.find((u) => u.app_metadata?.stripe_customer_id === customerId);
        if (hit) return hit.id;
        if (users.length < 1000) return null;
    }
    return null;
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
