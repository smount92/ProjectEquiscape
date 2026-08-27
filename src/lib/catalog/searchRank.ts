/**
 * Ranking for the link-a-model reference search.
 *
 * THE ORDER IS THE PRODUCT. The first version of the search dropdown
 * partitioned results into fixed sections (Molds, Releases, Artist
 * Resins last), which silently destroyed the similarity ranking the
 * database computed: an EXACT-title resin match rendered below every
 * fuzzy Breyer release, and every item type outside those three
 * sections was dropped entirely. This module puts relevance back in
 * charge and reduces type to a soft, context-aware nudge.
 *
 * Tiers, strongest first:
 *   1. exact title match (case-insensitive)
 *   2. title prefix match
 *   3. everything else, in the order the trigram RPC returned
 * Within a tier, entries whose item_type fits the declared finish of
 * the horse being linked float first — an Artist Resin horse probably
 * links a resin; an OF or Custom links a mold or release. It is a
 * BOOST, never a filter: a custom on an OF body legitimately links to
 * plastic, so nothing is ever hidden by context.
 */

export interface RankableItem {
    title: string;
    itemType: string;
}

/** Item types that fit each declared finish. Missing finish = no boost. */
const FINISH_AFFINITY: Record<string, ReadonlySet<string>> = {
    "Artist Resin": new Set(["artist_resin", "factory_resin", "medallion", "micro_mini"]),
    OF: new Set(["plastic_mold", "plastic_release", "china"]),
    // Customs start life as OF plastic — the base mold is the link target.
    Custom: new Set(["plastic_mold", "plastic_release"]),
};

function tierOf(queryLower: string, titleLower: string): number {
    if (titleLower === queryLower) return 0;
    if (titleLower.startsWith(queryLower)) return 1;
    return 2;
}

export function rankSearchResults<T extends RankableItem>(
    results: readonly T[],
    query: string,
    finishType?: string | null,
): T[] {
    const q = query.trim().toLowerCase();
    const affinity = finishType ? FINISH_AFFINITY[finishType] : undefined;
    // Decorate with the original index so the sort stays stable on the
    // RPC's similarity order wherever the tiers tie.
    return results
        .map((item, i) => ({
            item,
            tier: tierOf(q, item.title.trim().toLowerCase()),
            fits: affinity?.has(item.itemType) ? 0 : 1,
            i,
        }))
        .sort((a, b) => a.tier - b.tier || a.fits - b.fits || a.i - b.i)
        .map((d) => d.item);
}

/** Display badge per item type — type is information, not a hierarchy. */
export const ITEM_TYPE_BADGES: Record<string, string> = {
    plastic_mold: "Mold",
    plastic_release: "Release",
    artist_resin: "Resin",
    factory_resin: "Factory Resin",
    china: "China",
    micro_mini: "Micro Mini",
    medallion: "Medallion",
    tack: "Tack",
    prop: "Prop",
    diorama: "Diorama",
};

/** Filter chips shown over the results — the user's manual override. */
export const SEARCH_TYPE_FILTERS = [
    { key: "all", label: "All", types: null },
    { key: "of", label: "OF / Breyer", types: new Set(["plastic_mold", "plastic_release", "china"]) },
    { key: "resin", label: "Resins", types: new Set(["artist_resin", "factory_resin", "medallion", "micro_mini"]) },
] as const;

export type SearchTypeFilterKey = (typeof SEARCH_TYPE_FILTERS)[number]["key"];

export function applyTypeFilter<T extends RankableItem>(
    results: readonly T[],
    key: SearchTypeFilterKey,
): T[] {
    const def = SEARCH_TYPE_FILTERS.find((f) => f.key === key);
    if (!def || !def.types) return [...results];
    return results.filter((r) => def.types.has(r.itemType));
}
