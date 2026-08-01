/**
 * Pure shaping helpers for the maker hub pages (/reference and
 * /reference/[maker]). Kept free of Supabase/Next imports so they're
 * trivially unit-testable: the server loaders in
 * src/app/actions/maker-hubs.ts fetch flat rows (paged, light columns —
 * never per-item queries) and these functions do the grouping/counting
 * in process.
 */

export interface MakerCountRow {
    maker: string | null;
    maker_slug: string | null;
}

export interface MakerSummary {
    /** Display name, proper case as stored ("Breyer", "Peter Stone"). */
    maker: string;
    makerSlug: string;
    /** Total catalog items (all item types) under this maker. */
    count: number;
}

/**
 * Collapse flat {maker, maker_slug} rows into one entry per maker with a
 * count, sorted by count desc (ties alphabetical). Rows missing either
 * field are dropped — they have no hub URL to live at. When the same slug
 * appears with differing display names (casing drift), the most frequent
 * spelling wins.
 */
export function groupMakerCounts(rows: MakerCountRow[]): MakerSummary[] {
    const bySlug = new Map<string, { count: number; names: Map<string, number> }>();
    for (const row of rows) {
        if (!row.maker || !row.maker_slug) continue;
        let entry = bySlug.get(row.maker_slug);
        if (!entry) {
            entry = { count: 0, names: new Map() };
            bySlug.set(row.maker_slug, entry);
        }
        entry.count++;
        entry.names.set(row.maker, (entry.names.get(row.maker) ?? 0) + 1);
    }

    const out: MakerSummary[] = [];
    for (const [makerSlug, { count, names }] of bySlug) {
        let best = "";
        let bestN = -1;
        for (const [name, n] of names) {
            if (n > bestN) {
                best = name;
                bestN = n;
            }
        }
        out.push({ maker: best, makerSlug, count });
    }
    out.sort((a, b) => b.count - a.count || a.maker.localeCompare(b.maker));
    return out;
}

/**
 * Count child rows per parent from a flat list of parent_id values
 * (one grouped pass — the caller fetches only the parent_id column).
 * Null/undefined parents (orphan releases) are ignored.
 */
export function countByParent(parentIds: (string | null | undefined)[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const id of parentIds) {
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
}
