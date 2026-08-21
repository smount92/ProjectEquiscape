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

/**
 * Canonical scales in DISPLAY ORDER: largest physical model first
 * (by ratio where one exists), then the small china/artist lines,
 * with the catch-alls last. Dropdowns and facet lists render in
 * exactly this order — never alphabetically.
 */
export const CANONICAL_SCALES = [
    "Traditional (1:9)",
    "Classic (1:12)",
    "Pebbles (1:18)",
    "Paddock Pal (1:24)",
    "Stablemate (1:32)",
    "Mini Whinnies (1:64)",
    "Venti",
    "Curio",
    "Micro Mini",
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
    pebble: "Pebbles (1:18)",
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
    "micro mini (1:64)": "Micro Mini",
    micro: "Micro Mini",
    venti: "Venti",
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
    // "Unknown" is not a scale — an absent scale is honest NULL.
    if (trimmed === "" || trimmed.toLowerCase() === "unknown") return null;
    const lower = trimmed.toLowerCase();
    return CANONICAL_BY_LOWER.get(lower) ?? SCALE_ALIASES[lower] ?? trimmed;
}

/**
 * Sort scale values largest-model-first (CANONICAL_SCALES order).
 * Unknown values sort after the vocabulary, alphabetically — visible
 * at the bottom of a dropdown instead of shuffled into it. Used on
 * the facet lists, which are data-driven (DISTINCT over the column)
 * and would otherwise render alphabetically.
 */
export function sortScalesBySize(scales: readonly string[]): string[] {
    const rank = (s: string): number => {
        const norm = normalizeScale(s);
        const idx = norm ? (CANONICAL_SCALES as readonly string[]).indexOf(norm) : -1;
        return idx === -1 ? CANONICAL_SCALES.length : idx;
    };
    return [...scales].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
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

// ── Attribution split (owner decision 2026-08-19) ──
// A catalog row credits up to two parties: the ARTIST (a person —
// the sculptor of a factory mold, or the resin artist) and the
// MANUFACTURER (a company — Breyer, North Light; NULL for
// one-person artist pieces). The legacy `maker` column remains the
// row's primary attribution and the permanent basis of maker_slug
// URLs — the split adds semantics, it never re-slugs.

/** Categories whose primary attribution is a person, not a company. */
export const ARTIST_ATTRIBUTED_CATEGORIES: ReadonlySet<string> = new Set([
    "artist_resin",
    "micro_mini",
    "medallion",
]);

/** The user-facing label for the primary-attribution field. */
export function attributionLabel(itemType: string | null | undefined): "Artist" | "Manufacturer" {
    return itemType && ARTIST_ATTRIBUTED_CATEGORIES.has(itemType) ? "Artist" : "Manufacturer";
}

export interface Attribution {
    artist: string | null;
    manufacturer: string | null;
}

/**
 * Companies the hobby recognizes as manufacturers (MHI-reviewed list
 * 2026-08 + known factory names in the data). The 156 backfill set
 * manufacturer = maker for every factory-category row — but some of
 * those rows carry a PERSON in maker (artist sculptures imported as
 * molds), which polluted the Manufacturer facet with artist names.
 * Migration 161 moves any manufacturer NOT on this list to artist;
 * this list also feeds the suggestion form's Manufacturer dropdown.
 * A genuinely missing company is a one-line addition + correction.
 */
export const KNOWN_MANUFACTURERS = [
    "Animal Artistry",
    "Beswick",
    // MODEL HORSES INTERNATIONAL's artist-list sweep (2026-08-19)
    // surfaced five companies missing from this list — they were
    // classifying as artists. Migration 178 moves the existing rows.
    "Black Horse Ranch",
    "Border Fine Arts",
    "Breyer",
    "CollectA",
    "Conversation Concepts",
    "Copperfox",
    "Country Artists",
    "Creata",
    "Danbury Mint",
    "Grand Champions",
    "Hagen-Renaker",
    "Hartland",
    "Horsing Around",
    "Julip",
    "North Light",
    "Pacific Giftware",
    "Peter Stone",
    "Royal Doulton",
    "Safari Ltd",
    "Sandicast",
    "Schleich",
    "Stone Critters",
    "United Design Company",
    "WIA",
] as const;

/**
 * Spelling/abbreviation variants seen in the data, mapped to the
 * canonical manufacturer name above. Same source as the additions:
 * "BHR" is Black Horse Ranch; "Creart" is a long-lived misspelling
 * of Creata.
 */
export const MANUFACTURER_ALIASES: Record<string, string> = {
    BHR: "Black Horse Ranch",
    Creart: "Creata",
};

/**
 * Derive artist/manufacturer from legacy fields. This IS migration
 * 156's mechanical backfill, expressed in TS so pages can render the
 * split before the columns exist and tests can pin the two in sync:
 *   - artist categories: maker is the artist; manufacturer unknown.
 *   - factory categories: maker is the manufacturer; the sculptor
 *     credit (attributes.sculptor) is the artist.
 * Real column values (post-156 corrections) always win over this.
 */
/** Canonicalize a name against the manufacturer alias map. */
function canonicalName(name: string | null): string | null {
    if (!name) return null;
    return MANUFACTURER_ALIASES[name] ?? name;
}

/** A company in the artist slot is a classification error, not an
 *  artist — reroute it (the MHI sweep found eleven of these). */
function isKnownManufacturer(name: string | null): boolean {
    if (!name) return false;
    const canon = canonicalName(name);
    return (KNOWN_MANUFACTURERS as readonly string[]).includes(canon as string);
}

export function deriveAttribution(row: {
    item_type: string;
    maker: string;
    sculptor?: string | null;
    artist?: string | null;
    manufacturer?: string | null;
}): Attribution {
    let artist = row.artist?.trim() || null;
    let manufacturer = canonicalName(row.manufacturer?.trim() || null);

    // A manufacturer name sitting in the artist column moves over
    // (never overwriting a real manufacturer already present).
    if (isKnownManufacturer(artist)) {
        manufacturer = manufacturer ?? canonicalName(artist);
        artist = null;
    }

    const explicit = { artist, manufacturer };
    if (ARTIST_ATTRIBUTED_CATEGORIES.has(row.item_type)) {
        return {
            artist: explicit.artist ?? (row.maker.trim() || null),
            manufacturer: explicit.manufacturer,
        };
    }
    return {
        artist: explicit.artist ?? (row.sculptor?.trim() || null),
        manufacturer: explicit.manufacturer ?? (row.maker.trim() || null),
    };
}
