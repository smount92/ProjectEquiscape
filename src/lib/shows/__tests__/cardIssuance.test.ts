import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
    assignCardCodes,
    buildCardIssuePlan,
    issueQualificationCardsForShow,
    type CardIssueInput,
} from "@/lib/shows/cardIssuance";
import { isValidCardCode } from "@/lib/shows/cards";

// ══════════════════════════════════════════════════════════════
// buildCardIssuePlan — the pure issuance rules
// ══════════════════════════════════════════════════════════════

function baseInput(overrides: Partial<CardIssueInput> = {}): CardIssueInput {
    return {
        show: { id: "show-1", isMhhQualifying: true, showYear: 2026 },
        classes: [{ id: "class-1", isQualifying: true }],
        entries: [
            { id: "e1", classId: "class-1", horseId: "h1", ownerId: "o1", status: "placed" },
            { id: "e2", classId: "class-1", horseId: "h2", ownerId: "o2", status: "placed" },
            { id: "e3", classId: "class-1", horseId: "h3", ownerId: "o3", status: "placed" },
        ],
        placings: [
            { entryId: "e1", classId: "class-1", place: 1 },
            { entryId: "e2", classId: "class-1", place: 2 },
            { entryId: "e3", classId: "class-1", place: 3 },
        ],
        existingCards: [],
        ...overrides,
    };
}

describe("buildCardIssuePlan — issuance rules", () => {
    it("issues cards for 1st and 2nd only (3rd–6th and participation never mint)", () => {
        const { cards } = buildCardIssuePlan(
            baseInput({
                placings: [
                    { entryId: "e1", classId: "class-1", place: 1 },
                    { entryId: "e2", classId: "class-1", place: 2 },
                    { entryId: "e3", classId: "class-1", place: 6 },
                ],
            }),
        );
        expect(cards).toEqual([
            { classId: "class-1", horseId: "h1", earnedPlace: 1, ownerId: "o1" },
            { classId: "class-1", horseId: "h2", earnedPlace: 2, ownerId: "o2" },
        ]);
    });

    it("participation (null place) never mints", () => {
        const { cards } = buildCardIssuePlan(
            baseInput({ placings: [{ entryId: "e1", classId: "class-1", place: null }] }),
        );
        expect(cards).toEqual([]);
    });

    it("non-qualifying classes never mint, even for 1st", () => {
        const { cards } = buildCardIssuePlan(
            baseInput({ classes: [{ id: "class-1", isQualifying: false }] }),
        );
        expect(cards).toEqual([]);
    });

    it("a show that opted out of qualifying mints nothing at all", () => {
        const { cards, skippedExisting } = buildCardIssuePlan(
            baseInput({ show: { id: "show-1", isMhhQualifying: false, showYear: 2026 } }),
        );
        expect(cards).toEqual([]);
        expect(skippedExisting).toBe(0);
    });

    it("scratched entries never mint", () => {
        const { cards } = buildCardIssuePlan(
            baseInput({
                entries: [
                    { id: "e1", classId: "class-1", horseId: "h1", ownerId: "o1", status: "scratched" },
                ],
                placings: [{ entryId: "e1", classId: "class-1", place: 1 }],
            }),
        );
        expect(cards).toEqual([]);
    });

    it("skips (class, horse) pairs that already hold a card — idempotent re-publish", () => {
        const { cards, skippedExisting } = buildCardIssuePlan(
            baseInput({ existingCards: [{ classId: "class-1", horseId: "h1" }] }),
        );
        expect(cards).toEqual([
            { classId: "class-1", horseId: "h2", earnedPlace: 2, ownerId: "o2" },
        ]);
        expect(skippedExisting).toBe(1);
    });

    it("freezes the entry owner as the card's earner", () => {
        const { cards } = buildCardIssuePlan(
            baseInput({
                entries: [
                    { id: "e1", classId: "class-1", horseId: "h1", ownerId: "original-owner", status: "placed" },
                ],
                placings: [{ entryId: "e1", classId: "class-1", place: 1 }],
            }),
        );
        expect(cards[0].ownerId).toBe("original-owner");
    });

    it("placings pointing at unknown entries or classes are data drift, not cards", () => {
        const { cards } = buildCardIssuePlan(
            baseInput({
                placings: [
                    { entryId: "ghost", classId: "class-1", place: 1 },
                    { entryId: "e1", classId: "ghost-class", place: 1 },
                ],
            }),
        );
        expect(cards).toEqual([]);
    });
});

// ══════════════════════════════════════════════════════════════
// assignCardCodes — collision-checked short codes
// ══════════════════════════════════════════════════════════════

describe("assignCardCodes", () => {
    it("returns valid, batch-unique codes when nothing collides", async () => {
        const codes = await assignCardCodes(3, async () => new Set());
        expect(Array.isArray(codes)).toBe(true);
        const list = codes as string[];
        expect(list).toHaveLength(3);
        expect(new Set(list).size).toBe(3);
        for (const code of list) expect(isValidCardCode(code)).toBe(true);
    });

    it("regenerates only the colliding slots and retries", async () => {
        const seen: string[][] = [];
        let firstBatch: string[] | null = null;
        const codes = await assignCardCodes(2, async (candidates) => {
            seen.push([...candidates]);
            if (firstBatch === null) {
                firstBatch = [...candidates];
                // First candidate is "already taken" in the DB.
                return new Set([candidates[0]]);
            }
            return new Set();
        });
        expect(Array.isArray(codes)).toBe(true);
        const list = codes as string[];
        expect(list).toHaveLength(2);
        // The surviving second code was kept; the first was replaced.
        expect(list[1]).toBe(firstBatch![1]);
        expect(list[0]).not.toBe(firstBatch![0]);
        // The second round re-checks the full pending batch.
        expect(seen[1]).toHaveLength(2);
    });

    it("gives up with an error after repeated exhaustion", async () => {
        const result = await assignCardCodes(1, async (candidates) => new Set(candidates));
        expect(result).toEqual({
            error: "Could not generate unique card codes — please try publishing again.",
        });
    });
});

