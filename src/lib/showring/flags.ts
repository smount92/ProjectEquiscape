/**
 * Show Ring v2 feature flag. The filter-engine rebuild of /community
 * ships dark: set NEXT_PUBLIC_SHOWRING_V2=1 to enable. Default OFF —
 * with the flag off, /community renders today's page untouched.
 */
export function showRingV2Enabled(): boolean {
    return process.env.NEXT_PUBLIC_SHOWRING_V2 === "1";
}
