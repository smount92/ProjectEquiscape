import { describe, expect, it } from "vitest";
import { referenceLines } from "@/lib/passport/referenceLines";

describe("referenceLines", () => {
    it("names the parent mold for a release, never the release itself", () => {
        const lines = referenceLines({
            item_type: "plastic_release",
            title: "Zenyatta - Racehorse Royalty",
            maker: "Breyer",
            scale: "Traditional (1:9)",
            attributes: { release_year_start: 2012, model_number: "1773" },
            parent: { title: "Lonesome Glory", attributes: { release_year_start: 1999 } },
        });
        expect(lines.type).toBe("Mold");
        expect(lines.name).toBe("Lonesome Glory");
        expect(lines.moldKnown).toBe(true);
        expect(lines.extra).toBe("First released 1999");
    });

    it("falls back to the release's own year when the mold has none", () => {
        const lines = referenceLines({
            item_type: "plastic_release",
            title: "Deluxe Collector Club",
            maker: "Breyer",
            scale: "Stablemate (1:32)",
            attributes: { release_year_start: 2024 },
            parent: { title: "Horatio", attributes: {} },
        });
        expect(lines.name).toBe("Horatio");
        expect(lines.extra).toBe("First released 2024");
    });

    it("says so when a release is not filed under a mold, using the typed mold name if there is one", () => {
        const typed = referenceLines({
            item_type: "plastic_release",
            title: "#10060 Mystery Foal Surprise - Peaceful Gardens",
            maker: "Breyer",
            scale: "Stablemate (1:32)",
            attributes: { mold_name: "M1 Giorgio" },
            parent: null,
        });
        expect(typed.name).toBe("M1 Giorgio (not yet filed in the Registry)");
        expect(typed.moldKnown).toBe(false);
        const bare = referenceLines({ item_type: "plastic_release", title: "Seize The Day Surprise", maker: "Breyer", scale: null, attributes: {} });
        expect(bare.name).toBe("Not recorded for this release yet");
        expect(bare.scale).toBe("Unknown");
    });

    it("leaves molds and resins as they were", () => {
        expect(referenceLines({ item_type: "plastic_mold", title: "Silky Sullivan", maker: "Breyer", scale: "Classic (1:12)", attributes: { release_year_start: 1975 } })).toMatchObject({
            type: "Mold",
            name: "Silky Sullivan",
            extra: "First released 1975",
        });
        expect(referenceLines({ item_type: "artist_resin", title: "Mona", maker: "Sarah Minkiewicz-Breunig", scale: "Traditional (1:9)", attributes: { cast_medium: "Resin" } })).toMatchObject({
            type: "Artist Resin",
            name: "Mona",
            extra: "Resin",
        });
    });
});
