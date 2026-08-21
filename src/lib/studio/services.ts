/**
 * Services and the hobby's vocabulary — pure, no I/O.
 *
 * v1 priced a whole studio with one `price_range_min/max` pair. In a hobby
 * where a Stablemate custom is $150–350, a Traditional is $500–1,200, and
 * prep is billed as a separate line entirely (research doc 2.2), one range
 * across all work isn't a price — it's noise.
 *
 * A service is therefore {type, scale, price range}. The artist lists as
 * many as they offer; the commissioner picks one when requesting, and both
 * sides start from the same number.
 */

import { formatMoney } from "./terms";

/**
 * The work types the hobby actually names. These are the words customizers
 * and finishwork artists use on their own commission pages — we use theirs,
 * not ours.
 */
export const SERVICE_TYPES = [
    "Custom (sculpting)",
    "Finishwork (repaint)",
    "Prep work",
    "Resin prep & finish",
    "China painting",
    "Drybrush / OF touch-up",
    "Hair / mane & tail",
    "Tack making",
    "Halter making",
    "Doll / rider",
    "Repair & restoration",
    "Other",
] as const;

/**
 * Scales, in the hobby's own terms. Traditional ≈ 1:9, Classic ≈ 1:12,
 * Stablemate ≈ 1:32. Medallions and pewters are their own thing.
 */
export const SERVICE_SCALES = [
    "Traditional",
    "Classic",
    "Stablemate",
    "Little Bit / Paddock Pal",
    "Medallion",
    "Pewter",
    "Resin (any scale)",
    "Any scale",
] as const;

export interface StudioService {
    id: string;
    type: string;
    scale: string;
    priceMin: number | null;
    priceMax: number | null;
    /** e.g. "prep quoted separately", "appaloosa +$150" */
    note: string | null;
    /** Per-service intake, so an artist can close customs but keep prep open. */
    open: boolean;
}

function money(n: unknown): number | null {
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v) || v < 0) return null;
    return Math.round(v * 100) / 100;
}

function str(n: unknown): string {
    return typeof n === "string" ? n.trim() : "";
}

/**
 * Coerce a jsonb array (or anything) into services. Never throws; drops
 * entries that carry no work type. This is the feature-detection seam for
 * the `services` column before migration 170 lands.
 */
export function coerceServices(raw: unknown): StudioService[] {
    if (!Array.isArray(raw)) return [];
    const out: StudioService[] = [];
    for (const [i, entry] of raw.entries()) {
        if (!entry || typeof entry !== "object") continue;
        const r = entry as Record<string, unknown>;
        const type = str(r.type) || str(r.name);
        if (!type) continue;
        let priceMin = money(r.priceMin ?? r.price_min);
        let priceMax = money(r.priceMax ?? r.price_max);
        // A backwards range is a typo, not an intent — read it the way it
        // was obviously meant rather than rendering "$800 – $200".
        if (priceMin != null && priceMax != null && priceMin > priceMax) {
            [priceMin, priceMax] = [priceMax, priceMin];
        }
        out.push({
            id: str(r.id) || `svc-${i}`,
            type,
            scale: str(r.scale) || "Any scale",
            priceMin,
            priceMax,
            note: str(r.note) || null,
            open: r.open === undefined ? true : r.open !== false,
        });
    }
    return out;
}

/** "$500 – $1,200", "From $150", "Up to $600", or "Ask". */
export function priceRangeLabel(
    min: number | null | undefined,
    max: number | null | undefined,
): string {
    if (min != null && max != null)
        return min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`;
    if (min != null) return `From ${formatMoney(min)}`;
    if (max != null) return `Up to ${formatMoney(max)}`;
    return "Ask";
}

export function serviceLabel(service: StudioService): string {
    return service.scale && service.scale !== "Any scale"
        ? `${service.type} · ${service.scale}`
        : service.type;
}

/**
 * The studio-wide range, derived from the services rather than stored
 * separately — so it can never contradict the list underneath it.
 */
export function studioPriceRange(services: StudioService[]): {
    min: number | null;
    max: number | null;
    label: string;
} {
    const mins = services.map((s) => s.priceMin).filter((n): n is number => n != null);
    const maxes = services.map((s) => s.priceMax ?? s.priceMin).filter((n): n is number => n != null);
    const min = mins.length ? Math.min(...mins) : null;
    const max = maxes.length ? Math.max(...maxes) : null;
    return { min, max, label: priceRangeLabel(min, max) };
}

/** Distinct work types offered, for the directory's service-type filter. */
export function serviceTypesOffered(services: StudioService[]): string[] {
    return [...new Set(services.filter((s) => s.open).map((s) => s.type))].sort();
}
