---
name: billing-issue
description: Use when a member says they were charged wrongly, paid but did not get Pro or Studio Pro, wants a refund or to cancel, or their plan ended early or did not end - Stripe or PayPal.
---

# Fix a billing problem

**Look; don't touch money.** Refunds, cancellations and plan changes are
done by the owner in the Stripe or PayPal dashboard, never by an agent.

## Where the truth lives

- **Tier of record**: the member's `app_metadata.tier` (`free`, `pro`, `studio`) in Supabase Auth.
- **Paid-through date**: `app_metadata.paid_through`; once it passes, the tier reads as free (`src/lib/entitlement/clock.ts`). No date means no expiry.
- A provider may only revoke a tier **it** granted.
- **Stripe**: `src/app/api/webhooks/stripe/route.ts`. **PayPal**: `src/app/api/webhooks/paypal/route.ts`.
- Admin › Insights shows revenue, read-only.

## Steps

1. **Get the facts**: alias, which provider, date and amount, what they see on the Upgrade page.
2. **Compare three things**: the provider dashboard (did the payment succeed?), the member's `tier` and `paid_through`, and the webhook log in Vercel/Sentry (did our webhook receive and apply it?).
3. **Classify**:
   - Paid, tier not applied: the webhook failed or did not match the member. The owner sets the tier by hand; then `investigate-bug` the webhook.
   - Refund or chargeback: the owner refunds in the provider; check that the tier ended. **Stripe refunds and chargebacks are not handled by our webhook** - set the tier by hand.
   - Payment failed: Stripe does not tell the member today; tell them.
   - Wants to cancel: point them to the Upgrade/Settings page; the owner cancels in the dashboard if that fails.
4. **Reply plainly**, with the date their access runs to.
5. Anything our code got wrong goes to `investigate-bug` with a test.

Decisions that apply: trust features are never paywalled; the site never holds members' money.
