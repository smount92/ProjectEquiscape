/**
 * Digital Stable v2 feature flag. The filter-ledger dashboard rebuild
 * ships dark: set NEXT_PUBLIC_STABLE_V2=1 to enable. Default OFF —
 * with the flag off, /dashboard renders today's page untouched.
 */
export function stableV2Enabled(): boolean {
    return process.env.NEXT_PUBLIC_STABLE_V2 === "1";
}
