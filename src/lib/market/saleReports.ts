/**
 * Member-reported sales — "what did this horse actually go for?"
 *
 * WHY THIS EXISTS AND WHY IT MATTERS MORE THAN IT LOOKS. Automated
 * matching against eBay reaches about a quarter of the catalog, and only
 * ever sees ASKING prices. Members can do the thing a matcher cannot:
 * look at a listing and know it is an Alborozo. This is the only path to
 * sold prices that depends on nobody's API approval.
 *
 * THE THREAT MODEL IS NOT SPAM. It is quiet price manipulation. The
 * moment the Registry's prices carry weight, a seller has a reason to
 * report inflated sales for models they hold — and unlike a troll, that
 * contribution looks helpful. Every rule below exists to make one
 * motivated person unable to move a number on their own:
 *
 *   * a price needs several reports, from SEVERAL DIFFERENT members
 *   * outliers are dropped before the median is taken, so one extreme
 *     figure cannot drag the result even when it survives review
 *   * a report on your own listing is allowed but must be declared, and
 *     is excluded from the aggregate
 *   * the source URL is required, so any figure can be checked
 *
 * Pure functions: no network, no database. The rules are arguable in
 * tests rather than discoverable in production.
 */

/** Marketplaces a sale may be reported from, with a checkable link. */
const ALLOWED_HOSTS = [
    "ebay.com", "www.ebay.com", "ebay.co.uk", "ebay.ca",
    "modelhorsesalespages.com", "www.modelhorsesalespages.com",
    "etsy.com", "www.etsy.com",
];

export type SaleReportRejection =
    | "missing-url"
    | "unsupported-marketplace"
    | "malformed-url"
    | "missing-catalog-item"
    | "price-not-a-number"
    | "price-out-of-range"
    | "sold-date-in-future"
    | "sold-date-too-old"
    | "missing-currency";

export interface SaleReportInput {
    catalogItemId: string | null;
    /** Public listing URL — the provenance anyone can check. */
    sourceUrl: string | null;
    price: unknown;
    currency?: string | null;
    /** ISO date the sale completed. */
    soldOn: string | null;
    /** Did the reporter sell it? Allowed, but it must be declared. */
    selfReported?: boolean;
}

export interface ValidSaleReport {
    catalogItemId: string;
    sourceUrl: string;
    host: string;
    price: number;
    currency: string;
    soldOn: string;
    selfReported: boolean;
}

export type SaleReportValidation =
    | { ok: true; report: ValidSaleReport }
    | { ok: false; reason: SaleReportRejection };

/**
 * A model horse has never sold for a million dollars, and a sale of zero
 * is a data-entry slip rather than a gift. Both ends are deliberately
 * generous — the point is to catch typos and nonsense, not to encode an
 * opinion about what a model is worth.
 */
export const MIN_PRICE = 1;
export const MAX_PRICE = 100_000;

/** Sales older than this are not a current market signal. */
export const MAX_AGE_DAYS = 730;

export function marketplaceHost(rawUrl: string): string | null {
    try {
        const url = new URL(rawUrl.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        const host = url.hostname.toLowerCase();
        return ALLOWED_HOSTS.includes(host) ? host : null;
    } catch {
        return null;
    }
}

export function validateSaleReport(
    input: SaleReportInput,
    now: Date = new Date()
): SaleReportValidation {
    if (!input.catalogItemId) return { ok: false, reason: "missing-catalog-item" };
    if (!input.sourceUrl || !input.sourceUrl.trim()) return { ok: false, reason: "missing-url" };

    let host: string | null;
    try {
        host = marketplaceHost(input.sourceUrl);
    } catch {
        return { ok: false, reason: "malformed-url" };
    }
    if (host === null) {
        // Distinguish "not a URL at all" from "a URL we do not accept",
        // because the two need different messages to the member.
        const looksLikeUrl = /^https?:\/\/\S+$/i.test(input.sourceUrl.trim());
        return { ok: false, reason: looksLikeUrl ? "unsupported-marketplace" : "malformed-url" };
    }

    const price = typeof input.price === "number" ? input.price : Number(input.price);
    if (!Number.isFinite(price)) return { ok: false, reason: "price-not-a-number" };
    if (price < MIN_PRICE || price > MAX_PRICE) return { ok: false, reason: "price-out-of-range" };

    const currency = (input.currency ?? "USD").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, reason: "missing-currency" };

    if (!input.soldOn) return { ok: false, reason: "sold-date-in-future" };
    const sold = new Date(input.soldOn);
    if (Number.isNaN(sold.getTime())) return { ok: false, reason: "sold-date-in-future" };
    if (sold.getTime() > now.getTime() + 86_400_000) return { ok: false, reason: "sold-date-in-future" };
    const ageDays = (now.getTime() - sold.getTime()) / 86_400_000;
    if (ageDays > MAX_AGE_DAYS) return { ok: false, reason: "sold-date-too-old" };

    return {
        ok: true,
        report: {
            catalogItemId: input.catalogItemId,
            sourceUrl: input.sourceUrl.trim(),
            host,
            price: Math.round(price * 100) / 100,
            currency,
            soldOn: sold.toISOString().slice(0, 10),
            selfReported: Boolean(input.selfReported),
        },
    };
}

