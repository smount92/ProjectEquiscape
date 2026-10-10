/**
 * The herd, counted — pure aggregation over public horses for the admin
 * Insights tab. Aggregates only: a maker, a finish, a colour. Nothing
 * here names a horse or an owner.
 *
 * Owner ask (2026-10-10): "how many horses of each type exist — how many
 * public horses are Breyers / Peter Stones / etc, what colours, what sex".
 */

export interface HerdRow {
    finish_type?: string | null;
    assigned_breed?: string | null;
    assigned_gender?: string | null;
    assigned_age?: string | null;
    life_stage?: string | null;
    asset_category?: string | null;
    color?: string | null;
    catalog_id?: string | null;
    /** The to-one catalog join; null when the horse is not in the Registry. */
    catalog_items?: {
        maker?: string | null;
        scale?: string | null;
        item_type?: string | null;
        attributes?: { breed?: unknown; color_description?: unknown; gender?: unknown } | null;
    } | null;
}

export type Bucket = { label: string; count: number };

export interface HerdTally {
    total: number;
    /** Linked to a Registry entry. */
    linked: number;
    byMaker: Bucket[];
    byFinish: Bucket[];
    byScale: Bucket[];
    byGender: Bucket[];
    byBreed: Bucket[];
    byColor: Bucket[];
    byAge: Bucket[];
    byCategory: Bucket[];
}

export const UNKNOWN = "Unknown";
export const OTHER = "Other";

function clean(value: unknown): string {
    if (typeof value !== "string") return UNKNOWN;
    const v = value.trim();
    return v === "" ? UNKNOWN : v;
}

/** Case-insensitive grouping that keeps the first spelling it saw. */
function bump(map: Map<string, Bucket>, raw: unknown): void {
    const label = clean(raw);
    const key = label.toLowerCase();
    const b = map.get(key);
    if (b) b.count += 1;
    else map.set(key, { label, count: 1 });
}

/** Busiest first; everything past `n` folds into one "Other" row, Unknown always last. */
export function topBuckets(map: Map<string, Bucket>, n: number): Bucket[] {
    const unknown = map.get(UNKNOWN.toLowerCase());
    const named = [...map.values()].filter((b) => b.label !== UNKNOWN).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const head = named.slice(0, n);
    const rest = named.slice(n).reduce((s, b) => s + b.count, 0);
    if (rest > 0) head.push({ label: OTHER, count: rest });
    if (unknown) head.push(unknown);
    return head;
}

export function tallyHerd(rows: readonly HerdRow[], top = 12): HerdTally {
    const maker = new Map<string, Bucket>();
    const finish = new Map<string, Bucket>();
    const scale = new Map<string, Bucket>();
    const gender = new Map<string, Bucket>();
    const breed = new Map<string, Bucket>();
    const color = new Map<string, Bucket>();
    const age = new Map<string, Bucket>();
    const category = new Map<string, Bucket>();
    let linked = 0;

    for (const r of rows) {
        const cat = r.catalog_items ?? null;
        if (r.catalog_id || cat) linked += 1;
        bump(maker, cat?.maker);
        bump(finish, r.finish_type);
        bump(scale, cat?.scale);
        // Owner-set first, then the Registry's — same precedence the show
        // identity line uses.
        bump(gender, r.assigned_gender || cat?.attributes?.gender);
        bump(breed, r.assigned_breed || cat?.attributes?.breed);
        bump(color, r.color || cat?.attributes?.color_description);
        bump(age, r.assigned_age || r.life_stage);
        bump(category, r.asset_category);
    }

    return {
        total: rows.length,
        linked,
        byMaker: topBuckets(maker, top),
        byFinish: topBuckets(finish, top),
        byScale: topBuckets(scale, top),
        byGender: topBuckets(gender, top),
        byBreed: topBuckets(breed, top),
        byColor: topBuckets(color, top),
        byAge: topBuckets(age, top),
        byCategory: topBuckets(category, top),
    };
}

/** How many of `stamps` fall inside each trailing window (days), UTC. */
export function windowCounts(
    stamps: readonly (string | null | undefined)[],
    windows: readonly number[] = [7, 30, 90],
    now: Date = new Date(),
): Record<number, number> {
    const out: Record<number, number> = {};
    for (const w of windows) out[w] = 0;
    const t = now.getTime();
    for (const s of stamps) {
        if (!s) continue;
        const age = t - new Date(s).getTime();
        if (!Number.isFinite(age) || age < 0) continue;
        for (const w of windows) if (age <= w * 86_400_000) out[w] += 1;
    }
    return out;
}
