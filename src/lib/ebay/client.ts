/**
 * eBay Browse API client.
 *
 * WHAT THIS CAN AND CANNOT SEE. The Browse API returns ACTIVE listings —
 * what people are currently asking. It does not return completed sales.
 * Sold prices live behind the Marketplace Insights API, which is
 * restricted access granted by application, not a self-serve key. So
 * everything this module produces is an ASKING price and must be labelled
 * as one everywhere it surfaces. Blurring "listed" into "sold" is the
 * single most damaging thing this feature could do to the Registry's
 * credibility, and it would be an easy mistake to make quietly.
 *
 * Scraping completed listings is not an alternative: it breaches eBay's
 * terms and would put the Partner Network account — which earns real
 * affiliate revenue today — at risk.
 *
 * Every network call goes through fetch so tests can mock at that
 * boundary, the same way the PayPal client is tested.
 */

import { ebayApiBase, ebayConfigured, ebayMarketplace } from "@/lib/ebay/flag";

export interface EbayListing {
    itemId: string;
    title: string;
    /** Major units, e.g. 129.99. */
    price: number;
    currency: string;
    condition: string | null;
    itemWebUrl: string | null;
}

export class EbayNotConfiguredError extends Error {
    constructor() {
        super("eBay API credentials are not configured");
        this.name = "EbayNotConfiguredError";
    }
}

/**
 * Application token cache. Client-credentials tokens last ~2 hours; a
 * weekly sweep over thousands of models would otherwise mint one per
 * request and hit the token endpoint's own rate limit long before the
 * search endpoint's.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Exposed for tests; there is no other reason to reach in. */
export function __resetTokenCache(): void {
    cachedToken = null;
}

export async function getAppToken(now: number = Date.now()): Promise<string> {
    if (!ebayConfigured()) throw new EbayNotConfiguredError();
    if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;

    const basic = Buffer.from(
        `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch(`${ebayApiBase()}/identity/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "https://api.ebay.com/oauth/api_scope",
        }).toString(),
    });

    if (!res.ok) {
        // Never echo the response body — a failed auth response can carry
        // request context, and this runs in a cron whose logs are kept.
        throw new Error(`eBay token request failed (${res.status})`);
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("eBay token response had no access_token");

    cachedToken = {
        value: json.access_token,
        expiresAt: now + (json.expires_in ?? 7200) * 1000,
    };
    return cachedToken.value;
}

/**
 * eBay's model-horse category, to keep results in the hobby.
 *
 * 156265 = Toys & Hobbies › Model Horses (verified live: "Breyer
 * Alborozo" finds 222 listings inside it, Peter Stone 157, and an
 * unrelated query finds zero). The first sweep shipped with "417",
 * inherited from the old affiliate URL builder's `_sacat=417` — a dead
 * id the Browse API answers with total: 0 FOR EVERY QUERY, no warning,
 * no error. 150 searches came back empty and nothing said why. A wrong
 * category doesn't fail; it silently filters out the entire market.
 */
const CATEGORY_MODEL_HORSES = "156265";

/**
 * Search active listings. `limit` is deliberately small — the point is a
 * price signal for one model, not a catalogue of every listing.
 */
export async function searchActiveListings(
    query: string,
    opts: { limit?: number; now?: number } = {}
): Promise<EbayListing[]> {
    const token = await getAppToken(opts.now);
    const params = new URLSearchParams({
        q: query,
        category_ids: CATEGORY_MODEL_HORSES,
        limit: String(Math.min(opts.limit ?? 20, 50)),
        // Cheapest first: for a price signal the floor is more meaningful
        // than a headline outlier, and outliers are what sort-by-relevance
        // surfaces on a hobby search.
        sort: "price",
    });

    const res = await fetch(`${ebayApiBase()}/buy/browse/v1/item_summary/search?${params}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            "X-EBAY-C-MARKETPLACE-ID": ebayMarketplace(),
            Accept: "application/json",
        },
    });

    if (res.status === 429) throw new Error("eBay rate limit reached");
    if (!res.ok) throw new Error(`eBay search failed (${res.status})`);

    const json = (await res.json()) as { itemSummaries?: unknown[] };
    const items = Array.isArray(json.itemSummaries) ? json.itemSummaries : [];

    return items.flatMap((raw) => {
        const it = raw as {
            itemId?: string; title?: string; itemWebUrl?: string;
            condition?: string;
            price?: { value?: string; currency?: string };
        };
        const value = Number(it.price?.value);
        // A listing with no usable price is not a price signal; dropping it
        // is better than storing a 0 that would drag every average down.
        if (!it.itemId || !it.title || !Number.isFinite(value) || value <= 0) return [];
        return [{
            itemId: String(it.itemId),
            title: String(it.title),
            price: value,
            currency: String(it.price?.currency ?? "USD"),
            condition: it.condition ? String(it.condition) : null,
            itemWebUrl: it.itemWebUrl ? String(it.itemWebUrl) : null,
        }];
    });
}

/**
 * The search string for a catalog row. Maker and model number are the two
 * things matching will insist on afterwards, so asking for them up front
 * is what keeps the result set small enough to be worth a request.
 */
export function buildQuery(maker: string | null, title: string, modelNumber: string | null): string {
    return [maker, title, modelNumber].filter(Boolean).join(" ").trim();
}
