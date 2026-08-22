/**
 * Time-boxed memberships: the catalogue, and the flag that reveals it.
 *
 * Everything a member can buy that ENDS lives here. Prices are not in this
 * file — they are in config/membership-terms.json, which is the one place
 * the owner edits and which this module only reads and validates.
 *
 * ── WHY TIME-BOXED MEMBERSHIPS EXIST ──────────────────────────────
 *
 * A prospective member, in her own words: "not really keen on a recurring
 * monthly payment... would prefer the choice of a one-time (or single
 * payment) or maybe a choice of 3-month? 6-month?" She is the second
 * person to ask. What she is turning down is not the price, it is the
 * standing authorization — so the answer cannot be a cheaper subscription,
 * it has to be a purchase that does not renew.
 *
 * ── TWO PRODUCTS, ONE TABLE ───────────────────────────────────────
 *
 * PREPAID (`prepaidPrice`)
 *   One PayPal charge through Orders v2. No agreement, no stored
 *   authorization, nothing to cancel. Access ends on the date and the
 *   member is never charged again. This is the thing she asked for.
 *
 * FIXED-TERM SUBSCRIPTION (`monthlyPrice`, `planEnvVar`)
 *   An ordinary PayPal subscription with total_cycles set, so it bills
 *   monthly and then stops by itself. For someone who wants to spread the
 *   cost but not sign up to something indefinite. It is only offered when
 *   its plan id is actually configured, because the plan is a live object
 *   the owner has to create at PayPal first.
 *
 * The two are priced differently on purpose: the discount is what you get
 * for handing over the money up front. See the JSON's own README.
 */

import rawTerms from "../../../config/membership-terms.json";

export type TermTier = "pro" | "studio";

/** A row of config/membership-terms.json, once validated. */
export interface MembershipTerm {
    /** Stable id used in URLs, request bodies and PayPal custom fields. */
    key: string;
    tier: TermTier;
    /** How long the term runs. Whole calendar months. */
    months: number;
    /** "6 months" — for display. */
    label: string;
    /** Total charged once, up front. A 2-decimal string, as PayPal wants. */
    prepaidPrice: string;
    /** Per-cycle price of the matching fixed-term subscription. */
    monthlyPrice: string;
    /** Env var holding that subscription's PayPal plan id. */
    planEnvVar: string;
}

interface RawConfig {
    currency?: unknown;
    terms?: unknown;
}

/** PayPal wants amounts as "12.00" — two decimals, no symbol, no comma. */
const MONEY = /^\d+\.\d{2}$/;

function isTermTier(value: unknown): value is TermTier {
    return value === "pro" || value === "studio";
}

/**
 * Read one config row, or return null.
 *
 * A malformed row is DROPPED rather than thrown on. This module is
 * imported by the upgrade page; a typo in a price must cost one missing
 * button, not a 500 on the page where people go to pay. A dropped row
 * cannot be bought either — the checkout route looks terms up in this
 * same list — so the failure mode is "that option is not for sale",
 * which is the safe direction for money.
 */
function parseTerm(row: unknown): MembershipTerm | null {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;

    if (typeof r.key !== "string" || !r.key.trim()) return null;
    if (!isTermTier(r.tier)) return null;
    if (typeof r.months !== "number" || !Number.isInteger(r.months) || r.months < 1 || r.months > 24) {
        return null;
    }
    if (typeof r.prepaidPrice !== "string" || !MONEY.test(r.prepaidPrice)) return null;
    if (typeof r.monthlyPrice !== "string" || !MONEY.test(r.monthlyPrice)) return null;
    if (typeof r.planEnvVar !== "string" || !r.planEnvVar.trim()) return null;

    return {
        key: r.key.trim(),
        tier: r.tier,
        months: r.months,
        label: typeof r.label === "string" && r.label.trim() ? r.label.trim() : `${r.months} months`,
        prepaidPrice: r.prepaidPrice,
        monthlyPrice: r.monthlyPrice,
        planEnvVar: r.planEnvVar.trim(),
    };
}

const CONFIG = rawTerms as RawConfig;

/** The whole catalogue, in config order, malformed rows removed. */
export const MEMBERSHIP_TERMS: readonly MembershipTerm[] = Array.isArray(CONFIG.terms)
    ? (CONFIG.terms.map(parseTerm).filter(Boolean) as MembershipTerm[])
    : [];

/** ISO currency for every term. USD unless the config says otherwise. */
export const TERM_CURRENCY: string =
    typeof CONFIG.currency === "string" && /^[A-Z]{3}$/.test(CONFIG.currency)
        ? CONFIG.currency
        : "USD";

/** One term by key, or null. The only way a term key becomes a purchase. */
export function termByKey(key: string | null | undefined): MembershipTerm | null {
    if (!key) return null;
    const trimmed = key.trim();
    return MEMBERSHIP_TERMS.find((t) => t.key === trimmed) ?? null;
}

/** The terms on offer for one tier, in config order. */
export function termsForTier(tier: TermTier): readonly MembershipTerm[] {
    return MEMBERSHIP_TERMS.filter((t) => t.tier === tier);
}

/**
 * The PayPal plan id for a term's fixed-term subscription, or null.
 *
 * Null is the ordinary state until the owner has run
 * `node scripts/paypal-setup-plans.mjs --terms` and pasted the ids in.
 * Server-only in practice — these are not NEXT_PUBLIC vars, so a client
 * component always sees null and must be told by its server parent.
 */
export function termPlanId(term: MembershipTerm): string | null {
    const value = process.env[term.planEnvVar];
    return value && value.trim() ? value.trim() : null;
}

/**
 * Which term does this PayPal plan id belong to?
 *
 * The reverse lookup the webhook needs, and the reason a fixed-term
 * subscription can never be mistaken for an open-ended one: an
 * unrecognised plan returns null and the caller refuses to guess.
 */
export function termForPlanId(planId: string | null | undefined): MembershipTerm | null {
    if (!planId) return null;
    const trimmed = planId.trim();
    if (!trimmed) return null;
    return MEMBERSHIP_TERMS.find((t) => termPlanId(t) === trimmed) ?? null;
}

/** Total a fixed-term subscription costs over its whole run, as a string. */
export function fixedTermTotal(term: MembershipTerm): string {
    const cents = Math.round(Number(term.monthlyPrice) * 100) * term.months;
    return (cents / 100).toFixed(2);
}

/**
 * The owner's switch for the whole time-boxed feature. Safe in client
 * components — NEXT_PUBLIC, inlined at build time. Only "1" turns it on,
 * matching src/lib/paypal/flag.ts and src/lib/forms/flag.ts.
 *
 * Note what this flag does NOT gate: the entitlement clock. Once a term
 * is sold, turning the switch off must stop new sales, not convert the
 * terms already sold into memberships that never end.
 */
export function prepaidTermsEnabled(): boolean {
    return process.env.NEXT_PUBLIC_PREPAID_TERMS === "1";
}
