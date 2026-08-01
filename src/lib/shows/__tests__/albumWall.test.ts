/**
 * Wave 4b — the wall's pure data layer: flatten order, division
 * filtering, chip counts, and the one-reel lightbox mapping.
 */
import { describe, expect, it } from "vitest";

import type { GalleryClass, GalleryEntry } from "@/lib/shows/gallery";
import {
    divisionChips,
    flattenGalleryToWall,
    reelIndexForTile,
    WALL_FILTER_ALL,
    wallClassLabel,
    wallEntryCount,
    wallLightboxImages,
} from "@/lib/shows/albumWall";

let nextId = 0;
function entry(overrides: Partial<GalleryEntry> = {}): GalleryEntry {
    nextId += 1;
    return {
        id: `entry-${nextId}`,
        horseId: null,
        horseName: `Horse ${nextId}`,
        entryNumber: nextId,
        photoUrl: `https://cdn.test/photo-${nextId}.webp`,
        ownerAlias: null,
        ownerId: null,
        voteCount: 0,
        viewerHasVoted: false,
        isOwn: false,
        place: null,
        ...overrides,
    };
}

function cls(overrides: Partial<GalleryClass> = {}): GalleryClass {
    return {
        classId: `class-${nextId + 1}`,
        className: "OF Quarter Horse",
        classNumber: "1",
        divisionName: "OF Plastic Halter",
        sectionName: "Stock",
        classStatus: "scheduled",
        entries: [],
        ...overrides,
    };
}

describe("flattenGalleryToWall", () => {
    it("flattens every entry across all classes in program order", () => {
        const a1 = entry();
        const a2 = entry();
        const b1 = entry();
        const classes = [
            cls({ classId: "c1", entries: [a1, a2] }),
            cls({ classId: "c2", className: "CM Arabian", classNumber: "2", entries: [b1] }),
        ];
        const wall = flattenGalleryToWall(classes, WALL_FILTER_ALL);
        expect(wall.map((t) => t.entry.id)).toEqual([a1.id, a2.id, b1.id]);
        expect(wall[0].classLabel).toBe("1 · OF Quarter Horse");
        expect(wall[2].classLabel).toBe("2 · CM Arabian");
        expect(wall[2].classId).toBe("c2");
    });

    it("keeps entries WITHOUT photos on the wall (placeholder tiles)", () => {
        const noPhoto = entry({ photoUrl: null });
        const wall = flattenGalleryToWall([cls({ entries: [noPhoto] })]);
        expect(wall).toHaveLength(1);
        expect(wall[0].entry.photoUrl).toBeNull();
    });

    it("filters to one division by name", () => {
        const halter = entry();
        const perf = entry();
        const classes = [
            cls({ classId: "c1", divisionName: "Halter", entries: [halter] }),
            cls({ classId: "c2", divisionName: "Performance", entries: [perf] }),
        ];
        const wall = flattenGalleryToWall(classes, {
            kind: "division",
            divisionName: "Performance",
        });
        expect(wall.map((t) => t.entry.id)).toEqual([perf.id]);
        expect(wall[0].divisionName).toBe("Performance");
    });

    it("defaults to the all-horses filter", () => {
        const classes = [cls({ entries: [entry(), entry()] })];
        expect(flattenGalleryToWall(classes)).toHaveLength(2);
    });

    it("copies payload fields verbatim — never re-derives owner identity", () => {
        const blind = entry({ ownerAlias: null, ownerId: null, horseId: null });
        const wall = flattenGalleryToWall([cls({ entries: [blind] })]);
        expect(wall[0].entry.ownerAlias).toBeNull();
        expect(wall[0].entry.ownerId).toBeNull();
        expect(wall[0].entry.horseId).toBeNull();
    });
});

describe("divisionChips / wallEntryCount", () => {
    it("builds one chip per division in first-appearance order with tile counts", () => {
        const classes = [
            cls({ classId: "c1", divisionName: "Halter", entries: [entry(), entry()] }),
            cls({ classId: "c2", divisionName: "Performance", entries: [entry()] }),
            // Halter appears again later — counts merge, order keeps slot 1.
            cls({ classId: "c3", divisionName: "Halter", entries: [entry()] }),
        ];
        expect(divisionChips(classes)).toEqual([
            { divisionName: "Halter", entryCount: 3 },
            { divisionName: "Performance", entryCount: 1 },
        ]);
        expect(wallEntryCount(classes)).toBe(4);
    });

    it("counts photo-less entries too (chips match visible tiles)", () => {
        const classes = [
            cls({ classId: "c1", divisionName: "Halter", entries: [entry({ photoUrl: null })] }),
        ];
        expect(divisionChips(classes)).toEqual([{ divisionName: "Halter", entryCount: 1 }]);
    });

    it("returns no chips for an empty gallery", () => {
        expect(divisionChips([])).toEqual([]);
        expect(wallEntryCount([])).toBe(0);
    });
});

describe("wallLightboxImages / reelIndexForTile", () => {
    it("reels only photo tiles, in wall order, with #num · horse · class labels", () => {
        const withPhoto = entry({ entryNumber: 7, horseName: "Dash of Cash" });
        const noPhoto = entry({ photoUrl: null });
        const second = entry({ entryNumber: null, horseName: "Bareback" });
        const wall = flattenGalleryToWall([
            cls({ classId: "c1", entries: [withPhoto, noPhoto, second] }),
        ]);
        const reel = wallLightboxImages(wall);
        expect(reel).toHaveLength(2);
        expect(reel[0].url).toBe(withPhoto.photoUrl);
        expect(reel[0].label).toBe("#7 · Dash of Cash · 1 · OF Quarter Horse");
        // No entry number → the label just skips it.
        expect(reel[1].label).toBe("Bareback · 1 · OF Quarter Horse");
    });

    it("appends the place label once results publish", () => {
        const placed = entry({ entryNumber: 3, horseName: "Ribbons", place: 1 });
        const wall = flattenGalleryToWall([cls({ entries: [placed] })]);
        expect(wallLightboxImages(wall)[0].label).toBe(
            "#3 · Ribbons · 1 · OF Quarter Horse · 1st",
        );
    });

    it("maps a tile to its reel slot, skipping photo-less tiles", () => {
        const first = entry();
        const gap = entry({ photoUrl: null });
        const third = entry();
        const wall = flattenGalleryToWall([cls({ entries: [first, gap, third] })]);
        expect(reelIndexForTile(wall, wall[0])).toBe(0);
        // The photo-less tile has no slot in the reel.
        expect(reelIndexForTile(wall, wall[1])).toBe(-1);
        // The third tile is the SECOND reel image.
        expect(reelIndexForTile(wall, wall[2])).toBe(1);
    });
});

describe("wallClassLabel", () => {
    it("prefixes the class number when present", () => {
        expect(wallClassLabel({ classNumber: "12", className: "CM Arabian" })).toBe(
            "12 · CM Arabian",
        );
        expect(wallClassLabel({ classNumber: null, className: "CM Arabian" })).toBe("CM Arabian");
    });
});
