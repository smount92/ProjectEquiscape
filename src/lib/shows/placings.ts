/**
 * Shows domain — THE single placing vocabulary. Pure, no I/O.
 *
 * `place` is an integer 1..6 (null = participation). Every label,
 * ribbon color, and champion string in the app derives from this
 * module — replacing the old system's six duplicated lookup
 * tables and the color-vs-placing split.
 */

import type { Place } from "./types";

export const MAX_PLACE = 6;

export const PLACES: Place[] = [1, 2, 3, 4, 5, 6];

const ORDINALS: Record<Place, string> = {
    1: "1st",
    2: "2nd",
    3: "3rd",
    4: "4th",
    5: "5th",
    6: "6th",
};

/** US ribbon colors, 1st through 6th (the hobby follows AHSA/NAMHSA convention). */
const RIBBON_COLORS: Record<Place, string> = {
    1: "blue",
    2: "red",
    3: "yellow",
    4: "white",
    5: "pink",
    6: "green",
};

/** Hex values for UI rendering, keyed by place. */
const RIBBON_HEX: Record<Place, string> = {
    1: "#2563eb", // blue
    2: "#dc2626", // red
    3: "#eab308", // yellow
    4: "#f8fafc", // white
    5: "#ec4899", // pink
    6: "#16a34a", // green
};

export function isValidPlace(place: number): place is Place {
    return Number.isInteger(place) && place >= 1 && place <= MAX_PLACE;
}

/** "1st" … "6th"; null → "Participant". */
export function placeLabel(place: Place | null): string {
    if (place === null) return "Participant";
    const label = ORDINALS[place];
    if (!label) throw new RangeError(`Invalid place: ${place} (expected 1..${MAX_PLACE} or null)`);
    return label;
}

/** Ribbon color name; null (participation) → null (no ribbon). */
export function ribbonColor(place: Place | null): string | null {
    if (place === null) return null;
    const color = RIBBON_COLORS[place];
    if (!color) throw new RangeError(`Invalid place: ${place} (expected 1..${MAX_PLACE} or null)`);
    return color;
}

/** Ribbon color as hex for UI; null → null. */
export function ribbonHex(place: Place | null): string | null {
    if (place === null) return null;
    const hex = RIBBON_HEX[place];
    if (!hex) throw new RangeError(`Invalid place: ${place} (expected 1..${MAX_PLACE} or null)`);
    return hex;
}

// ── Champion / reserve (callback ladder) ──

export type ChampionKind = "champion" | "reserve";

const CHAMPION_LABELS: Record<ChampionKind, string> = {
    champion: "Champion",
    reserve: "Reserve Champion",
};

/** Champion rosette colors per NAMHSA convention. */
const CHAMPION_COLORS: Record<ChampionKind, string> = {
    champion: "purple",
    reserve: "lavender",
};

/** Hex values for UI rendering — like ribbon colors, rosette
 *  colors are the hobby's convention and never themed. */
const CHAMPION_HEX: Record<ChampionKind, string> = {
    champion: "#7c3aed", // purple
    reserve: "#c4b5fd", // lavender
};

/**
 * "Section Champion", "Division Reserve Champion",
 * "Grand Champion" (show scope).
 */
export function championLabel(
    kind: ChampionKind,
    scope: "section" | "division" | "show" = "section",
): string {
    if (scope === "show") {
        return kind === "champion" ? "Grand Champion" : "Reserve Grand Champion";
    }
    const scopeLabel = scope === "section" ? "Section" : "Division";
    return `${scopeLabel} ${CHAMPION_LABELS[kind]}`;
}

export function championColor(kind: ChampionKind): string {
    return CHAMPION_COLORS[kind];
}

export function championHex(kind: ChampionKind): string {
    return CHAMPION_HEX[kind];
}

/**
 * Parse legacy/free-text placing strings ("1st", "2", "Champion")
 * into the integer vocabulary. Returns null for participation or
 * unparseable input — the adapter for old-system reads.
 */
export function parsePlace(raw: string | number | null | undefined): Place | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "number") return isValidPlace(raw) ? raw : null;
    const match = raw.trim().match(/^(\d+)/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    return isValidPlace(n) ? n : null;
}
