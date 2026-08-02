/**
 * Favorites page data shaping — pure, testable.
 *
 * The /favorites query joins horse_favorites → user_horses. RLS on
 * user_horses (migration 112: owner OR public+not-deleted) means the
 * joined horse comes back NULL for horses that went private/unlisted
 * or were soft-deleted since favoriting (unless the viewer owns
 * them). This module decides what each favorite row becomes on the
 * page:
 *
 *  - "available"   → the horse is public and alive: render the card.
 *  - "unavailable" → the join was null, or the horse is no longer
 *                    public (covers the viewer's OWN private horses,
 *                    which RLS does return — the Favorites grid is a
 *                    PUBLIC-horses surface, so they get the same
 *                    dimmed row and we render NO horse details).
 *
 * Unavailable rows carry only ids — never horse fields — so nothing
 * private can leak into the markup.
 */

/** Page size for /favorites ("use server" modules can't export consts). */
export const FAVORITES_PAGE_SIZE = 48;

export interface RawFavoriteHorse {
    id: string;
    custom_name: string;
    trade_status: string | null;
    listing_price: number | null;
    visibility: string | null;
    deleted_at: string | null;
    users: { alias_name: string | null } | null;
    horse_images: { image_url: string; angle_profile: string | null }[] | null;
}

export interface RawFavoriteRow {
    id: string;
    created_at: string;
    horse_id: string;
    user_horses: RawFavoriteHorse | null;
}

export interface AvailableFavorite {
    kind: "available";
    favoriteId: string;
    horseId: string;
    favoritedAt: string;
    name: string;
    ownerAlias: string;
    tradeStatus: string | null;
    listingPrice: number | null;
    /** Raw storage image_url — the action maps it to a public URL. */
    imagePath: string | null;
    /** Public thumbnail URL — filled in by the server action. */
    thumbnailUrl: string | null;
}

export interface UnavailableFavorite {
    kind: "unavailable";
    favoriteId: string;
    horseId: string;
    favoritedAt: string;
}

export type FavoriteEntry = AvailableFavorite | UnavailableFavorite;

/** Primary_Thumbnail if present, else the first image. */
export function pickImagePath(
    images: { image_url: string; angle_profile: string | null }[] | null | undefined,
): string | null {
    if (!images || images.length === 0) return null;
    const thumb = images.find((img) => img.angle_profile === "Primary_Thumbnail");
    return thumb?.image_url ?? images[0]?.image_url ?? null;
}

/** A joined horse renders as a card only if it is public and alive. */
export function isHorseAvailable(horse: RawFavoriteHorse | null): horse is RawFavoriteHorse {
    return horse !== null && horse.visibility === "public" && horse.deleted_at === null;
}

/**
 * Shape raw joined rows into page entries, preserving order
 * (newest-favorited first comes from the query's ORDER BY).
 */
export function shapeFavorites(rows: RawFavoriteRow[]): FavoriteEntry[] {
    return rows.map((row): FavoriteEntry => {
        const horse = row.user_horses;
        if (!isHorseAvailable(horse)) {
            return {
                kind: "unavailable",
                favoriteId: row.id,
                horseId: row.horse_id,
                favoritedAt: row.created_at,
            };
        }
        return {
            kind: "available",
            favoriteId: row.id,
            horseId: horse.id,
            favoritedAt: row.created_at,
            name: horse.custom_name,
            ownerAlias: horse.users?.alias_name ?? "Unknown",
            tradeStatus: horse.trade_status,
            listingPrice: horse.listing_price,
            imagePath: pickImagePath(horse.horse_images),
            thumbnailUrl: null,
        };
    });
}
