/**
 * Shows domain — the NAMHSA-shaped results file (Phase F). Pure,
 * no I/O: the export route loads the show tree and calls
 * buildShowResultsCsv.
 *
 * NAMHSA requires member shows to produce SEARCHABLE results
 * within 30 days: class names, entry counts, placed horses in
 * order, owner names. Every row is self-contained (show/date/host
 * repeat on each line) so a flat text search — or a spreadsheet
 * filter — finds any horse or owner without cross-referencing.
 * The championship ladder (section → division → grand) follows
 * the classes, mirroring how live results sheets read.
 */

import { championLabel, placeLabel } from "./placings";
import { resolveShowRecordDate } from "./writeShowRecords";
import type { CallbackScope, EntryStatus, Place, ShowMode } from "./types";

export interface ResultsExportInput {
    show: {
        title: string;
        mode: ShowMode;
        showDate: string | null;
        entriesCloseAt: string | null;
        judgingEndsAt: string | null;
        hostAlias: string;
    };
    /** Classlist in published run order (cancelled/combined already skipped). */
    classes: {
        classId: string;
        className: string;
        classNumber: string | null;
        sectionId: string;
        sectionName: string;
        divisionId: string;
        divisionName: string;
    }[];
    entries: {
        id: string;
        classId: string;
        horseId: string;
        ownerId: string;
        status: EntryStatus;
    }[];
    placings: { entryId: string; classId: string; place: Place | null }[];
    callbacks: {
        scope: CallbackScope;
        scopeId: string | null;
        championEntryId: string | null;
        reserveEntryId: string | null;
    }[];
    horseNames: Map<string, string>;
    ownerAliases: Map<string, string>;
    /** Used when the show carries no date fields. */
    fallbackDate?: string;
}

export const RESULTS_CSV_HEADERS = [
    "Show",
    "Date",
    "Host",
    "Division",
    "Section",
    "Class #",
    "Class",
    "Entries",
    "Place",
    "Horse",
    "Owner",
] as const;

function escapeCsv(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function buildShowResultsCsv(input: ResultsExportInput): string {
    const entryById = new Map(input.entries.map((e) => [e.id, e]));
    const showDate = resolveShowRecordDate(
        {
            id: "",
            title: input.show.title,
            mode: input.show.mode,
            showDate: input.show.showDate,
            entriesCloseAt: input.show.entriesCloseAt,
            judgingEndsAt: input.show.judgingEndsAt,
        },
        input.fallbackDate,
    );

    // Live entry counts per class (scratched rows are history, not entries).
    const liveCountByClass = new Map<string, number>();
    const liveEntries = input.entries.filter((e) => e.status !== "scratched");
    for (const e of liveEntries) {
        liveCountByClass.set(e.classId, (liveCountByClass.get(e.classId) ?? 0) + 1);
    }

    const placingsByClass = new Map<string, { entryId: string; place: Place }[]>();
    for (const p of input.placings) {
        if (p.place === null) continue; // participation rows aren't results lines
        const list = placingsByClass.get(p.classId) ?? [];
        list.push({ entryId: p.entryId, place: p.place });
        placingsByClass.set(p.classId, list);
    }

    const shared = [
        escapeCsv(input.show.title),
        escapeCsv(showDate ?? ""),
        escapeCsv(input.show.hostAlias),
    ];

    const rows: string[] = [];
    const pushRow = (
        division: string,
        section: string,
        classNumber: string | null,
        className: string,
        entryCount: number | null,
        place: string,
        horse: string,
        owner: string,
    ) => {
        rows.push(
            [
                ...shared,
                escapeCsv(division),
                escapeCsv(section),
                escapeCsv(classNumber),
                escapeCsv(className),
                escapeCsv(entryCount),
                escapeCsv(place),
                escapeCsv(horse),
                escapeCsv(owner),
            ].join(","),
        );
    };

    // ── Classes, in published run order ──
    for (const cls of input.classes) {
        const entryCount = liveCountByClass.get(cls.classId) ?? 0;
        if (entryCount === 0) continue; // classes nobody entered aren't results

        const placed = (placingsByClass.get(cls.classId) ?? []).sort(
            (a, b) => a.place - b.place,
        );

        if (placed.length === 0) {
            // The class ran (had entries) but no placings were recorded —
            // still list it with its entry count, per the searchability rule.
            pushRow(
                cls.divisionName,
                cls.sectionName,
                cls.classNumber,
                cls.className,
                entryCount,
                "",
                "",
                "",
            );
            continue;
        }

        for (const p of placed) {
            const entry = entryById.get(p.entryId);
            if (!entry) continue; // data drift never fabricates a line
            pushRow(
                cls.divisionName,
                cls.sectionName,
                cls.classNumber,
                cls.className,
                entryCount,
                placeLabel(p.place),
                input.horseNames.get(entry.horseId) ?? "Unknown horse",
                input.ownerAliases.get(entry.ownerId) ?? "unknown",
            );
        }
    }

    // ── Championship ladder (section → division → grand) ──
    const sectionById = new Map(input.classes.map((c) => [c.sectionId, c]));
    const divisionById = new Map(input.classes.map((c) => [c.divisionId, c]));
    const scopeOrder: Record<CallbackScope, number> = { section: 0, division: 1, show: 2 };
    const orderedCallbacks = [...input.callbacks].sort(
        (a, b) => scopeOrder[a.scope] - scopeOrder[b.scope],
    );

    for (const cb of orderedCallbacks) {
        let division = "";
        let section = "";
        if (cb.scope === "section") {
            const ctx = cb.scopeId ? sectionById.get(cb.scopeId) : undefined;
            if (!ctx) continue;
            division = ctx.divisionName;
            section = ctx.sectionName;
        } else if (cb.scope === "division") {
            const ctx = cb.scopeId ? divisionById.get(cb.scopeId) : undefined;
            if (!ctx) continue;
            division = ctx.divisionName;
        }

        const picks: ["champion" | "reserve", string | null][] = [
            ["champion", cb.championEntryId],
            ["reserve", cb.reserveEntryId],
        ];
        for (const [kind, entryId] of picks) {
            if (!entryId) continue;
            const entry = entryById.get(entryId);
            if (!entry) continue;
            pushRow(
                division,
                section,
                null,
                cb.scope === "show"
                    ? "Grand Championship"
                    : cb.scope === "division"
                      ? "Division Championship"
                      : "Section Championship",
                null,
                championLabel(kind, cb.scope),
                input.horseNames.get(entry.horseId) ?? "Unknown horse",
                input.ownerAliases.get(entry.ownerId) ?? "unknown",
            );
        }
    }

    // BOM so Excel opens UTF-8 horse names correctly (matches the
    // legacy export routes' convention).
    const bom = "﻿";
    return bom + RESULTS_CSV_HEADERS.join(",") + "\n" + rows.join("\n") + "\n";
}
