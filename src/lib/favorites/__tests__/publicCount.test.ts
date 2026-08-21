/**
 * Favorites as public likes — the count is only ever shown when it is
 * TRUE. `horse_favorites` has no anon SELECT policy today, so a
 * logged-out count comes back 0 under RLS; printing "0 favorites" on a
 * public passport would be a lie dressed as data. These tests pin that
 * contract so a future anon read path can't quietly change it.
 */
import { describe, expect, it } from "vitest";

import { favoriteCountLabel, publicFavoriteCount } from "@/lib/favorites/publicCount";

describe("favoriteCountLabel", () => {
    it("is singular at one, plural above", () => {
        expect(favoriteCountLabel(1)).toBe("1 favorite");
        expect(favoriteCountLabel(2)).toBe("2 favorites");
        expect(favoriteCountLabel(147)).toBe("147 favorites");
    });
});

describe("publicFavoriteCount", () => {
    it("passes a genuine positive count through", () => {
        expect(publicFavoriteCount(12, null)).toBe(12);
        expect(publicFavoriteCount(1, undefined)).toBe(1);
    });

    it("swallows zero — RLS-filtered and 'nobody yet' are the same read", () => {
        expect(publicFavoriteCount(0, null)).toBeNull();
    });

    it("swallows errors and junk rather than inventing a number", () => {
        expect(publicFavoriteCount(9, { message: "permission denied" })).toBeNull();
        expect(publicFavoriteCount(null, null)).toBeNull();
        expect(publicFavoriteCount(undefined, null)).toBeNull();
        expect(publicFavoriteCount(Number.NaN, null)).toBeNull();
        expect(publicFavoriteCount(-3, null)).toBeNull();
    });
});
