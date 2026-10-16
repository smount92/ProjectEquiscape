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
import { containsEveryWord, sameWords, searchKey } from "@/lib/catalog/searchKey";

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
    /** The mold's title, as the fuzzy RPC joins it. */
    parent_title?: string | null;
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

/** A search candidate as the fuzzy RPC returns it: its own title and its mold's. */
export interface MatchRow {
    id?: string;
    title: string;
    parent_title?: string | null;
}

/**
 * How a row matches what was typed (MHH-075):
 *  - "own": its own name (the title before " With ") or its mold's name holds every typed word;
 *  - "roster": every word is in the title, but only because a set's roster lists it;
 *  - "other": neither (a near spelling, a maker match).
 * Searching "Arabian Stallion" returned 49 Stablemate rows and only 8 were
 * on that mold: every set listing an Arabian Stallion among its pieces came
 * along, mixed in with the mold's own releases.
 */
export function matchKind(row: MatchRow, term: string): "own" | "roster" | "other" {
    const t = searchKey(stripGeneration(term));
    if (!t) return "other";
    const head = row.title.replace(/\s+with\b.*$/i, "");
    if (containsEveryWord(searchKey(stripGeneration(head)), t)) return "own";
    if (row.parent_title && containsEveryWord(searchKey(stripGeneration(row.parent_title)), t)) return "own";
    if (containsEveryWord(searchKey(row.title), t)) return "roster";
    return "other";
}

/**
 * The result order with roster-only rows moved to the end, each band in its
 * own order. Ids the rows do not describe (releases placed under a named
 * mold) keep their place: they are the mold's own.
 */
export function rosterLast(ids: string[], rows: (MatchRow & { id: string })[], term: string): string[] {
    const roster = rosterOnlyIds(rows, term);
    return [...ids.filter((id) => !roster.has(id)), ...ids.filter((id) => roster.has(id))];
}

/** The rows that match only inside a set's roster. */
export function rosterOnlyIds(rows: (MatchRow & { id: string })[], term: string): Set<string> {
    return new Set(rows.filter((r) => matchKind(r, term) === "roster").map((r) => r.id));
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
