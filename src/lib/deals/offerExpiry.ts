/**
 * How long a standing offer lives — and, more importantly, WHO decides.
 *
 * The number is not ours. It is enforced in SQL, inside
 * cleanup_system_garbage() (installed by migration 068, re-installed
 * unchanged by 092 and again by 175):
 *
 *   UPDATE public.transactions
 *      SET status = 'cancelled',
 *          metadata = COALESCE(metadata,'{}'::jsonb) || '{"auto_cancelled": true}'::jsonb
 *    WHERE status = 'offer_made'
 *      AND created_at < NOW() - INTERVAL '7 days';
 *
 * ...swept by /api/cron/refresh-market on "0 6 * * *" (vercel.json).
 *
 * The growth plan wants this tightened to 72 hours. Tightening it is a
 * migration, and this workstream writes none — so the countdown below
 * speaks the window that is ACTUALLY enforced today rather than the one
 * we would like. When the SQL changes, change this constant with it and
 * nothing else moves.
 *
 * Two honest wrinkles the copy has to survive:
 *
 *  · The sweep is daily, so an offer that passes its deadline at 14:00
 *    is not actually cancelled until 06:00 UTC the next morning. The
 *    countdown counts to the DEADLINE, not to the sweep — it never
 *    promises more time than the deal is entitled to.
 *  · Countering does not reset the clock. deal_offer_move_atomic
 *    (migration 173) updates offer_amount, offer_message and metadata,
 *    and deliberately leaves created_at alone, so the seven days run
 *    from the FIRST offer no matter how much haggling followed.
 */

/** The window enforced by cleanup_system_garbage(). Change both together. */
export const OFFER_EXPIRY_HOURS = 7 * 24;

const HOUR_MS = 60 * 60 * 1000;

export interface OfferCountdown {
    /** "6 days" / "14 hours" / "12 minutes" — no verb, the caller frames it. */
    label: string;
    /** Whole hours left, for "is this about to lapse" styling. */
    hoursLeft: number;
    /** ISO timestamp of the deadline, for a title/tooltip. */
    expiresAt: string;
}

/** When this offer lapses, or null if the timestamp is unusable. */
export function offerExpiresAt(createdAt: string | null | undefined): Date | null {
    if (!createdAt) return null;
    const made = new Date(createdAt).getTime();
    if (!Number.isFinite(made)) return null;
    return new Date(made + OFFER_EXPIRY_HOURS * HOUR_MS);
}

/**
 * The countdown for a standing offer, or null when there is nothing
 * honest to say — no timestamp, or the deadline has already passed (the
 * offer is doomed, waiting on the next sweep; a "0 minutes left" ticker
 * would be theatre).
 */
export function offerCountdown(
    createdAt: string | null | undefined,
    now: Date = new Date(),
): OfferCountdown | null {
    const expiry = offerExpiresAt(createdAt);
    if (!expiry) return null;

    const remaining = expiry.getTime() - now.getTime();
    if (remaining <= 0) return null;

    // The last sliver of a minute still rounds up to "1 minute" — while
    // the offer is live the countdown must never read zero.
    const minutes = Math.max(Math.floor(remaining / 60000), 1);
    const hours = Math.floor(remaining / HOUR_MS);
    const days = Math.floor(hours / 24);

    const label =
        days >= 1
            ? `${days} ${days === 1 ? "day" : "days"}`
            : hours >= 1
              ? `${hours} ${hours === 1 ? "hour" : "hours"}`
              : `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

    return { label, hoursLeft: hours, expiresAt: expiry.toISOString() };
}
