/**
 * Viewer tokens — the only place a person is touched by this subsystem,
 * and they never survive the day.
 *
 * To answer "how many DIFFERENT people saw this horse today" you need a
 * per-viewer marker. The privacy stance the owner ratified is that such a
 * marker must never become a trail, so:
 *
 *   1. It is a hash, not an identifier. Input is `u:<user id>` for members
 *      or `a:<ip>|<user agent>` for anonymous visitors. Neither the IP nor
 *      the user id ever leaves this process unhashed — the DB stores only
 *      the digest.
 *   2. The salt rotates every UTC day. Yesterday's digest for the same
 *      person is a different string from today's, so even two surviving
 *      scratch rows cannot be linked into a two-day trail.
 *   3. The digest lives in `object_view_scratch`, which the nightly GC
 *      (cleanup_system_garbage, migration 175) empties of anything older
 *      than the current UTC day. Maximum lifetime is one cron interval —
 *      roughly 24-30 hours. After that the permanent record is a count.
 *
 * HONEST LIMITATION, stated plainly because the privacy claim depends on
 * it: within the day, somebody holding BOTH the database and
 * METRICS_VIEWER_SALT could recompute the digest for a guessed viewer and
 * test whether that row exists. That is a real (if narrow) capability and
 * it is why the salt is an env secret rather than a constant, and why the
 * scratch is purged rather than retained. Set METRICS_VIEWER_SALT in the
 * deployment env; without it we fall back to a build constant, which keeps
 * the counts correct but makes that same-day test possible for anyone with
 * DB access alone.
 */

import { createHash } from "crypto";

/** Fallback used when METRICS_VIEWER_SALT is unset — see the note above. */
const FALLBACK_SALT = "mhh-object-metrics-unsalted";

/** Digest length in hex chars. 128 bits is far past collision concerns here. */
const HASH_HEX_LENGTH = 32;

/** The UTC calendar day a view belongs to, as `YYYY-MM-DD`. */
export function utcDay(at: Date = new Date()): string {
    return at.toISOString().slice(0, 10);
}

function sha256Hex(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * The day's salt: a digest of the secret and the UTC date. Deriving it
 * rather than storing it means nothing has to be rotated on a schedule and
 * there is no salt table to leak.
 */
export function dailySalt(secret: string, day: string): string {
    return sha256Hex(`mhh-metrics:v1:${secret}:${day}`);
}

/**
 * The pre-hash viewer key. Members are keyed by user id (stable and exact);
 * anonymous visitors by IP + user agent, which is the best a cookieless
 * system can do.
 *
 * Anon dedupe is explicitly BEST EFFORT and documented as such on /privacy:
 * a household or school behind one NAT collapses into one "unique viewer",
 * and a phone that changes IP mid-session counts twice. It is good enough
 * to stop a single reader inflating a number and nothing more.
 */
export function viewerKey(input: {
    userId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
}): string {
    if (input.userId) return `u:${input.userId}`;
    const ip = input.ip?.trim() || "unknown";
    const ua = input.userAgent?.trim() || "unknown";
    return `a:${ip}|${ua}`;
}

/**
 * The value written to the scratch table. Salt-then-key so the day's salt
 * prefixes every digest.
 */
export function viewerHash(secret: string, day: string, key: string): string {
    return sha256Hex(`${dailySalt(secret, day)}:${key}`).slice(0, HASH_HEX_LENGTH);
}

/** Reads the deployment secret, falling back per the note at the top. */
export function metricsSecret(): string {
    return process.env.METRICS_VIEWER_SALT || FALLBACK_SALT;
}

/** Convenience wrapper for the route handler: key → today's digest. */
export function hashViewer(
    input: { userId?: string | null; ip?: string | null; userAgent?: string | null },
    day: string = utcDay(),
    secret: string = metricsSecret(),
): string {
    return viewerHash(secret, day, viewerKey(input));
}
