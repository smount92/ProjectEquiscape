/**
 * eBay comps feature flag. Ships dark, like the PayPal path: nothing
 * changes until the owner turns it on AND the credentials are present.
 *
 * TWO GATES, NOT ONE — same reasoning as src/lib/paypal/flag.ts.
 * `ebayCompsEnabled()` is the owner's switch and is the only one safe in
 * a client component (NEXT_PUBLIC_, inlined at build). `ebayConfigured()`
 * asks the separate server-only question "are the API credentials
 * actually here", so a flag flipped on before the keys land degrades to a
 * clean "not configured" rather than a 500 from inside a fetch.
 *
 * NOTE ON WHAT THE KEYS ARE. EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are
 * eBay *developer* credentials for the Browse API. They are NOT the same
 * thing as NEXT_PUBLIC_EBAY_CAMPAIGN_ID, which is the Partner Network
 * affiliate id already used to build outbound search links. Having one
 * does not give you the other, and the affiliate id must never be sent as
 * an API credential.
 */

/** The owner's switch. Safe in client components. */
export function ebayCompsEnabled(): boolean {
    return process.env.NEXT_PUBLIC_EBAY_COMPS === "1";
}

/** Server-only: are the Browse API credentials present? */
export function ebayConfigured(): boolean {
    return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

/** The single question every server entry point asks. */
export function ebayCompsLive(): boolean {
    return ebayCompsEnabled() && ebayConfigured();
}

/**
 * Sandbox unless explicitly told otherwise. An unset EBAY_ENV must never
 * mean production — the PayPal integration defaults the same way, and for
 * the same reason: the safe default is the one that cannot touch real
 * data or burn a production rate limit by accident.
 */
export function ebayApiBase(): string {
    return process.env.EBAY_ENV === "production"
        ? "https://api.ebay.com"
        : "https://api.sandbox.ebay.com";
}

/**
 * Which eBay marketplace to price against. Model horses are a US-centred
 * market and the catalog's retail prices are USD, so mixing in GB or DE
 * results would produce comps in the wrong currency for the wrong market.
 */
export function ebayMarketplace(): string {
    // Trimmed-empty, not just undefined. `??` would let an env var that
    // exists-but-is-blank through, and a blank X-EBAY-C-MARKETPLACE-ID
    // header is the kind of thing that fails obscurely in production and
    // reads fine in the dashboard — the same shape as the PayPal webhook
    // id that was set to an empty/typo'd value and 400'd every delivery.
    const configured = (process.env.EBAY_MARKETPLACE ?? "").trim();
    return configured || "EBAY_US";
}
