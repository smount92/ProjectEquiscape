/**
 * How big the Registry is, in words — one owner.
 *
 * "10,500+" was typed into eleven places (metadata, the FAQ, the data
 * policy, the import page) and stopped being true months ago; the
 * Registry passed 11,700 entries in October 2026. Every claim now comes
 * from the live count, rounded DOWN to the nearest hundred so it is
 * never an overstatement, with one fallback for a render that has no
 * count to hand.
 */

/** Used only when no count is available (build box without Supabase env, a failed read). */
export const REGISTRY_CLAIM_FALLBACK = "11,000+";

/** "11,794" → "11,700+"; null/invalid → the fallback. */
export function registryClaim(count: number | null | undefined): string {
    if (typeof count !== "number" || !Number.isFinite(count) || count < 100) return REGISTRY_CLAIM_FALLBACK;
    const floored = Math.floor(count / 100) * 100;
    return `${floored.toLocaleString("en-US")}+`;
}
