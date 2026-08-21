/**
 * Revenue arithmetic and missing-schema detection for migration 176.
 *
 * Two jobs, both deliberately kept out of SQL so they are testable and
 * so the price constants live somewhere a person will actually find:
 *
 *   1. Turning subscriber counts into MRR at the REAL net prices.
 *   2. Recognising "migration 176 has not been pasted yet" so the admin
 *      console renders "—" instead of an error, the same way
 *      src/lib/metrics/db.ts does for 175.
 *
 * WHAT MRR HERE DOES AND DOES NOT MEAN. It is committed list revenue:
 * subscriber count x net price. It is NOT cash collected. Two reasons
 * it will read high during the launch window, both surfaced in the UI
 * rather than buried here:
 *
 *   · The beta promise is "a promo code for 6 months free", and all
 *     three checkouts pass allow_promotion_codes. An early subscriber
 *     is `active` in Stripe and contributes $0 for six months.
 *   · Supporter subscriptions are not in this number at all. Supporter
 *     is not a tier (users.is_supporter, migration 142), it grants
 *     nothing, and its price is not in the repo — it is read live from
 *     Stripe. Supporter revenue is a Stripe-dashboard question.
 */

import { UNDEFINED_FUNCTION, UNDEFINED_TABLE, MISSING_RPC, MISSING_RELATION } from "./db";

/** The two tiers that cost money. `free` is a state, not a product. */
export const PAID_TIERS = ["pro", "studio"] as const;
export type PaidTier = (typeof PAID_TIERS)[number];

/**
 * What actually lands in the bank per subscriber per month, after
 * Stripe's 2.9% + $0.30 on a domestic card:
 *
 *   Pro     $5.00 - (5.00 x 0.029) - 0.30 = $4.555
 *   Studio $10.00 - (10.00 x 0.029) - 0.30 = $9.410
 *
 * List prices are hardcoded in src/app/upgrade/page.tsx; if one moves,
 * this moves with it. Using net rather than list is the whole point —
 * on a $5 subscription Stripe's flat fee is 8.9% of the charge, which
 * is large enough that gross MRR would be a misleading number.
 */
export const NET_MONTHLY_PRICE: Record<PaidTier, number> = {
    pro: 4.555,
    studio: 9.41,
};

/** Stripe statuses that mean "this subscription is currently earning". */
export const PAYING_STATUSES = ["active", "trialing"] as const;

/**
 * Stripe statuses that mean "the money stopped but the subscription has
 * not been given up on". These are the ones a failed renewal produces,
 * and the whole reason invoice.payment_failed is now handled: before,
 * a dunning subscriber was invisible everywhere in the app.
 */
export const AT_RISK_STATUSES = ["past_due", "unpaid", "incomplete"] as const;

/**
 * Every status subscription_state.status will accept, matching the CHECK
 * constraint in migration 176 and Stripe's own vocabulary exactly. Kept
 * here so the webhook can refuse to send a value the column would reject
 * — a constraint violation inside a webhook is a retry loop.
 */
