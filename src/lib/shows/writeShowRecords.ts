/**
 * Shows domain — the ONE function that maps the unified placing
 * vocabulary onto the legacy trophy-case shape (show_records,
 * migrations 011/030). Pure, no I/O: the results-publish path in
 * src/app/actions/shows-v2.ts loads the show tree, calls
 * buildShowRecords, and inserts the returned rows (admin client —
 * records belong to the entry OWNERS, not the publishing host).
 *
 * Mapping (design doc §7 — show_records stays the permanent
 * ledger; the new system writes to it through one function):
 *   show_name          ← shows.title
 *   show_date          ← show_date (live) | judging_ends_at /
 *                        entries_close_at date (online) | fallback
 *   division           ← division name
 *   class_name         ← class name
 *   placing            ← placeLabel(place)      ("1st" … "6th")
 *   ribbon_color       ← ribbonColor(place), capitalized ("Blue")
 *   total_entries      ← live entries in the class
 *   judge_critique     ← show_placings.note
 *   verification_tier  ← 'platform_generated' (constraint-legal
 *                        since migration 116)
 *   user_id / horse_id ← the entry's owner / horse
 *
 * Idempotency: rows already written for this show (matched by
 * horse + class name, the legacy dedupe key scoped to one show)
 * are skipped, so re-publishing after a partial failure never
 * duplicates a record. Participation rows (place NULL) never
 * reach the trophy case — only placed entries do.
 */

import {
    championColor,
    championLabel,
    placeLabel,
    ribbonColor,
    type ChampionKind,
} from "./placings";
import type { CallbackScope, Place, ShowMode } from "./types";

/** Insert shape for the legacy show_records table. */
export interface ShowRecordInsert {
    horse_id: string;
    user_id: string;
    show_id: string;
    show_name: string;
    show_date: string | null;
    division: string | null;
    class_name: string | null;
    placing: string;
    ribbon_color: string | null;
    total_entries: number | null;
    judge_critique: string | null;
    verification_tier: "platform_generated";
}

export interface PublishShowInput {
    show: {
        id: string;
        title: string;
        mode: ShowMode;
        showDate: string | null;
        entriesCloseAt: string | null;
        judgingEndsAt: string | null;
    };
    /** All placings recorded for the show's classes. */
    placings: {
        entryId: string;
        classId: string;
        place: Place | null;
        note: string | null;
    }[];
    /** LIVE entries only (scratched rows are history, not results). */
    entries: {
        id: string;
        classId: string;
        horseId: string;
        ownerId: string;
    }[];
    classes: { id: string; name: string; sectionId: string }[];
    sections: { id: string; name: string; divisionId: string }[];
    divisions: { id: string; name: string }[];
    /**
     * The callback ladder (Phase E2) — champions and reserves ALSO
     * become trophy-case rows, labelled via championLabel. Optional:
     * shows without callbacks publish class placings only.
     */
    callbacks?: {
        scope: CallbackScope;
        scopeId: string | null;
        championEntryId: string | null;
        reserveEntryId: string | null;
    }[];
    /**
     * Records already written for THIS show (horse + class name) —
     * the idempotency skip-list.
     */
    existing: { horseId: string; className: string | null }[];
    /** Publish date used when the show carries no date fields. */
    fallbackDate?: string;
}

/** "blue" → "Blue" (legacy trophy-case convention). */
function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** DATE column value: live shows use their show date; online
 *  shows anchor on the end of judging, else entry close. */
export function resolveShowRecordDate(
    show: PublishShowInput["show"],
    fallbackDate?: string,
): string | null {
    if (show.mode === "live") return show.showDate ?? fallbackDate ?? null;
    const anchor = show.judgingEndsAt ?? show.entriesCloseAt;
    if (anchor) return anchor.slice(0, 10);
    return fallbackDate ?? null;
}

