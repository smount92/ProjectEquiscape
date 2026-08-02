/**
 * Shows domain — SHARE-YOUR-PLACING (growth). Pure, no I/O.
 *
 * The share copy builders and the trophy-case → placing-page
 * resolver live here so the celebration page, its OG card, and the
 * passport timeline all speak the exact same sentence — and so the
 * matching rule is unit-testable without a database.
 *
 * THE ROUTE CHOICE: the public placing page is
 * `/shows/[showId]/placing/[entryId]`. The entry id is the natural
 * anon-resolvable key — show_class_entries and show_placings are
 * both anon-readable for visible shows (RLS 118), so one indexed
 * lookup answers "which horse, which class, which place" with no
 * new migrations. show_records rows do NOT store entry ids
 * (migration 138 added only show_id), so the passport timeline
 * resolves a record to its entry by (show_id, class_name) within
 * the horse's own entries — deterministic because a horse enters a
 * class at most once (entry rules + the one-breed-halter rule). If
 * data drift ever produced two same-horse entries in one class the
 * resolver drops the match rather than guessing. Championship
 * records carry synthetic class names ("Grand Championship") that
 * match no real class, so they simply get no share link.
 */

import { placeLabel } from "./placings";
import type { Place, ShowMode } from "./types";

/** The facts one placing share needs — page, OG card, metadata. */
export interface PlacingShareFacts {
    horseName: string;
    place: Place;
    className: string;
    showTitle: string;
    /** Live entries in the class (scratched excluded); null when unknown. */
    totalEntries: number | null;
    mode: ShowMode;
}

/** "Rain Dancer placed 1st — Summer Classic" (metadata / share title). */
export function placingShareTitle(f: PlacingShareFacts): string {
    return `${f.horseName} placed ${placeLabel(f.place)} — ${f.showTitle}`;
}

/** The one sentence a non-member must instantly understand:
 *  "won 1st of 9 entries in Stock Breeds at ..., a Model Horse Hub
 *  photo show." */
export function placingShareDescription(f: PlacingShareFacts): string {
    const field =
        f.totalEntries !== null && f.totalEntries > 1 ? ` of ${f.totalEntries} entries` : "";
    const showKind = f.mode === "live" ? "live show" : "photo show";
    return `${f.horseName} won ${placeLabel(f.place)}${field} in ${f.className} at ${f.showTitle}, a Model Horse Hub ${showKind}.`;
}

/** "1st of 9 entries" / "1st place" — the on-card field line. */
export function placingFieldLine(place: Place, totalEntries: number | null): string {
    if (totalEntries !== null && totalEntries > 1) {
        return `${placeLabel(place)} of ${totalEntries} entries`;
    }
    return `${placeLabel(place)} place`;
}

// ── Trophy-case record → placing page resolution ──

/** The slice of a show_records row the resolver needs. */
export interface ShareableRecord {
    id: string;
    showId: string | null;
    className: string | null;
    verificationTier: string | null;
}

/** One of the horse's own live entries at a results-published v2
 *  show, with its class name joined on. */
export interface HorseEntryClassRow {
    entryId: string;
    showId: string;
    className: string | null;
}

/**
 * recordId → placing-page href for every record that resolves to
 * exactly one of the horse's entries. Only platform_generated
 * records with a show link are candidates; ambiguous (show, class
 * name) keys resolve to nothing. The caller pre-filters `entries`
 * to results-published shows and non-scratched rows.
 */
export function resolvePlacingHrefs(
    records: ShareableRecord[],
    entries: HorseEntryClassRow[],
): Record<string, string> {
    // (show_id :: class_name) → entryId; duplicates poison the key.
    const entryByKey = new Map<string, string | null>();
    for (const e of entries) {
        if (!e.className) continue;
        const key = `${e.showId}::${e.className}`;
        entryByKey.set(key, entryByKey.has(key) ? null : e.entryId);
    }

    const hrefs: Record<string, string> = {};
    for (const r of records) {
        if (r.verificationTier !== "platform_generated") continue;
        if (!r.showId || !r.className) continue;
        const entryId = entryByKey.get(`${r.showId}::${r.className}`);
        if (entryId) hrefs[r.id] = `/shows/${r.showId}/placing/${entryId}`;
    }
    return hrefs;
}
