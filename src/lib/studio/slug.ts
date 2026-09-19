/**
 * Studio web addresses. ONE implementation for the form's preview and
 * the server's write — the two used to be hand-copies that could drift,
 * and the preview echoed whatever was typed rather than what would be
 * stored ("Willow Creek!" was promised, "willow-creek" was minted).
 *
 * RESERVED: the static segments under src/app/studio/ win over
 * [slug], so a studio named "Setup" would be minted and then never
 * reachable at its own address. Refuse those up front.
 */

export function slugifyStudio(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/** Route segments that live under /studio/ in the app tree. */
export const RESERVED_STUDIO_SLUGS: ReadonlySet<string> = new Set([
    "setup",
    "dashboard",
    "log-work",
    "my-commissions",
    "commission",
    "request",
    "new",
    "edit",
    "admin",
    "api",
]);

export function isReservedStudioSlug(slug: string): boolean {
    return RESERVED_STUDIO_SLUGS.has(slug);
}