export function buildShowRecords(input: PublishShowInput): {
    rows: ShowRecordInsert[];
    skipped: number;
} {
    const entryById = new Map(input.entries.map((e) => [e.id, e]));
    const classById = new Map(input.classes.map((c) => [c.id, c]));
    const sectionById = new Map(input.sections.map((s) => [s.id, s]));
    const divisionById = new Map(input.divisions.map((d) => [d.id, d]));

    const liveCountByClass = new Map<string, number>();
    for (const e of input.entries) {
        liveCountByClass.set(e.classId, (liveCountByClass.get(e.classId) ?? 0) + 1);
    }

    const alreadyWritten = new Set(
        input.existing.map((r) => `${r.horseId}::${r.className ?? ""}`),
    );

    const showDate = resolveShowRecordDate(input.show, input.fallbackDate);

    const rows: ShowRecordInsert[] = [];
    let skipped = 0;

    for (const placing of input.placings) {
        // Participation rows never reach the trophy case.
        if (placing.place === null) continue;

        const entry = entryById.get(placing.entryId);
        const cls = classById.get(placing.classId);
        // Defensive: a placing pointing at a scratched/unknown entry
        // or class is data drift, not a record.
        if (!entry || !cls) continue;

        if (alreadyWritten.has(`${entry.horseId}::${cls.name}`)) {
            skipped += 1;
            continue;
        }

        const section = sectionById.get(cls.sectionId);
        const division = section ? divisionById.get(section.divisionId) : undefined;
        const color = ribbonColor(placing.place);

        rows.push({
            horse_id: entry.horseId,
            user_id: entry.ownerId,
            show_id: input.show.id,
            show_name: input.show.title,
            show_date: showDate,
            division: division?.name ?? null,
            class_name: cls.name,
            placing: placeLabel(placing.place),
            ribbon_color: color ? capitalize(color) : null,
            total_entries: liveCountByClass.get(cls.id) ?? null,
            judge_critique: placing.note ?? null,
            verification_tier: "platform_generated",
        });
    }

    // ── Champion / reserve rows from the callback ladder ──
    // The "class name" of a championship must be UNIQUE per horse
    // within the show for the idempotency key (horse::class_name),
    // so section championships carry their division name — two
    // divisions can both have a "Stock" section.
    for (const callback of input.callbacks ?? []) {
        const scopeName = championshipClassName(callback, sectionById, divisionById);
        if (!scopeName) continue; // data drift: scope row unknown

        const picks: [ChampionKind, string | null][] = [
            ["champion", callback.championEntryId],
            ["reserve", callback.reserveEntryId],
        ];
        for (const [kind, entryId] of picks) {
            if (!entryId) continue;
            const entry = entryById.get(entryId);
            if (!entry) continue; // scratched/unknown — never a record

            if (alreadyWritten.has(`${entry.horseId}::${scopeName.className}`)) {
                skipped += 1;
                continue;
            }

            rows.push({
                horse_id: entry.horseId,
                user_id: entry.ownerId,
                show_id: input.show.id,
                show_name: input.show.title,
                show_date: showDate,
                division: scopeName.division,
                class_name: scopeName.className,
                placing: championLabel(kind, callback.scope),
                ribbon_color: capitalize(championColor(kind)),
                total_entries: null,
                judge_critique: null,
                verification_tier: "platform_generated",
            });
        }
    }

    return { rows, skipped };
}

/** Championship "class name" + division column per scope. */
function championshipClassName(
    callback: {
        scope: CallbackScope;
        scopeId: string | null;
    },
    sectionById: Map<string, { id: string; name: string; divisionId: string }>,
    divisionById: Map<string, { id: string; name: string }>,
): { className: string; division: string | null } | null {
    if (callback.scope === "show") {
        return { className: "Grand Championship", division: null };
    }
    if (callback.scope === "division") {
        const division = callback.scopeId ? divisionById.get(callback.scopeId) : undefined;
        if (!division) return null;
        return {
            className: `${division.name} — Division Championship`,
            division: division.name,
        };
    }
    const section = callback.scopeId ? sectionById.get(callback.scopeId) : undefined;
    if (!section) return null;
    const division = divisionById.get(section.divisionId);
    return {
        className: `${division ? `${division.name} — ` : ""}${section.name} Section Championship`,
        division: division?.name ?? null,
    };
}