// ── Aggregation ──

export interface StoredReport {
    reporterId: string;
    /** Identifies the SALE. Two members reporting this URL are two
     *  witnesses to one transaction, not two transactions. */
    sourceUrl: string;
    price: number;
    currency: string;
    selfReported: boolean;
}

export interface SoldSummary {
    low: number;
    median: number;
    high: number;
    sampleSize: number;
    reporterCount: number;
    /** Reports dropped as outliers, surfaced rather than hidden. */
    outliersDropped: number;
}

/** Several reports, and from more than one person. */
export const MIN_REPORTS = 3;
export const MIN_REPORTERS = 2;

export function median(values: number[]): number {
    const s = [...values].sort((a, b) => a - b);
    if (!s.length) return 0;
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Drop reports far from the middle, using median absolute deviation.
 *
 * MAD is used rather than standard deviation precisely because it is not
 * moved by the outlier it is trying to find — a single $30,000 report
 * would inflate a standard deviation enough to keep itself inside the
 * band it was supposed to be caught by.
 */
export function dropOutliers(values: number[], tolerance = 3): number[] {
    if (values.length < 4) return [...values];
    const med = median(values);
    const mad = median(values.map((v) => Math.abs(v - med)));
    // Every value identical: no spread, nothing is an outlier.
    if (mad === 0) return [...values];
    return values.filter((v) => Math.abs(v - med) / mad <= tolerance);
}

/**
 * Turn reports into a sold-price summary, or null when the evidence is
 * too thin to be worth showing.
 */
export function summariseSales(reports: StoredReport[]): SoldSummary | null {
    if (!reports.length) return null;

    // Self-reported sales are kept as a record but never priced from —
    // the seller's own account of what they got is exactly the input a
    // manipulator controls.
    const usable = reports.filter((r) => !r.selfReported);
    if (usable.length < MIN_REPORTS) return null;

    // One currency only. Averaging across rates we do not hold would
    // invent a number rather than report one. The dominant currency wins
    // rather than whichever happened to be reported first, so a single
    // stray GBP report cannot decide what the whole summary is priced in.
    const tally = new Map<string, number>();
    for (const r of usable) tally.set(r.currency, (tally.get(r.currency) ?? 0) + 1);
    const currency = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const sameCurrency = usable.filter((r) => r.currency === currency);
    if (sameCurrency.length < MIN_REPORTS) return null;

    const reporters = new Set(sameCurrency.map((r) => r.reporterId));
    if (reporters.size < MIN_REPORTERS) return null;

    // ONE SALE, ONE DATA POINT. Three members reporting the same listing
    // are three witnesses to one transaction. Counting them as three
    // sales would let a single popular listing set a model's price, and
    // would reward brigading a listing over finding new evidence. Where
    // witnesses disagree on the figure, the median of their accounts
    // stands in — no single account of a sale is authoritative.
    const bySale = new Map<string, number[]>();
    for (const r of sameCurrency) {
        const key = r.sourceUrl.trim().toLowerCase();
        if (!bySale.has(key)) bySale.set(key, []);
        bySale.get(key)!.push(r.price);
    }
    const salePrices = [...bySale.values()].map((claims) => median(claims));
    if (salePrices.length < MIN_REPORTS) return null;

    const kept = dropOutliers(salePrices);
    if (kept.length < MIN_REPORTS) return null;

    return {
        low: Math.min(...kept),
        median: median(kept),
        high: Math.max(...kept),
        sampleSize: kept.length,
        reporterCount: reporters.size,
        outliersDropped: salePrices.length - kept.length,
    };
}
