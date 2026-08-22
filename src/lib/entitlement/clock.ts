/**
 * THE ENTITLEMENT CLOCK.
 *
 * Until this file existed, nothing on Model Horse Hub expired. A tier was
 * a flag: something wrote `pro` into app_metadata and the member was Pro
 * until something else wrote `free`. That is exactly right for a
 * subscription — the provider tells us when it stops — and completely
 * wrong for a term someone has PREPAID, where the end date is the whole
 * product. "Six months of Pro" is meaningless without a date attached.
 *
 * So: one optional key alongside the tier.
 *
 *   app_metadata.paid_through — ISO 8601 instant. After it passes, the
 *                               tier reads as `free`.
 *
 * ── THREE RULES, IN ORDER OF HOW MUCH THEY MATTER ─────────────────
 *
 * 1. ABSENT MEANS FOREVER, NEVER MEANS EXPIRED.
 *    Every existing member on the site has no `paid_through`, and so does
 *    every open-ended subscription, Stripe and PayPal alike. If a missing
 *    key ever read as "expired" this file would cancel the entire
 *    membership base in one deploy. Absent, null, empty and unparseable
 *    all mean "no expiry".
 *
 * 2. THE CHECK HAPPENS AT READ TIME.
 *    getUserTier() applies this on every request. There is no cron that
 *    has to fire for a term to end and no window in which an expired term
 *    still opens doors. A sweep, if one is ever written, is tidying — the
 *    read is the mechanism.
 *
 * 3. UNPARSEABLE KEEPS ACCESS.
 *    A garbled date is our bug, not the member's. Reading it as "expired"
 *    would strip paying members the moment a writer misbehaved; reading
 *    it as "no expiry" leaves someone entitled slightly too long, which is
 *    recoverable by hand. `hasUnparseablePaidThrough` exists so writers
 *    can shout about it.
 *
 * WHY THIS FILE IS PURE. It is imported by client components (which read
 * the tier straight off the session's app_metadata to decide what to
 * render) and by server code. No I/O, no imports, no `server-only` — so
 * the same arithmetic governs both, and the button a member sees agrees
 * with the gate behind it.
 *
 * This is deliberately NOT behind the prepaid feature flag. Once a term
 * has been sold, flipping a flag off must not turn it into a permanent
 * membership. With nothing writing `paid_through`, enforcement is
 * already a no-op — the flag it needs is the absence of the key.
 */

/** The app_metadata key holding the end of a prepaid or fixed term. */
export const PAID_THROUGH_KEY = "paid_through";

/** What the site's gates understand. Mirrors UserTier in src/lib/auth.ts. */
export type EntitledTier = "studio" | "pro" | "free";

/** The shape both auth.users.app_metadata and a session user hand us. */
export type TierMetadata = Record<string, unknown> | null | undefined;

/** The raw tier flag, with no clock applied. `free` for anything unknown. */
export function storedTier(metadata: TierMetadata): EntitledTier {
    const tier = metadata?.tier;
    return tier === "studio" || tier === "pro" ? tier : "free";
}

/**
 * `paid_through` as epoch milliseconds, or null for "no expiry".
 *
 * Null covers absent, null, non-string, blank and unparseable — see rule
 * 1 and rule 3 above. Every one of them means the tier stands.
 */
export function paidThroughMs(metadata: TierMetadata): number | null {
    const raw = metadata?.[PAID_THROUGH_KEY];
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * True when a `paid_through` is present but could not be read as a date.
 *
 * Diagnostic only — nothing gates on it. It lets a writer report the bug
 * without this module needing a logger.
 */
export function hasUnparseablePaidThrough(metadata: TierMetadata): boolean {
    const raw = metadata?.[PAID_THROUGH_KEY];
    if (typeof raw !== "string" || !raw.trim()) return false;
    return !Number.isFinite(Date.parse(raw.trim()));
}

/**
 * Has the clock run out?
 *
 * False whenever there is no clock. The boundary is inclusive: a term
 * that says it is paid through this exact instant is done.
 */
export function isTermExpired(metadata: TierMetadata, now: number = Date.now()): boolean {
    const end = paidThroughMs(metadata);
    return end !== null && end <= now;
}

/**
 * The tier actually in force: the stored tier, minus the clock.
 *
 * THE read-time enforcement point. Everything that decides what a member
 * may do funnels through here or through getUserTier(), which calls it.
 */
export function entitledTier(metadata: TierMetadata, now: number = Date.now()): EntitledTier {
    const tier = storedTier(metadata);
    if (tier === "free") return "free";
    return isTermExpired(metadata, now) ? "free" : tier;
}

/**
 * Add whole calendar months, in UTC, clamping to the end of the month.
 *
 * 31 January + 1 month is 28 February, not 3 March. Doing this with
 * `setUTCMonth` alone rolls over, which would quietly hand out an extra
 * few days every time and — worse — make a 12-month term land on a
 * different date depending on which month it was bought in. The day is
 * parked on the 1st while the month moves, then restored, clamped.
 *
 * The time of day is preserved, so a term bought at 14:05 ends at 14:05.
 */
export function addMonthsUtc(fromMs: number, months: number): number {
    const from = new Date(fromMs);
    const day = from.getUTCDate();

    const target = new Date(fromMs);
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + months);

    // Day 0 of the following month is the last day of this one.
    const lastDayOfTargetMonth = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();

    target.setUTCDate(Math.min(day, lastDayOfTargetMonth));
    return target.getTime();
}

/**
 * Where a newly bought term should end — the STACKING rule.
 *
 * Someone with two months left who buys another six has eight months, not
 * six. So the new term is measured from whichever is later: the end of
 * the term they already hold, or now. A term that has already run out
 * (or was never there) starts the clock from now, so a lapsed member does
 * not get billed for the gap they were away.
 *
 * Returns an ISO string because that is what goes into app_metadata; the
 * caller never does date arithmetic of its own.
 */
export function extendedPaidThrough(
    currentMetadata: TierMetadata,
    months: number,
    now: number = Date.now(),
): string {
    const existing = paidThroughMs(currentMetadata);
    const base = existing !== null && existing > now ? existing : now;
    return new Date(addMonthsUtc(base, months)).toISOString();
}

/**
 * A human phrase for a term's end date — "22 February 2027".
 *
 * Fixed to UTC and en-GB so the server-rendered string and the one a
 * member's browser would produce cannot disagree about which day it is.
 */
export function formatPaidThrough(value: string | null | undefined): string | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(parsed));
}
