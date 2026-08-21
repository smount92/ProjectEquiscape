/**
 * The shape of the landing page's public counters, and the one rule that
 * governs them — kept free of `server-only` so the component that renders
 * them (and its tests) can import it without dragging the Supabase read
 * path along.
 *
 * The fetcher lives next door in publicStats.ts.
 */

export interface PublicStats {
    /** Reference entries in the Registry. */
    catalogItems: number | null;
    /** Horses their owners have made public. */
    publicHorses: number | null;
    /** Shows whose results are published and final. */
    showsCompleted: number | null;
    /** Horses currently For Sale or Open to Offers. */
    listingsForSale: number | null;
}

export const NO_PUBLIC_STATS: PublicStats = {
    catalogItems: null,
    publicHorses: null,
    showsCompleted: null,
    listingsForSale: null,
};

/**
 * A stat earns its place on the front door only if the read came back with
 * something worth printing.
 *
 * `null` means the read failed — say nothing rather than guess. Zero is a
 * truthful answer but a poor advertisement ("0 shows judged"), so it is
 * also withheld. There is deliberately no fallback constant anywhere in
 * this pair of files: a number on the landing page is a number the
 * database confirmed, or it is absent.
 */
export function statIsPresentable(value: number | null): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}
