/**
 * Show Ring v2 — action view models. The card shape matches the
 * legacy ShowRingCard (src/app/actions/community.ts) exactly so the
 * card markup could be ported without a redesign.
 */

/** One public horse card in the Show Ring grid. */
export interface ShowRingCard {
    id: string;
    ownerId: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    /** "Maker Title" from the catalog join, or "Unlisted Mold". */
    refName: string;
    ownerAlias: string;
    thumbnailUrl: string | null;
    sculptor: string | null;
    tradeStatus: string;
    listingPrice: number | null;
    marketplaceNotes: string | null;
    moldName: string | null;
    catalogId: string | null;
    favoriteCount: number;
    isFavorited: boolean;
    scale: string | null;
    hoofprintCount: number;
    assetCategory: string;
}

/**
 * Facet dropdown options across ALL public horses (never derived from
 * the loaded page — that was the old first-24-only facet bug).
 */
export interface ShowRingFacetOptions {
    makers: string[];
    scales: string[];
    finishes: string[];
}
