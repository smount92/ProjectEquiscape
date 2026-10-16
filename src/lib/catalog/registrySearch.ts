/**
 * One Registry search: what a member types, read the way the Registry page
 * reads it, in the order the Registry page shows it (MHH-076).
 *
 * The Registry page (getCatalogItems) had grown its own search: a leading
 * maker becomes a preference, "SM" and "G1" come off so the mold's name is
 * searched, a named mold brings its releases with it, and sets that only
 * list the name go last (MHH-075). The duplicate-report picker, the old
 * picker and the wishlist search used a thinner copy that showed 8 rows,
 * dropped punctuation and never expanded a mold, so a member reporting a
 * duplicate could not find it. This is the one owner; every surface that
 * searches the Registry by name calls it.
 *
 * Returns null when the search RPC is unavailable, so a caller can fall
 * back to its own plain title match.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";
import { parseCatalogQuery } from "@/lib/catalog/queryParse";
import {
    matchKind,
    namedMolds,
    placeReleasesUnderMolds,
    rosterLast,
    rosterOnlyIds,
    searchName,
    termImpliesStablemate,
} from "@/lib/catalog/moldSearch";

export interface RegistryRow {
    id: string;
    item_type: string;
    parent_id: string | null;
    title: string;
    maker: string | null;
    scale: string | null;
    attributes: Record<string, unknown> | null;
    /** The mold's title, for a release. */
    parent_title?: string | null;
}

export interface RegistrySearch {
    /** In the order the Registry page shows them. */
    rows: RegistryRow[];
    /** Rows that match only inside a set's roster (they come last). */
    rosterIds: Set<string>;
    /** The name that was searched: maker, "SM" and generation taken off. */
    term: string;
    /** The maker the term started with ("Breyer Adios"), or null. */
    maker: string | null;
}

/** How many candidates the fuzzy RPC hands over; similarity-ranked, so every realistic name fits. */
export const REGISTRY_CANDIDATES = 200;

const ROW_COLUMNS = "id, item_type, parent_id, title, maker, scale, attributes";

/** "Breyer G1 Arabian Stallion" → the name the search runs on, and the maker it named. */
export function readRegistryTerm(raw: string): { term: string; parsedTerm: string; maker: string | null } {
    const parsed = parseCatalogQuery(raw);
    const parsedTerm = parsed.term.length >= 2 ? parsed.term : raw.trim();
    return { term: searchName(parsedTerm) || parsedTerm, parsedTerm, maker: parsed.maker };
}

/** The entry a picker is working from (the one being reported as a duplicate). */
export interface PickerAnchor {
    id: string;
    /** Its mold: itself for a mold, its parent for a release. */
    moldId: string | null;
    scale: string | null;
}

/**
 * How well a row answers what was typed, for the picker: 0 when its own
 * name or its mold holds every typed word, or a number typed is its model
 * number; 2 when only a set's roster names it; 1 otherwise.
 */
export function pickerBand(
    row: Pick<RegistryRow, "title" | "parent_title" | "attributes">,
    term: string | null | undefined,
): number {
    if (!term?.trim()) return 0;
    const kind = matchKind(row, term);
    if (kind === "own") return 0;
    const model = String(row.attributes?.model_number ?? "")
        .replace(/^#/, "")
        .toLowerCase();
    if (
        model &&
        term
            .toLowerCase()
            .match(/[0-9][0-9a-z-]*/g)
            ?.includes(model)
    )
        return 0;
    return kind === "roster" ? 2 : 1;
}

/**
 * The order a duplicate picker lists search results in: never the entry
 * itself; the best answers to what was typed first (pickerBand), and within
 * each band the entries on the same mold first (a duplicate is nearly always
 * the same sculpture), then the same scale, then the Registry's own order.
 * Same mold leads within a band rather than over everything, so an exact
 * name typed is never pushed down by weaker rows from the reported mold.
 */
export function orderForAnchor<
    T extends Pick<RegistryRow, "id" | "parent_id" | "scale" | "title" | "parent_title" | "attributes">,
>(rows: T[], anchor: PickerAnchor | null, term?: string | null): (T & { sameMold: boolean })[] {
    const out = rows.filter((r) => r.id !== anchor?.id);
    const sameMold = (r: T) => !!anchor?.moldId && (r.id === anchor.moldId || r.parent_id === anchor.moldId);
    const near = (r: T) => (sameMold(r) ? 0 : anchor?.scale && r.scale === anchor.scale ? 1 : 2);
    return out
        .map((r, i) => ({ r, i, band: pickerBand(r, term), near: near(r) }))
        .sort((a, b) => a.band - b.band || a.near - b.near || a.i - b.i)
        .map(({ r }) => ({ ...r, sameMold: sameMold(r) }));
}

export async function searchRegistry(
    supabase: SupabaseClient<Database>,
    raw: string,
    opts: { scale?: string | null; candidates?: number } = {},
): Promise<RegistrySearch | null> {
    const { term, parsedTerm, maker } = readRegistryTerm(raw);
    if (!term) return { rows: [], rosterIds: new Set(), term, maker };
    // The RPC normalises punctuation itself (240); the term goes as typed.
    const { data, error } = await supabase.rpc("search_catalog_fuzzy", {
        search_term: term,
        max_results: opts.candidates ?? REGISTRY_CANDIDATES,
    });
    if (error || !Array.isArray(data)) return null;
    const candidates = data as unknown as RegistryRow[];
    if (candidates.length === 0) return { rows: [], rosterIds: new Set(), term, maker };

    const byId = new Map(candidates.map((r) => [r.id, r]));
    let ids = candidates.map((r) => r.id);

    // A search that names a mold shows the releases filed under it, whatever
    // those releases are called (2026-10-14: a member's 16 Stablemate Arabian
    // Stallion releases were filed under the mold and 11 never surfaced).
    const named = namedMolds(candidates, term);
    if (named.length > 0) {
        const { data: kids } = await supabase
            .from("catalog_items")
            .select(ROW_COLUMNS)
            .in(
                "parent_id",
                named.map((m) => m.id),
            )
            .eq("item_type", "plastic_release")
            .limit(1000);
        const moldTitle = new Map(named.map((m) => [m.id, m.title]));
        const byMold = new Map<string, string[]>(named.map((m) => [m.id, []]));
        const sorted = ((kids ?? []) as unknown as RegistryRow[]).sort(
            (a, b) =>
                Number(a.attributes?.release_year_start ?? 9999) - Number(b.attributes?.release_year_start ?? 9999) ||
                a.title.localeCompare(b.title),
        );
        for (const k of sorted) {
            if (!k.parent_id) continue;
            byMold.get(k.parent_id)?.push(k.id);
            if (!byId.has(k.id)) byId.set(k.id, { ...k, parent_title: moldTitle.get(k.parent_id) ?? null });
        }
        ids = placeReleasesUnderMolds(candidates, byMold, {
            preferStablemate: termImpliesStablemate(parsedTerm) && !opts.scale,
        });
    }

    // Sets that only list the name among their pieces come last (MHH-075).
    const rosterIds = rosterOnlyIds(candidates, term);
    ids = rosterLast(ids, candidates, term);
    return { rows: ids.map((id) => byId.get(id)).filter((r): r is RegistryRow => !!r), rosterIds, term, maker };
}
