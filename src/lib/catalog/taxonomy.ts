/**
 * Reference Catalog — Taxonomy v2 (the single source of truth).
 *
 * Before this file, scale had FIVE divergent vocabularies (suggestion
 * form, quick chips, studio setup, the delta importer, and the raw
 * DISTINCT facet over whatever the column held) and item_type had
 * three. Every list below is THE list; forms, filters, importers,
 * and the entry-rules matcher all import from here.
 *
 * Canonical scale spelling is the parenthesized form production data
 * already uses ("Traditional (1:9)") — migration 154 normalizes the
 * stored rows and both classlists' allowed_scales in lockstep.
 */

/** Canonical scales, display order. Community vocabulary, horse-first. */
export const CANONICAL_SCALES = [
    "Traditional (1:9)",
    "Classic (1:12)",
    "Pebbles (1:18)",
    "Paddock Pal (1:24)",
    "Stablemate (1:32)",
    "Mini Whinnies (1:64)",
    "Micro Mini",
    "Curio",
    "Plush",
    "Other",
] as const;

export type CanonicalScale = (typeof CANONICAL_SCALES)[number];

/**
 * Every known variant (lowercased) → its canonical scale. Sources:
 * the five legacy lists, migration 114's data fixes, and the delta
 * importer's SCALE_MAP.
 */
const SCALE_ALIASES: Record<string, CanonicalScale> = {
    traditional: "Traditional (1:9)",
    "animal traditional": "Traditional (1:9)",
    "gallery crystal": "Traditional (1:9)",
    "1:9": "Traditional (1:9)",
    classic: "Classic (1:12)",
    "1:12": "Classic (1:12)",
    pebbles: "Pebbles (1:18)",
    "1:18": "Pebbles (1:18)",
    "paddock pal": "Paddock Pal (1:24)",
    "paddock pals": "Paddock Pal (1:24)",
    "paddock pals (1:24)": "Paddock Pal (1:24)",
    "little bit": "Paddock Pal (1:24)",
    "little bits": "Paddock Pal (1:24)",
    "1:24": "Paddock Pal (1:24)",
    stablemate: "Stablemate (1:32)",
    stablemates: "Stablemate (1:32)",
    "stablemates (1:32)": "Stablemate (1:32)",
    "1:32": "Stablemate (1:32)",
    "mini whinnie": "Mini Whinnies (1:64)",
    "mini whinnies": "Mini Whinnies (1:64)",
    "1:64": "Mini Whinnies (1:64)",
    "micro mini": "Micro Mini",
    micro: "Micro Mini",
    curio: "Curio",
    plush: "Plush",
    other: "Other",
};

/** Fast lookup: lowercased canonical forms are canonical too. */
const CANONICAL_BY_LOWER = new Map<string, CanonicalScale>(
    CANONICAL_SCALES.map((s) => [s.toLowerCase(), s]),
);

/**
 * Normalize a raw scale string to its canonical form. Unknown values
 * pass through TRIMMED but otherwise verbatim (the catalog holds
 * oddities like vintage chalkware sizes we haven't cataloged as
 * vocabulary yet — better honest passthrough than a wrong bucket).
 * Empty input returns null.
 */
export function normalizeScale(raw: string | null | undefined): string | null {
    const trimmed = (raw ?? "").trim();
    if (trimmed === "") return null;
    const lower = trimmed.toLowerCase();
    return CANONICAL_BY_LOWER.get(lower) ?? SCALE_ALIASES[lower] ?? trimmed;
}

/**
 * Item categories ("Category" to users, item_type in the DB) — the
 * full CHECK-constraint vocabulary after migration 154. Includes the
 * previously unreachable populated types (micro_mini has real rows
 * from the Maggie Bennett import) and the community-requested
 * factory_resin and china. Deliberately NO "custom" category —
 * customs are horses (finish_type), not catalog entries; mold pages
 * grow a "Customs of this mold" gallery instead.
 */
export const CATALOG_CATEGORIES = [
    { value: "plastic_mold", label: "Mold" },
    { value: "plastic_release", label: "Release" },
    { value: "artist_resin", label: "Artist Resin" },
    { value: "factory_resin", label: "Factory Resin" },
    { value: "china", label: "China / Ceramic" },
    { value: "micro_mini", label: "Micro Mini" },
    { value: "medallion", label: "Medallion" },
    { value: "tack", label: "Tack / Accessory" },
    { value: "prop", label: "Prop" },
    { value: "diorama", label: "Diorama" },
] as const;

export type CatalogCategoryValue = (typeof CATALOG_CATEGORIES)[number]["value"];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
    CATALOG_CATEGORIES.map((c) => [c.value, c.label]),
);

/**
 * Suggestion-form → DB item_type. Accepts both the legacy short
 * values stored in older pending suggestions (release/mold/resin)
 * and canonical values, so re-approving an old suggestion still
 * lands right. Returns null for anything unrecognized — callers
 * must surface that instead of silently minting a mold (the old
 * behavior that made bad data look clean).
 */
const SUGGESTION_ITEM_TYPE_MAP: Record<string, CatalogCategoryValue> = {
    // Legacy suggestion-form values (pre-taxonomy-v2 pending rows).
    release: "plastic_release",
    mold: "plastic_mold",
    resin: "artist_resin",
    // Canonical values map to themselves.
    ...Object.fromEntries(CATALOG_CATEGORIES.map((c) => [c.value, c.value])),
};

export function suggestionItemTypeToDb(raw: string | null | undefined): CatalogCategoryValue | null {
    if (!raw) return null;
    return SUGGESTION_ITEM_TYPE_MAP[raw] ?? null;
}
