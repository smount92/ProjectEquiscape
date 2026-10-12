import "server-only";

import { getPublicStats } from "@/lib/stats/publicStats";
import { registryClaim, REGISTRY_CLAIM_FALLBACK } from "@/lib/stats/registryClaim";

/** The Registry's size in words, from the hour-cached public count. */
export async function registryClaimLive(): Promise<string> {
    try {
        return registryClaim((await getPublicStats()).catalogItems);
    } catch {
        return REGISTRY_CLAIM_FALLBACK;
    }
}

/** The token a metadata template carries where the claim belongs. */
export const REGISTRY_TOKEN = "{{registry}}";

/**
 * Fill the token in every string of a plain object tree (metadata
 * templates), leaving non-plain values such as URL instances alone.
 */
export function withRegistryClaim<T>(value: T, claim: string): T {
    if (typeof value === "string") return value.split(REGISTRY_TOKEN).join(claim) as T;
    if (Array.isArray(value)) return value.map((v) => withRegistryClaim(v, claim)) as T;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = withRegistryClaim(v, claim);
        return out as T;
    }
    return value;
}
