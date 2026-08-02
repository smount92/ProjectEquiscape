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

/**
 * Album show page feature flag (Wave 4b — photos first, program
 * second). Ships dark for the design lead's preview: set
 * NEXT_PUBLIC_SHOW_PAGE_V3=1 to enable. Default OFF.
 * With the flag off, PublicShowV2Page renders its legacy tree
 * unchanged (instant rollback); with it on, the sibling
 * AlbumShowPage takes over the same route + payloads.
 */
export function showPageV3Enabled(): boolean {
    return process.env.NEXT_PUBLIC_SHOW_PAGE_V3 === "1";
}

/**
 * Passport v2 feature flag (masthead + buyer panel). The rebuilt
 * public-passport top — leather masthead where the horse's name is
 * the H1, plus the single honest buyer panel on For Sale horses —
 * ships dark: set NEXT_PUBLIC_PASSPORT_V2=1 to enable. Default OFF.
 * With the flag off, /community/[id] (authed) and AnonPassport render
 * their current trees byte-identically (instant rollback).
 */
export function passportV2Enabled(): boolean {
    return process.env.NEXT_PUBLIC_PASSPORT_V2 === "1";
}

/**
 * Catalog cards browse feature flag (growth — identification cards).
 * Ships dark: set NEXT_PUBLIC_CATALOG_V2=1 to enable. Default OFF.
 * With the flag off, /catalog renders the existing five-column table
 * unchanged; with it on, the same route + data render identification
 * cards (thumbnail · disambiguation line · chips) with a compact-table
 * toggle for power curators.
 */
export function catalogV2Enabled(): boolean {
    return process.env.NEXT_PUBLIC_CATALOG_V2 === "1";
}
