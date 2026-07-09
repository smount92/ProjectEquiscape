/**
 * Shows v2 feature flag. The rebuilt show system ships dark:
 * set NEXT_PUBLIC_SHOWS_V2=1 to enable. Default OFF.
 */
export function showsV2Enabled(): boolean {
    return process.env.NEXT_PUBLIC_SHOWS_V2 === "1";
}
