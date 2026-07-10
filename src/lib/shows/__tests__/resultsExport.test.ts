import { describe, it, expect } from "vitest";

import {
    buildShowResultsCsv,
    RESULTS_CSV_HEADERS,
    type ResultsExportInput,
} from "@/lib/shows/resultsExport";

function baseInput(overrides: Partial<ResultsExportInput> = {}): ResultsExportInput {
    return {
        show: {
            title: "Spring Fling Live",
            mode: "live",
            showDate: "2026-06-20",
            entriesCloseAt: null,
            judgingEndsAt: null,
            hostAlias: "hostess",
        },
        classes: [
            {
                classId: "c1",
                className: "Quarter Horse",
                classNumber: "101",
                sectionId: "s1",
                sectionName: "Stock",
                divisionId: "d1",
                divisionName: "OF Plastic Halter",
            },
            {
                classId: "c2",
                className: "Appaloosa",
                classNumber: "102",
                sectionId: "s1",
                sectionName: "Stock",
                divisionId: "d1",
                divisionName: "OF Plastic Halter",
            },
        ],
        entries: [
            { id: "e1", classId: "c1", horseId: "h1", ownerId: "o1", status: "placed" },
            { id: "e2", classId: "c1", horseId: "h2", ownerId: "o2", status: "placed" },
            { id: "e3", classId: "c2", horseId: "h3", ownerId: "o1", status: "entered" },
            // Scratched rows are history, never entry-count lines.
            { id: "e4", classId: "c1", horseId: "h4", ownerId: "o2", status: "scratched" },
        ],
        placings: [
            // Deliberately out of order — the builder sorts 1..6.
            { entryId: "e2", classId: "c1", place: 2 },
            { entryId: "e1", classId: "c1", place: 1 },
        ],
        callbacks: [
            // Ladder arrives show-scope first — output is section → division → grand.
            { scope: "show", scopeId: null, championEntryId: "e1", reserveEntryId: null },
            { scope: "section", scopeId: "s1", championEntryId: "e1", reserveEntryId: "e2" },
        ],
        horseNames: new Map([
            ["h1", "Bo, Jangles"],
            ["h2", "Dusty"],
            ["h3", "Speckles"],
        ]),
        ownerAliases: new Map([
            ["o1", "alice"],
            ["o2", "bob"],
        ]),
        ...overrides,
    };
}

describe("buildShowResultsCsv — the NAMHSA-shaped results file", () => {
    it("produces the golden file: header, per-class placings with entry counts, championship ladder", () => {
        const csv = buildShowResultsCsv(baseInput());

        expect(csv).toBe(
            "﻿" +
                [
                    RESULTS_CSV_HEADERS.join(","),
                    // Class 101 — 2 live entries, placings in order, comma-name quoted.
                    'Spring Fling Live,2026-06-20,hostess,OF Plastic Halter,Stock,101,Quarter Horse,2,1st,"Bo, Jangles",alice',
                    "Spring Fling Live,2026-06-20,hostess,OF Plastic Halter,Stock,101,Quarter Horse,2,2nd,Dusty,bob",
                    // Class 102 ran (1 entry) but recorded no placings — still listed.
                    "Spring Fling Live,2026-06-20,hostess,OF Plastic Halter,Stock,102,Appaloosa,1,,,",
                    // Championship ladder: section before show scope, champion before reserve.
                    'Spring Fling Live,2026-06-20,hostess,OF Plastic Halter,Stock,,Section Championship,,Section Champion,"Bo, Jangles",alice',
                    "Spring Fling Live,2026-06-20,hostess,OF Plastic Halter,Stock,,Section Championship,,Section Reserve Champion,Dusty,bob",
                    'Spring Fling Live,2026-06-20,hostess,,,,Grand Championship,,Grand Champion,"Bo, Jangles",alice',
                ].join("\n") +
                "\n",
        );
    });

    it("skips classes nobody entered and participation placings", () => {
        const csv = buildShowResultsCsv(
            baseInput({
                classes: [
                    {
                        classId: "c1",
                        className: "Quarter Horse",
                        classNumber: "101",
                        sectionId: "s1",
                        sectionName: "Stock",
                        divisionId: "d1",
                        divisionName: "OF Plastic Halter",
                    },
                    {
                        classId: "empty",
                        className: "Ghost Class",
                        classNumber: "999",
                        sectionId: "s1",
                        sectionName: "Stock",
                        divisionId: "d1",
                        divisionName: "OF Plastic Halter",
                    },
                ],
                placings: [
                    { entryId: "e1", classId: "c1", place: 1 },
                    { entryId: "e2", classId: "c1", place: null }, // participation
                ],
                callbacks: [],
            }),
        );
        expect(csv).not.toContain("Ghost Class");
        expect(csv).not.toContain("Participant");
        expect(csv).toContain("1st");
    });

    it("online shows anchor the date on the end of judging", () => {
        const csv = buildShowResultsCsv(
            baseInput({
                show: {
                    title: "Photo Show",
                    mode: "online",
                    showDate: null,
                    entriesCloseAt: "2026-05-01T00:00:00Z",
                    judgingEndsAt: "2026-05-15T00:00:00Z",
                    hostAlias: "hostess",
                },
                callbacks: [],
            }),
        );
        expect(csv).toContain("Photo Show,2026-05-15,hostess");
    });

    it("callbacks pointing at unknown entries or scopes never fabricate lines", () => {
        const csv = buildShowResultsCsv(
            baseInput({
                callbacks: [
                    { scope: "section", scopeId: "ghost", championEntryId: "e1", reserveEntryId: null },
                    { scope: "division", scopeId: "d1", championEntryId: "ghost-entry", reserveEntryId: null },
                ],
            }),
        );
        expect(csv).not.toContain("Championship");
    });
});
