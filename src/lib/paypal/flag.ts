/**
 * PayPal billing feature flag. Ships dark: set NEXT_PUBLIC_PAYPAL_BILLING=1
 * to expose the PayPal path alongside the existing Stripe card checkout.
 *
 * Mirrors src/lib/forms/flag.ts — only the literal "1" turns it on.
 *
 * WHY A SECOND BILLING PATH EXISTS AT ALL. Stripe only offers PayPal as a
 * payment method to businesses registered in the EU/UK/CH/NO/LI. This one
 * is a US business, so "just enable PayPal in the Stripe dashboard" is not
 * available at any price. Hobbyists here routinely hold PayPal balances
 * from selling and trading horses and want to spend that balance, so
 * PayPal has to be its own path against PayPal's own Subscriptions API.
 *
 * TWO GATES, NOT ONE. `paypalBillingEnabled()` is the owner's switch and
 * is the only thing that may be read in a client component (it is a
 * NEXT_PUBLIC_ var, inlined at build time). `paypalConfigured()` asks the
 * separate question "are the server credentials actually present", and is
 * server-only — the secrets it looks for must never reach a bundle. Every
 * server entry point checks BOTH, so a flag flipped on before the
 * credentials land degrades to a clean "not configured" instead of a
 * 500 from deep inside a fetch.
 */

/** The owner's switch. Safe in client components. */
export function paypalBillingEnabled(): boolean {
    return process.env.NEXT_PUBLIC_PAYPAL_BILLING === "1";
}

/**
 * Server-only: are the REST credentials present? Checked separately from
 * the flag so "flag on, secrets missing" fails closed and legibly.
 *
 * PAYPAL_WEBHOOK_ID is deliberately NOT required here. It gates the
 * webhook (which refuses to do anything without it) rather than checkout,
 * so a missing webhook id must not silently disable the whole path — it
 * must fail loudly in the one place it matters.
 */
export function paypalConfigured(): boolean {
    return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

/**
 * The single question every server entry point asks. Flag off OR
 * credentials missing ⇒ the site behaves exactly as it did before this
 * feature existed.
 */
export function paypalPathLive(): boolean {
    return paypalBillingEnabled() && paypalConfigured();
}
