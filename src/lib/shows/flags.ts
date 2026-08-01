/**
 * Shows v2 feature flag. The rebuilt show system ships dark:
 * set NEXT_PUBLIC_SHOWS_V2=1 to enable. Default OFF.
 */
export function showsV2Enabled(): boolean {
    return process.env.NEXT_PUBLIC_SHOWS_V2 === "1";
}

/**
 * Season standings feature flag (Wave 3 — the sport layer v1).
 * Ships dark for owner + design review: set
 * NEXT_PUBLIC_SHOW_STANDINGS=1 to enable. Default OFF.
 * Gated surfaces: /standings (notFound when off) and the
 * flag-conditional Standings links that point at it.
 */
export function showStandingsEnabled(): boolean {
    return process.env.NEXT_PUBLIC_SHOW_STANDINGS === "1";
}
