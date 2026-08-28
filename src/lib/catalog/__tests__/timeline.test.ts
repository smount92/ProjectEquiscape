import { describe, expect, it } from "vitest";
import {
    buildArtistCareer,
    buildMoldTimeline,
    familyBase,
    normalizeYear,
} from "@/lib/catalog/timeline";

const src = (title: string, attrs: Record<string, unknown> = {}) => ({
    id: `id-${title}-${JSON.stringify(attrs).length}-${Math.abs(JSON.stringify(attrs).split("").reduce((a, c) => a + c.charCodeAt(0), 0))}`,
    title,
    makerSlug: "breyer",
    slug: null,
    attributes: attrs,
});

describe("normalizeYear", () => {
    it("accepts numbers and numeric strings, rejects junk", () => {
        expect(normalizeYear(1963)).toBe(1963);
        // The Atlas duplicate carried "2000" as a string.
        expect(normalizeYear("2000")).toBe(2000);
        expect(normalizeYear("  1994 ")).toBe(1994);
        expect(normalizeYear("unknown")).toBeNull();
        expect(normalizeYear(null)).toBeNull();
        expect(normalizeYear(180)).toBeNull();
    });
});

describe("buildMoldTimeline", () => {
    it("groups by decade in order and files undated separately", () => {
        const t = buildMoldTimeline([
            src("Dax", { release_year_start: 2022, model_number: "712433" }),
            src("King", { release_year_start: 1960, model_number: "35" }),
            src("Mystery Florentine", {}),
            src("Chaparral", { release_year_start: "1992", model_number: "855" }),
        ]);
        expect(t.decades.map((d) => d.label)).toEqual(["1960s", "1990s", "2020s"]);
        expect(t.undated).toHaveLength(1);
        expect(t.firstYear).toBe(1960);
        expect(t.lastYear).toBe(2022);
        expect(t.density).toEqual([["1960s", 1], ["1990s", 1], ["2020s", 1]]);
    });

    it("clusters same number+title+year variants into one row (Ponokah rule)", () => {
        const rows = [1, 2, 3, 4].map((i) =>
            src("Ponokah-Eemetah", {
                release_year_start: 1994,
                model_number: "897",
                color_description: `pattern ${i}`,
            }),
        );
        const t = buildMoldTimeline(rows);
        const decade = t.decades[0];
        expect(decade.releases).toHaveLength(1);
        expect(decade.releases[0].variants).toHaveLength(3);
        expect(t.total).toBe(1);
    });

    it("never clusters rows without a model number", () => {
        const t = buildMoldTimeline([
            src("BreyerFest Auction", { release_year_start: 1994 }),
            src("BreyerFest Auction", { release_year_start: 1994 }),
        ]);
        expect(t.decades[0].releases).toHaveLength(2);
    });

    it("keeps different years apart even with the same number (reissues)", () => {
        const t = buildMoldTimeline([
            src("King", { release_year_start: 1961, model_number: "30" }),
            src("King", { release_year_start: 1963, model_number: "30" }),
        ]);
        expect(t.decades[0].releases).toHaveLength(2);
    });
});

describe("familyBase", () => {
    it("folds size words and parentheticals into one base", () => {
        expect(familyBase("Micro Nitro")).toBe(familyBase("Nitro"));
        expect(familyBase("Haggis (mini)")).toBe(familyBase("Haggis (trad.)"));
        expect(familyBase("Crusher (mini, not shrinky)")).toBe(familyBase("Crusher"));
    });
    it("keeps genuinely different sculpts apart", () => {
        expect(familyBase("Nitro")).not.toBe(familyBase("Sendai"));
    });
});

describe("buildArtistCareer", () => {
    const own = [
        { ...src("The Nemisis", { release_year_start: 2017 }), itemType: "artist_resin", scale: "Traditional (1:9)" },
        { ...src("Nitro", {}), itemType: "artist_resin", scale: "Traditional (1:9)" },
        { ...src("Micro Nitro", {}), itemType: "artist_resin", scale: "Micro Mini" },
    ];
    const factory = [
        { ...src("Chips Stock Horse", { release_year_start: 2004 }), itemType: "plastic_mold", scale: null, maker: "Peter Stone" },
    ];

    it("braids both lanes chronologically", () => {
        const c = buildArtistCareer(own, factory);
        expect(c.dated.map((w) => `${w.year}:${w.lane}`)).toEqual(["2004:factory", "2017:studio"]);
        expect(c.studioCount).toBe(3);
        expect(c.factoryCount).toBe(1);
    });

    it("shelves undated studio work by scale — families do not merge across scales", () => {
        const c = buildArtistCareer(own, factory);
        const labels = c.shelf.map((s) => s.scaleLabel);
        expect(labels).toContain("Traditional (1:9)");
        expect(labels).toContain("Micro Mini");
        // Nitro and Micro Nitro live on different scale shelves; each
        // shelf's family list keeps its own entry.
        const trad = c.shelf.find((s) => s.scaleLabel === "Traditional (1:9)");
        expect(trad?.families.some((f) => f.works.some((w) => w.title === "Nitro"))).toBe(true);
    });
});

describe("buildSurvey", () => {
    const rows = [
        src("King #35", { release_year_start: 1961, release_year_end: 1987, model_number: "35" }),
        src("King #30", { release_year_start: 1963, release_year_end: 1985, model_number: "30" }),
        src("Dax", { release_year_start: 2022, model_number: "712433" }),
        src("Jewels", { release_year_start: 2022, model_number: "1866" }),
    ];

    it("draws runs at true scale and bins singles into per-year dots", async () => {
        const { buildSurvey } = await import("@/lib/catalog/timeline");
        const s = buildSurvey(buildMoldTimeline(rows));
        expect(s).not.toBeNull();
        expect(s!.first).toBe(1961);
        expect(s!.last).toBe(2022);
        expect(s!.runs).toHaveLength(2);
        // 27 of 62 years ≈ 43% of the axis — geometry, not vibes.
        expect(s!.runs[0].widthPct).toBeGreaterThan(40);
        const dax = s!.dots.find((d) => d.year === 2022);
        expect(dax?.count).toBe(2);
    });

    it("returns null for short histories — the Ledger alone suffices", async () => {
        const { buildSurvey } = await import("@/lib/catalog/timeline");
        const s = buildSurvey(
            buildMoldTimeline([src("A", { release_year_start: 2020 }), src("B", { release_year_start: 2024 })]),
        );
        expect(s).toBeNull();
    });
});
