import { describe, it, expect } from "vitest";
import {
    shapeFavorites,
    pickImagePath,
    isHorseAvailable,
    type RawFavoriteRow,
    type RawFavoriteHorse,
} from "../shape";

function horse(overrides: Partial<RawFavoriteHorse> = {}): RawFavoriteHorse {
    return {
        id: "horse-1",
        custom_name: "Avalon",
        trade_status: "For Sale",
        listing_price: 120,
        visibility: "public",
        deleted_at: null,
        users: { alias_name: "collector1" },
        horse_images: [
            { image_url: "path/full.jpg", angle_profile: "Left" },
            { image_url: "path/thumb.jpg", angle_profile: "Primary_Thumbnail" },
        ],
        ...overrides,
    };
}

function row(overrides: Partial<RawFavoriteRow> = {}): RawFavoriteRow {
    return {
        id: "fav-1",
        created_at: "2026-07-01T00:00:00Z",
        horse_id: "horse-1",
        user_horses: horse(),
        ...overrides,
    };
}

describe("pickImagePath", () => {
    it("prefers the Primary_Thumbnail image", () => {
        expect(pickImagePath(horse().horse_images)).toBe("path/thumb.jpg");
    });

    it("falls back to the first image when no thumbnail", () => {
        expect(pickImagePath([{ image_url: "a.jpg", angle_profile: "Left" }])).toBe("a.jpg");
    });

    it("returns null for empty or missing images", () => {
        expect(pickImagePath([])).toBeNull();
        expect(pickImagePath(null)).toBeNull();
        expect(pickImagePath(undefined)).toBeNull();
    });
});

describe("isHorseAvailable", () => {
    it("accepts a live public horse", () => {
        expect(isHorseAvailable(horse())).toBe(true);
    });

    it("rejects null (RLS filtered the join)", () => {
        expect(isHorseAvailable(null)).toBe(false);
    });

    it("rejects private / unlisted / soft-deleted horses", () => {
        expect(isHorseAvailable(horse({ visibility: "private" }))).toBe(false);
        expect(isHorseAvailable(horse({ visibility: "unlisted" }))).toBe(false);
        expect(isHorseAvailable(horse({ deleted_at: "2026-07-15T00:00:00Z" }))).toBe(false);
    });
});

describe("shapeFavorites", () => {
    it("shapes a public horse into an available entry", () => {
        const entries = shapeFavorites([row()]);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            kind: "available",
            favoriteId: "fav-1",
            horseId: "horse-1",
            favoritedAt: "2026-07-01T00:00:00Z",
            name: "Avalon",
            ownerAlias: "collector1",
            tradeStatus: "For Sale",
            listingPrice: 120,
            imagePath: "path/thumb.jpg",
            thumbnailUrl: null,
        });
    });

    it("turns a null join (private/deleted under RLS) into an id-only unavailable entry", () => {
        const entries = shapeFavorites([row({ user_horses: null })]);
        expect(entries[0]).toEqual({
            kind: "unavailable",
            favoriteId: "fav-1",
            horseId: "horse-1",
            favoritedAt: "2026-07-01T00:00:00Z",
        });
        // NO horse fields may leak onto unavailable entries.
        expect(Object.keys(entries[0]).sort()).toEqual(["favoriteId", "favoritedAt", "horseId", "kind"]);
    });

    it("treats the viewer's OWN private horse (join returned, not public) as unavailable", () => {
        const entries = shapeFavorites([row({ user_horses: horse({ visibility: "private" }) })]);
        expect(entries[0].kind).toBe("unavailable");
        expect(Object.keys(entries[0]).sort()).toEqual(["favoriteId", "favoritedAt", "horseId", "kind"]);
    });

    it("treats a soft-deleted horse as unavailable even if still public", () => {
        const entries = shapeFavorites([
            row({ user_horses: horse({ deleted_at: "2026-07-15T00:00:00Z" }) }),
        ]);
        expect(entries[0].kind).toBe("unavailable");
    });

    it("preserves row order (newest-favorited first comes from the query)", () => {
        const entries = shapeFavorites([
            row({ id: "fav-2", created_at: "2026-07-20T00:00:00Z" }),
            row({ id: "fav-1", created_at: "2026-07-01T00:00:00Z", user_horses: null }),
        ]);
        expect(entries.map((e) => e.favoriteId)).toEqual(["fav-2", "fav-1"]);
    });

    it("defaults missing owner alias to Unknown", () => {
        const entries = shapeFavorites([row({ user_horses: horse({ users: null }) })]);
        expect(entries[0]).toMatchObject({ kind: "available", ownerAlias: "Unknown" });
    });
});
