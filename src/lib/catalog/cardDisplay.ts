/**
 * Catalog CARDS browse — pure display helpers (NEXT_PUBLIC_CATALOG_V2).
 *
 * The identification card's job is disambiguation: "which Commander is
 * this?" is answered by maker · years · color, not by the name alone.
 * Everything here is pure (no React, no Supabase) so the tolerance rules
 * for the polymorphic `attributes` JSONB are directly unit-testable.
 */

/** The attributes keys the cards read. All optional — the catalog is
 *  community-built and most rows carry only some of these. */
export interface CardAttributes {
    release_year_start?: unknown;
    release_year_end?: unknown;
    /** Legacy/alternate key spellings tolerated (imports vary). */
    year_start?: unknown;
    year_end?: unknown;
    color_description?: unknown;
}

/** Coerce a JSONB value to a displayable 4-digit-ish year string, else null.
 *  Tolerates numbers, numeric strings, and garbage (returns null). */
function asYear(v: unknown): string | null {
    if (typeof v === "number" && Number.isFinite(v)) v = String(Math.trunc(v));
    if (typeof v !== "string") return null;
    const s = v.trim();
    return /^\d{4}$/.test(s) ? s : null;
}

/** Coerce a JSONB value to trimmed non-empty text, else null. */
function asText(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s ? s : null;
}

/**
 * "1988–1995", "1988" (open/single year), or null when no usable year.
 * Equal start/end collapses to the single year.
 */
export function yearRangeLabel(attrs: CardAttributes | null | undefined): string | null {
    if (!attrs || typeof attrs !== "object") return null;
    const start = asYear(attrs.release_year_start) ?? asYear(attrs.year_start);
    const end = asYear(attrs.release_year_end) ?? asYear(attrs.year_end);
    if (start && end) return start === end ? start : `${start}–${end}`;
    return start ?? end;
}

/**
 * The card's disambiguation sub-line: "Maker · years · color", skipping
 * whatever is absent (attributes are best-effort community data). Returns
 * "" when nothing at all is known — the card then shows no sub-line.
 */
export function disambiguationLine(
    maker: string | null | undefined,
    attrs: CardAttributes | null | undefined,
): string {
    const parts: string[] = [];
    const m = asText(maker);
    if (m) parts.push(m);
    const years = yearRangeLabel(attrs);
    if (years) parts.push(years);
    const color = attrs && typeof attrs === "object" ? asText(attrs.color_description) : null;
    if (color) parts.push(color);
    return parts.join(" · ");
}

/**
 * Card titles render proper-case, never forced uppercase. Legacy imports
 * stored some names as ALL CAPS ("COMMANDER"); those are title-cased for
 * the card. Mixed-case names are left exactly as stored (curators' casing
 * like "El Campeador" or "POA" would be mangled by a blanket transform —
 * only shout-case strings with at least one word of 2+ letters convert).
 */
export function displayTitle(title: string | null | undefined): string {
    const t = (title ?? "").trim();
    if (!t) return "";
    const letters = t.replace(/[^A-Za-z]/g, "");
    // Only transform when the whole name is shouting AND it isn't a short
    // acronym-like token ("POA", "ISH").
    if (!letters || letters !== letters.toUpperCase()) return t;
    if (t.length <= 4 && !/\s/.test(t)) return t;
    return t
        .toLowerCase()
        .replace(/(^|[\s\-–—/("'.])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Quick-chip picks for the filter row: the facet arrays come back
 * alphabetical (get_catalog_facets), so "top" is a preference list of the
 * hobby's major makers/scales intersected with what actually exists.
 * Deliberately NO padding from the raw facet list — its alphabetical head
 * is community-data junk ("?", stray values), and fewer good chips beat
 * a full row of noise. The full list stays a dropdown away.
 */
export function pickQuickChips(
    facetValues: string[] | null | undefined,
    preferred: string[],
    limit: number,
): string[] {
    const values = (facetValues ?? []).filter((v) => typeof v === "string" && v.trim());
    const picks: string[] = [];
    for (const p of preferred) {
        const hit = values.find((v) => v.toLowerCase() === p.toLowerCase());
        if (hit && !picks.includes(hit)) picks.push(hit);
        if (picks.length >= limit) break;
    }
    return picks;
}

/** The makers most searched-for in the hobby — quick-chip preference order.
 *  ("Stone" dropped: migration 157 unifies it into "Peter Stone".) */
export const PREFERRED_QUICK_MAKERS = [
    "Breyer",
    "Peter Stone",
    "Hartland",
    "Schleich",
    "CollectA",
] as const;

/** Scale preference order for the quick chips (Traditional first).
 *  Canonical Taxonomy-v2 spellings — pickQuickChips matches facet
 *  values exactly (case-insensitive), so these must be the stored
 *  forms; the old bare "Traditional" list never matched anything. */
export const PREFERRED_QUICK_SCALES = [
    "Traditional (1:9)",
    "Classic (1:12)",
    "Stablemate (1:32)",
    "Paddock Pal (1:24)",
    "Mini Whinnies (1:64)",
    "Micro Mini",
] as const;
