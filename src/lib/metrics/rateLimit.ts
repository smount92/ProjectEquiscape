/**
 * A crude, in-memory, per-instance limiter for the view beacon.
 *
 * Why not the existing DB-backed checkRateLimit (src/lib/utils/rateLimit.ts):
 * that costs a Postgres round trip per call, and the beacon fires on every
 * passport, show, barn, studio, reference and profile load on the site. It
 * would roughly double the cost of the cheapest write path we have, to
 * defend a counter that is already defended in the database (the RPC caps
 * one viewer at ten counted views of one object per UTC day).
 *
 * So this is the outer, cheap gate: a fixed-window counter in process
 * memory. Its honest properties, since a limiter that oversells itself is
 * worse than none:
 *
 *   - Per serverless instance, not global. N warm instances mean roughly
 *     N times the stated ceiling. That is fine — it exists to stop a loop,
 *     not a botnet, and the per-viewer DB cap is what protects the numbers.
 *   - Memory is bounded by MAX_TRACKED_KEYS. On overflow the whole map is
 *     dropped rather than evicted one at a time: an O(1) reset beats an
 *     LRU for a structure that is meant to be forgettable, and the worst
 *     case is that a burst gets one extra window's allowance.
 *   - Keys are IPs, held for at most one window and never written down.
 */

/** Requests one IP may make in a window before the beacon starts refusing. */
export const MAX_PER_WINDOW = 60;
/** Window length. */
export const WINDOW_MS = 60_000;
/** Hard ceiling on the map before it is dropped wholesale. */
export const MAX_TRACKED_KEYS = 10_000;

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Test seam — forget every bucket. */
export function resetBeaconRateLimit(): void {
    buckets.clear();
}

/** How many keys are currently held. Exposed for tests and nothing else. */
export function trackedKeyCount(): number {
    return buckets.size;
}

/**
 * True when this key may proceed. Call once per beacon request.
 *
 * `now` is injectable so the window behaviour is testable without timers.
 */
export function allowBeacon(key: string, now: number = Date.now()): boolean {
    if (buckets.size >= MAX_TRACKED_KEYS) {
        // See the note above: a wholesale drop, not an eviction pass.
        buckets.clear();
    }

    const existing = buckets.get(key);

    if (!existing || now >= existing.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }

    if (existing.count >= MAX_PER_WINDOW) return false;

    existing.count += 1;
    return true;
}
