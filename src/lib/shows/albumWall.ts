/**
 * Wave 4b — THE WALL's pure data layer. No I/O, no React.
 *
 * The album show page renders every entry across all classes as one
 * photo wall. The server payload (getShowGallery) stays per-class;
 * these helpers flatten it into wall tiles, filter it by division
 * chip, and count the chips — so the client component stays a thin
 * renderer and the flatten/filter rules are unit-tested.
 *
 * THE BLIND RULE IS NOT RE-DERIVED HERE: a blind payload already
 * carries no owner identities (gallery.ts). Tiles copy fields from
 * the payload verbatim; nothing is inferred or reconstructed.
 */

import type { GalleryClass, GalleryEntry } from "./gallery";
import { placeLabel } from "./placings";

/** One tile on the wall: the entry plus where it came from. */
export interface WallTile {
    entry: GalleryEntry;
    classId: string;
    /** "3 · OF Quarter Horse" or the bare class name. */
    classLabel: string;
    divisionName: string;
}

/** "All horses" or one division (matched by name — the gallery
 *  payload carries division names, not ids). */
export type WallFilter = { kind: "all" } | { kind: "division"; divisionName: string };

export const WALL_FILTER_ALL: WallFilter = { kind: "all" };

export function wallClassLabel(cls: {
    classNumber: string | null;
    className: string;
}): string {
    return cls.classNumber ? `${cls.classNumber} · ${cls.className}` : cls.className;
}

/**
 * Flatten the per-class gallery into one wall, preserving the
 * program's order (classes in payload order, entries in payload
 * order within each class). Entries WITHOUT photos stay on the
 * wall — they render as placeholder tiles so class counts stay
 * honest — but only photo tiles join the lightbox reel
 * (wallLightboxImages).
 */
export function flattenGalleryToWall(
    classes: GalleryClass[],
    filter: WallFilter = WALL_FILTER_ALL,
): WallTile[] {
    const tiles: WallTile[] = [];
    for (const cls of classes) {
        if (filter.kind === "division" && cls.divisionName !== filter.divisionName) continue;
        for (const entry of cls.entries) {
            tiles.push({
                entry,
                classId: cls.classId,
                classLabel: wallClassLabel(cls),
                divisionName: cls.divisionName,
            });
        }
    }
    return tiles;
}

/** One chip per division, in first-appearance (program) order, with
 *  its live entry count — the number of TILES the chip would show. */
export function divisionChips(
    classes: GalleryClass[],
): { divisionName: string; entryCount: number }[] {
    const order: string[] = [];
    const counts = new Map<string, number>();
    for (const cls of classes) {
        if (!counts.has(cls.divisionName)) {
            order.push(cls.divisionName);
            counts.set(cls.divisionName, 0);
        }
        counts.set(cls.divisionName, (counts.get(cls.divisionName) ?? 0) + cls.entries.length);
    }
    return order.map((divisionName) => ({
        divisionName,
        entryCount: counts.get(divisionName) ?? 0,
    }));
}

/** Total tiles across the wall (the "All horses" chip count). */
export function wallEntryCount(classes: GalleryClass[]): number {
    return classes.reduce((sum, cls) => sum + cls.entries.length, 0);
}

/**
 * The filtered wall as ONE lightbox reel: photo tiles only, in wall
 * order, labeled "#12 · Dash of Cash · 3 · OF Quarter Horse · 1st"
 * (number and place only when present). Never includes owner
 * identity — the label is built from horse-facing fields regardless
 * of reveal state.
 */
export function wallLightboxImages(tiles: WallTile[]): { url: string; label: string }[] {
    return tiles
        .filter((tile) => tile.entry.photoUrl !== null)
        .map((tile) => ({
            url: tile.entry.photoUrl as string,
            label: [
                tile.entry.entryNumber !== null ? `#${tile.entry.entryNumber}` : null,
                tile.entry.horseName,
                tile.classLabel,
                tile.entry.place !== null ? placeLabel(tile.entry.place) : null,
            ]
                .filter(Boolean)
                .join(" · "),
        }));
}

/**
 * Map a tile to its index in the filtered reel (or -1 when the tile
 * has no photo and thus no reel slot) — the tap-to-lightbox hop.
 */
export function reelIndexForTile(tiles: WallTile[], tile: WallTile): number {
    const withPhotos = tiles.filter((t) => t.entry.photoUrl !== null);
    return withPhotos.findIndex((t) => t.entry.id === tile.entry.id);
}
