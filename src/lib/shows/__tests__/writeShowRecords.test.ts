import { describe, expect, it } from "vitest";

import {
    buildShowRecords,
    resolveShowRecordDate,
    type PublishShowInput,
} from "../writeShowRecords";

/** A one-division / one-section / two-class online show. */
function baseInput(overrides: Partial<PublishShowInput> = {}): PublishShowInput {
    return {
        show: {
            id: "show-1",
            title: "July Photo Classic",
            mode: "online",
            showDate: null,
            entriesCloseAt: "2026-07-01T12:00:00Z",
            judgingEndsAt: "2026-07-08T12:00:00Z",
        },
        placings: [
            { entryId: "entry-1", classId: "class-1", place: 1, note: "Lovely bay." },
            { entryId: "entry-2", classId: "class-1", place: 2, note: null },
        ],
        entries: [
            { id: "entry-1", classId: "class-1", horseId: "horse-1", ownerId: "owner-1" },
            { id: "entry-2", classId: "class-1", horseId: "horse-2", ownerId: "owner-2" },
            { id: "entry-3", classId: "class-1", horseId: "horse-3", ownerId: "owner-3" },
        ],
        classes: [
            { id: "class-1", name: "OF Quarter Horse", sectionId: "section-1" },
            { id: "class-2", name: "OF Appaloosa", sectionId: "section-1" },
        ],
        sections: [{ id: "section-1", name: "Stock", divisionId: "division-1" }],
        divisions: [{ id: "division-1", name: "OF Plastic Halter" }],
        existing: [],
        fallbackDate: "2026-07-10",
        ...overrides,
    };
}

describe("buildShowRecords — the vocabulary → trophy-case mapping", () => {
    it("maps a placed entry onto the full legacy shape", () => {
        const { rows, skipped } = buildShowRecords(baseInput());
        expect(skipped).toBe(0);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({
            horse_id: "horse-1",
            user_id: "owner-1",
            show_name: "July Photo Classic",
            // Online show → the judging window's end date.
            show_date: "2026-07-08",
            division: "OF Plastic Halter",
            class_name: "OF Quarter Horse",
            placing: "1st",
            ribbon_color: "Blue",
            // 3 live entries in class-1.
            total_entries: 3,
            judge_critique: "Lovely bay.",
            verification_tier: "platform_generated",
        });
        expect(rows[1]).toMatchObject({
            horse_id: "horse-2",
            user_id: "owner-2",
            placing: "2nd",
            ribbon_color: "Red",
            judge_critique: null,
        });
    });

    it("derives every ribbon color from the one placings vocabulary", () => {
        const input = baseInput({
            placings: ([1, 2, 3, 4, 5, 6] as const).map((place, i) => ({
                entryId: `entry-p${i}`,
                classId: "class-1",
                place,
                note: null,
            })),
            entries: [1, 2, 3, 4, 5, 6].map((n, i) => ({
                id: `entry-p${i}`,
                classId: "class-1",
                horseId: `horse-p${i}`,
                ownerId: `owner-p${i}`,
            })),
        });
        const { rows } = buildShowRecords(input);
        expect(rows.map((r) => [r.placing, r.ribbon_color])).toEqual([
            ["1st", "Blue"],
            ["2nd", "Red"],
            ["3rd", "Yellow"],
            ["4th", "White"],
            ["5th", "Pink"],
            ["6th", "Green"],
        ]);
    });

    it("never writes participation rows (place NULL)", () => {
        const { rows } = buildShowRecords(
            baseInput({
                placings: [
                    { entryId: "entry-1", classId: "class-1", place: null, note: "Nice try." },
                ],
            }),
        );
        expect(rows).toEqual([]);
    });

    it("is idempotent: already-written horse+class rows are skipped", () => {
        const { rows, skipped } = buildShowRecords(
            baseInput({
                existing: [{ horseId: "horse-1", className: "OF Quarter Horse" }],
            }),
        );
        expect(skipped).toBe(1);
        expect(rows).toHaveLength(1);
        expect(rows[0].horse_id).toBe("horse-2");
    });

    it("skips placings whose entry or class is missing (data drift)", () => {
        const { rows } = buildShowRecords(
            baseInput({
                placings: [
                    { entryId: "ghost", classId: "class-1", place: 1, note: null },
                    { entryId: "entry-1", classId: "ghost-class", place: 2, note: null },
                ],
            }),
        );
        expect(rows).toEqual([]);
    });

    it("uses the live show date for live shows", () => {
        const { rows } = buildShowRecords(
            baseInput({
                show: {
                    id: "show-1",
                    title: "Barn Burner Live",
                    mode: "live",
                    showDate: "2026-06-20",
                    entriesCloseAt: null,
                    judgingEndsAt: null,
                },
            }),
        );
        expect(rows[0].show_date).toBe("2026-06-20");
    });

    it("falls back to entries close, then the fallback date, for undated online shows", () => {
        expect(
            resolveShowRecordDate(
                {
                    id: "s",
                    title: "t",
                    mode: "online",
                    showDate: null,
                    entriesCloseAt: "2026-07-01T12:00:00Z",
                    judgingEndsAt: null,
                },
                "2026-07-10",
            ),
        ).toBe("2026-07-01");
        expect(
            resolveShowRecordDate(
                {
                    id: "s",
                    title: "t",
                    mode: "online",
                    showDate: null,
                    entriesCloseAt: null,
                    judgingEndsAt: null,
                },
                "2026-07-10",
            ),
        ).toBe("2026-07-10");
    });
});