// ══════════════════════════════════════════════════════════════
// issueQualificationCardsForShow — orchestration on a mock client
// ══════════════════════════════════════════════════════════════

const mockClient = createMockSupabaseClient();
const supabase = mockClient as unknown as SupabaseClient;

/** Queue the implicit-await query results in call order. */
function queueImplicit(...results: { data: unknown; error: unknown }[]) {
    for (const r of results) {
        mockClient._mockQuery.then.mockImplementationOnce(
            (resolve: (value: unknown) => void) => Promise.resolve(r).then(resolve),
        );
    }
}

const SHOW = { id: "show-1", is_mhh_qualifying: true, show_year: 2026 };
const DIVISIONS = { data: [{ id: "d1" }], error: null };
const SECTIONS = { data: [{ id: "s1" }], error: null };
const CLASSES = { data: [{ id: "class-1", is_qualifying: true }], error: null };
const ENTRIES = {
    data: [
        { id: "e1", class_id: "class-1", horse_id: "h1", owner_id: "o1", status: "placed" },
        { id: "e2", class_id: "class-1", horse_id: "h2", owner_id: "o2", status: "placed" },
    ],
    error: null,
};
const PLACINGS = {
    data: [
        { entry_id: "e1", class_id: "class-1", place: 1 },
        { entry_id: "e2", class_id: "class-1", place: 2 },
    ],
    error: null,
};

beforeEach(() => {
    mockClient._mockQuery.maybeSingle.mockReset();
    mockClient._mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.then.mockReset();
    mockClient._mockQuery.insert.mockClear();
    mockClient._mockQuery.insert.mockReturnThis();
    mockClient._setImplicitResolve({ data: null, error: null });
});

describe("issueQualificationCardsForShow", () => {
    it("issues one card per 1st/2nd with generated codes and the show year", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: SHOW, error: null });
        queueImplicit(
            DIVISIONS,
            SECTIONS,
            CLASSES,
            ENTRIES,
            PLACINGS,
            { data: [], error: null }, // existing cards
            { data: [], error: null }, // code collision check
            { data: null, error: null }, // insert
        );

        const result = await issueQualificationCardsForShow(supabase, "show-1");
        expect(result).toEqual({ issued: 2, skipped: 0 });

        const rows = mockClient._mockQuery.insert.mock.calls[0][0] as Record<
            string,
            unknown
        >[];
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual(
            expect.objectContaining({
                show_id: "show-1",
                class_id: "class-1",
                horse_id: "h1",
                earned_place: 1,
                earned_by_owner_id: "o1",
                current_owner_id: "o1",
                status: "issued",
                show_year: 2026,
            }),
        );
        for (const row of rows) expect(isValidCardCode(row.id as string)).toBe(true);
        expect(new Set(rows.map((r) => r.id)).size).toBe(2);
    });

    it("does nothing for a show that opted out of qualifying", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { ...SHOW, is_mhh_qualifying: false },
            error: null,
        });
        const result = await issueQualificationCardsForShow(supabase, "show-1");
        expect(result).toEqual({ issued: 0, skipped: 0 });
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("re-publish is idempotent: already-issued cards skip without touching insert", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: SHOW, error: null });
        queueImplicit(
            DIVISIONS,
            SECTIONS,
            CLASSES,
            ENTRIES,
            PLACINGS,
            {
                data: [
                    { class_id: "class-1", horse_id: "h1" },
                    { class_id: "class-1", horse_id: "h2" },
                ],
                error: null,
            }, // existing cards — both already minted
        );

        const result = await issueQualificationCardsForShow(supabase, "show-1");
        expect(result).toEqual({ issued: 0, skipped: 2 });
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("a unique-violation race re-plans against the fresh card set and settles", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: SHOW, error: null });
        queueImplicit(
            DIVISIONS,
            SECTIONS,
            CLASSES,
            ENTRIES,
            PLACINGS,
            { data: [], error: null }, // existing cards (stale — race in flight)
            { data: [], error: null }, // code collision check
            { data: null, error: { code: "23505", message: "duplicate key" } }, // insert loses the race
            {
                data: [
                    { class_id: "class-1", horse_id: "h1" },
                    { class_id: "class-1", horse_id: "h2" },
                ],
                error: null,
            }, // reloaded existing cards — the concurrent publish won
        );

        const result = await issueQualificationCardsForShow(supabase, "show-1");
        expect(result).toEqual({ issued: 0, skipped: 2 });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledTimes(1);
    });

    it("surfaces read errors so the publish stays retryable", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: SHOW, error: null });
        queueImplicit({ data: null, error: { message: "divisions read denied" } });
        const result = await issueQualificationCardsForShow(supabase, "show-1");
        expect(result).toEqual({ error: "divisions read denied" });
    });
});
