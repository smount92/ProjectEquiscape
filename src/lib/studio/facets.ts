/**
 * Facet hygiene for the studio directory and storefront.
 *
 * Specialties, mediums and scales were free text before the pick-lists
 * existed, and the hobby's own vocabulary changed underneath them (170
 * renamed the service types). Stored arrays therefore carry variants of
 * one idea — "Tack Making" and "Tack making", "Micro Mini" and "Micro
 * mini", "Prepping" and "Prep work" — and the directory's service filter
 * listed every spelling as its own option.
 *
 * `canonicalFacet` folds a value to one display form: the current
 * vocabulary's label when it matches case-insensitively (or by alias),
 * else the value as first seen with surrounding whitespace trimmed.
 * Pure, so it is tested once and used everywhere a facet is shown or
 * compared.
 */

import { SERVICE_TYPES } from "@/lib/studio/services";

/** Older spellings → the label the hobby uses now. Keys are lower-case. */
const ALIASES: Record<string, string> = {
    prepping: "Prep work",
    "prep": "Prep work",
    "tack": "Tack making",
    hairing: "Hair / mane & tail",
    "hair": "Hair / mane & tail",
    "custom painting (of)": "Finishwork (repaint)",
    "custom painting (resin)": "Resin prep & finish",
    "customizing": "Custom (sculpting)",
    "sculpting": "Custom (sculpting)",
    "etching/dremmeling": "Etching / dremel work",
    "etching/dremeling": "Etching / dremel work",
    "dolls and riders": "Dolls & riders",
    "doll / rider": "Dolls & riders",
    "micro mini": "Micro mini",
    "micro": "Micro mini",
    // Scales: the bare word and the labelled scale are one facet. Without
    // this the Scale dropdown listed "Traditional (1:9)" and "Traditional"
    // as two choices (2026-09-20).
    "traditional": "Traditional (1:9)",
    "trad": "Traditional (1:9)",
    "1:8": "Large Traditional (1:8)",
    "large traditional": "Large Traditional (1:8)",
    "1:10": "Small Traditional (1:10)",
    "small traditional": "Small Traditional (1:10)",
    "classic": "Classic (1:12)",
    "stablemate": "Stablemate (1:32)",
    "sm": "Stablemate (1:32)",
    "paddock pal": "Paddock Pal (1:24)",
};

const CANON_BY_KEY = new Map<string, string>(
    [...SERVICE_TYPES].map((label) => [label.toLowerCase(), label]),
);

function key(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** One display form for a stored facet value. */
export function canonicalFacet(value: string): string {
    const k = key(value);
    if (!k) return "";
    return ALIASES[k] ?? CANON_BY_KEY.get(k) ?? value.trim().replace(/\s+/g, " ");
}

/** Dedupe a list of facet values case-insensitively, keeping first-seen order. */
export function canonicalFacets(values: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
        const c = canonicalFacet(v);
        if (!c) continue;
        const k = key(c);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(c);
    }
    return out;
}

/** Do two facet values mean the same thing? */
export function sameFacet(a: string, b: string): boolean {
    return key(canonicalFacet(a)) === key(canonicalFacet(b));
}
