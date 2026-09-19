import { describe, it, expect } from "vitest";

import { linkEntries, normalizeStudioLinks } from "@/lib/studio/links";

describe("studio links", () => {
    it("turns handles into profile URLs and keeps full URLs", () => {
        expect(
            normalizeStudioLinks({
                instagram: "@blackfoxfarm",
                facebook: "https://www.facebook.com/BlackFoxFarmStudio/",
                etsy: "blackfoxfarm",
                website: "blackfoxfarm.com",
            }),
        ).toEqual({
            instagram: "https://www.instagram.com/blackfoxfarm/",
            facebook: "https://www.facebook.com/BlackFoxFarmStudio/",
            etsy: "https://www.etsy.com/shop/blackfoxfarm",
            website: "https://blackfoxfarm.com/",
        });
    });

    it("drops what it cannot make a safe link from", () => {
        expect(
            normalizeStudioLinks({
                instagram: "",
                facebook: "javascript:alert(1)",
                website: "not a site",
                etsy: 42,
                extra: "ignored",
            }),
        ).toEqual({});
        expect(normalizeStudioLinks(null)).toEqual({});
        expect(normalizeStudioLinks("nope")).toEqual({});
    });

    it("renders in display order with glyphs", () => {
        const entries = linkEntries({ website: "https://a.com/", instagram: "https://www.instagram.com/x/" });
        expect(entries.map((e) => e.key)).toEqual(["instagram", "website"]);
        expect(entries[0]).toMatchObject({ label: "Instagram", glyph: "📸" });
    });
});
