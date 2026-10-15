/**
 * Every cache tag on the site, in one place (docs/STANDARDS.md, Caching).
 *
 * A shared cache (unstable_cache) names its tag from here, and a mutation
 * clears it with revalidateTag(CACHE_TAGS.x, "max"). A string typed
 * anywhere else is refused by src/__tests__/cache-tags.test.ts: before
 * this file, eleven revalidateTag calls cleared tags no cache carried,
 * and did nothing.
 */
export const CACHE_TAGS = {
    /** Reference pages, maker hubs, set mentions, old addresses. */
    referencePages: "reference-pages",
    /** The site-wide announcement bar. */
    announcements: "announcements",
    /** The public calendar of outside shows. */
    externalShows: "external-shows",
    /** Market price summaries. */
    marketPrices: "market-prices",
    /** Home-page counts (members, horses, Registry size). */
    publicStats: "public-stats",
    /** The public list of hosted shows. */
    publicShows: "public-shows",
    /** Results of closed legacy photo shows. */
    showResults: "show-results",
    /** Show Ring facets built from public horses. */
    showRing: "show-ring",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
