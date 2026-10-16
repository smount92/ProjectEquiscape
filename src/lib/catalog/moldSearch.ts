/**
 * "Search the mold, see its releases."
 *
 * The Registry search matches rows by their own title, so a search for a
 * mold returned the mold and only those releases whose title happened to
 * repeat its name. A member's 16 Stablemate Arabian Stallion releases
 * ("Sultan", "Emperor's Gold Bar", "JCPenney Holiday Catalog 12-Piece
 * Stablemates Set") were filed under the mold and never appeared when she
 * searched for it (2026-10-14). This module decides which molds a term
 * names and places their releases directly under them in the result
 * order. Pure, so the action and the tests agree.
 */

import { stripGeneration } from "@/lib/linker/model";
import { sameWords } from "@/lib/catalog/searchKey";

/** Most ids one search carries into the facet query (a URL-length budget). */
export const EXPANDED_CANDIDATE_LIMIT = 260;

/**
 * The name a term asks for: generation token and a leading "SM" removed,
 * so "G1 Arabian Stallion" and "SM Arabian Stallion" both name
 * "Arabian Stallion". Scale words other than SM are kept: "Classic
 * Arabian Family" is a real title.
 */
export function searchName(term: string): string {
    return stripGeneration(term.trim().replace(/^sm\s+/i, "")).trim();
}

/** True when the term carried a Stablemate generation ("G1 …"), which implies Stablemate scale. */
export function termImpliesStablemate(term: string): boolean {
    return /(^|\s)g[1-6](\s|$)|\(\s*g[1-6]\s*\)|^sm\s+/i.test(term.trim());
}

export interface CandidateRow {
    id: string;
    item_type: string;
    title: string;
    scale?: string | null;
}

/**
 * Molds whose own name (generation stripped) is the searched name: the same
 * words, however punctuated or ordered ("Morgan - Prancing" names Prancing
 * Morgan, MHH-080), but never a longer name.
 */
export function namedMolds<T extends CandidateRow>(rows: T[], name: string): T[] {
    if (!name.trim()) return [];
    return rows.filter((r) => r.item_type === "plastic_mold" && sameWords(stripGeneration(r.title), name));
}

/**
 * The candidate order with each named mold's releases placed right after
 * it. A release already in the list moves up under its mold rather than
 * appearing twice. When the term implied Stablemate, a Stablemate named
 * mold and its releases come first. The result is capped at `limit`.
 */
export function placeReleasesUnderMolds(
    candidates: CandidateRow[],
    childrenByMold: Map<string, string[]>,
    opts: { preferStablemate?: boolean; limit?: number } = {},
): string[] {
    const limit = opts.limit ?? EXPANDED_CANDIDATE_LIMIT;
    let order = candidates;
    if (opts.preferStablemate) {
        const named = new Set(childrenByMold.keys());
        const sm = candidates.filter((c) => named.has(c.id) && (c.scale ?? "").startsWith("Stablemate"));
        if (sm.length) order = [...sm, ...candidates.filter((c) => !sm.includes(c))];
    }
    const placedChildren = new Set<string>();
    for (const kids of childrenByMold.values()) for (const k of kids) placedChildren.add(k);
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (id: string) => {
        if (seen.has(id) || out.length >= limit) return;
        seen.add(id);
        out.push(id);
    };
    for (const c of order) {
        if (childrenByMold.has(c.id)) {
            push(c.id);
            for (const k of childrenByMold.get(c.id) ?? []) push(k);
            continue;
        }
        // A child of a named mold waits for its mold; it is not listed loose above it.
        if (placedChildren.has(c.id)) continue;
        push(c.id);
    }
    return out;
}