export const SUBSCRIPTION_STATUSES = [
    "active",
    "trialing",
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Stripe's status for the mirror, or a safe stand-in if Stripe ever
 * invents a new one. `isActive` is the caller's own reading of whether
 * the subscription is currently entitled — the same boolean that decides
 * app_metadata.tier — so an unrecognised status can never make the two
 * records disagree about whether someone is paying.
 */
export function normalizeSubscriptionStatus(raw: unknown, isActive: boolean): SubscriptionStatus {
    if (typeof raw === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(raw)) {
        return raw as SubscriptionStatus;
    }
    return isActive ? "active" : "canceled";
}

/** One (tier, status) bucket as metrics_subscription_summary returns it. */
export interface SubscriptionCount {
    tier: string;
    status: string;
    subscribers: number;
}

export interface TierBreakdown {
    tier: PaidTier;
    /** Currently earning — active or trialing. */
    paying: number;
    /** Payment failed, Stripe still retrying. */
    atRisk: number;
    /** Monthly net dollars this tier contributes. */
    mrr: number;
}

export interface RevenueSummary {
    /** Net monthly recurring revenue across the paid tiers. */
    mrr: number;
    tiers: TierBreakdown[];
    /** Paying subscribers across all paid tiers. */
    payingTotal: number;
    /** Subscribers in dunning across all paid tiers. */
    atRiskTotal: number;
    /**
     * Rows whose tier is `free` — every member who has ever paid and
     * currently does not. The raw material for a churn number, kept
     * separate because they contribute nothing to MRR.
     */
    lapsedTotal: number;
}

function toCount(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function isPaidTier(value: unknown): value is PaidTier {
    return typeof value === "string" && (PAID_TIERS as readonly string[]).includes(value);
}

/**
 * Subscriber buckets in, money out. Pure — no clock, no client, no
 * rounding surprises: MRR is rounded to whole cents at the end so a
 * count of three Pro subscribers reads $13.67 rather than
 * $13.664999999999999.
 *
 * Unknown tiers and unknown statuses are ignored rather than guessed
 * at. A status this file has never heard of must not silently become
 * revenue.
 */
export function computeRevenue(rows: readonly SubscriptionCount[] | null | undefined): RevenueSummary {
    const paying = new Map<PaidTier, number>();
    const atRisk = new Map<PaidTier, number>();
    let lapsedTotal = 0;

    for (const row of rows ?? []) {
        const count = toCount(row?.subscribers);
        if (count === 0) continue;

        const status = typeof row?.status === "string" ? row.status : "";

        if (!isPaidTier(row?.tier)) {
            // tier 'free' with any status = a former subscriber.
            if (row?.tier === "free") lapsedTotal += count;
            continue;
        }

        if ((PAYING_STATUSES as readonly string[]).includes(status)) {
            paying.set(row.tier, (paying.get(row.tier) ?? 0) + count);
        } else if ((AT_RISK_STATUSES as readonly string[]).includes(status)) {
            atRisk.set(row.tier, (atRisk.get(row.tier) ?? 0) + count);
        } else {
            // canceled / incomplete_expired / paused on a paid tier:
            // the webhook normally rewrites tier to 'free' alongside,
            // but a row that slipped through is a lapse, not revenue.
            lapsedTotal += count;
        }
    }

    const tiers: TierBreakdown[] = PAID_TIERS.map((tier) => {
        const p = paying.get(tier) ?? 0;
        return {
            tier,
            paying: p,
            atRisk: atRisk.get(tier) ?? 0,
            mrr: Math.round(p * NET_MONTHLY_PRICE[tier] * 100) / 100,
        };
    });

    const mrr = Math.round(tiers.reduce((sum, t) => sum + t.mrr, 0) * 100) / 100;

    return {
        mrr,
        tiers,
        payingTotal: tiers.reduce((sum, t) => sum + t.paying, 0),
        atRiskTotal: tiers.reduce((sum, t) => sum + t.atRisk, 0),
        lapsedTotal,
    };
}

/** Postgres "column does not exist" — 176's column on an old users table. */
export const UNDEFINED_COLUMN = "42703";
/** PostgREST "column not found in schema cache". */
export const MISSING_COLUMN = "PGRST204";

/**
 * True when the error means "176 has not been pasted yet", not "it
 * broke". Wider than isMissingMetricsSchema because 176 adds a COLUMN
 * as well as a table and two functions, and a missing column reports
 * differently from a missing relation.
 */
export function isMissingRevenueSchema(
    error: { code?: string; message?: string } | null | undefined,
): boolean {
    if (!error) return false;
    if (
        error.code === UNDEFINED_TABLE ||
        error.code === UNDEFINED_FUNCTION ||
        error.code === UNDEFINED_COLUMN ||
        error.code === MISSING_RPC ||
        error.code === MISSING_RELATION ||
        error.code === MISSING_COLUMN
    ) {
        return true;
    }
    return /(relation|function|column) .* does not exist|schema cache/i.test(error.message ?? "");
}
