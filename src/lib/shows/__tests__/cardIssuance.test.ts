import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
    CARD_GATE,
    SEASON1_CARD_GATE,
    STAKES_GATE,
    assignCardCodes,
    buildCardIssuePlan,
    cardGateFor,
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
            { classId: "class-1", horseId: "h1", earnedPlace: 1, ownerId: "o1", classEntryCount: 3, classExhibitorCount: 3, isStakes: false },
            { classId: "class-1", horseId: "h2", earnedPlace: 2, ownerId: "o2", classEntryCount: 3, classExhibitorCount: 3, isStakes: false },
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
            { classId: "class-1", horseId: "h2", earnedPlace: 2, ownerId: "o2", classEntryCount: 3, classExhibitorCount: 3, isStakes: false },
        ]);
        expect(skippedExisting).toBe(1);
    });

    it("freezes the entry owner as the card's earner", () => {
        const { cards } = buildCardIssuePlan(
            baseInput({
                entries: [
                    { id: "e1", classId: "class-1", horseId: "h1", ownerId: "original-owner", status: "placed" },
                    { id: "e2", classId: "class-1", horseId: "h2", ownerId: "o2", status: "placed" },
                    { id: "e3", classId: "class-1", horseId: "h3", ownerId: "o3", status: "placed" },
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
// validity gates — "a card means the class was real competition"
// ══════════════════════════════════════════════════════════════

/** N placed entries in class-1 from distinct owners; 1st place goes to e1. */
function gatedInput(
    entryCount: number,
    ownerCount: number,
    showYear: number | null,
): CardIssueInput {
    const entries = Array.from({ length: entryCount }, (_, i) => ({
        id: `e${i + 1}`,
        classId: "class-1",
        horseId: `h${i + 1}`,
        ownerId: `o${(i % ownerCount) + 1}`,
        status: "placed" as const,
    }));
    return baseInput({
        show: { id: "show-1", isMhhQualifying: true, showYear },
        entries,
        placings: [{ entryId: "e1", classId: "class-1", place: 1 }],
    });
}

describe("buildCardIssuePlan — validity gates", () => {
    it("cardGateFor: Season 1 (≤2026 or unset year) is 3-and-2; 2027+ is 5-and-3", () => {
        expect(cardGateFor(2026)).toEqual(SEASON1_CARD_GATE);
        expect(cardGateFor(null)).toEqual(SEASON1_CARD_GATE);
        expect(cardGateFor(2027)).toEqual(CARD_GATE);
        expect(cardGateFor(2030)).toEqual(CARD_GATE);
    });

    it("Season 1: 3 entries / 2 exhibitors mints; one short on either axis does not", () => {
        expect(gatedPlan(3, 2, 2026).cards).toHaveLength(1);
        expect(gatedPlan(2, 2, 2026)).toMatchObject({ cards: [], skippedGated: 1 });
        expect(gatedPlan(3, 1, 2026)).toMatchObject({ cards: [], skippedGated: 1 });
    });

    it("Season 2+: 5 entries / 3 exhibitors mints; the Season 1 numbers no longer do", () => {
        expect(gatedPlan(5, 3, 2027).cards).toHaveLength(1);
        expect(gatedPlan(4, 3, 2027)).toMatchObject({ cards: [], skippedGated: 1 });
        expect(gatedPlan(5, 2, 2027)).toMatchObject({ cards: [], skippedGated: 1 });
        expect(gatedPlan(3, 2, 2027).cards).toEqual([]);
    });

    it("scratched entries never pad the field a card was won against", () => {
        const input = gatedInput(3, 3, 2026);
        input.entries[2].status = "scratched"; // live field drops to 2
        const { cards, skippedGated } = buildCardIssuePlan(input);
        expect(cards).toEqual([]);
        expect(skippedGated).toBe(1);
    });

    it(`a class of ${STAKES_GATE.entries}+ entries from ${STAKES_GATE.exhibitors}+ exhibitors mints a STAKES card, stamped with the field it beat`, () => {
        const { cards } = gatedPlan(15, 6, 2027);
        expect(cards[0]).toMatchObject({
            isStakes: true,
            classEntryCount: 15,
            classExhibitorCount: 6,
        });
        // One exhibitor short of the STAKES bar: a normal card.
        expect(gatedPlan(15, 5, 2027).cards[0]).toMatchObject({ isStakes: false });
    });
});

function gatedPlan(entryCount: number, ownerCount: number, showYear: number | null) {
    return buildCardIssuePlan(gatedInput(entryCount, ownerCount, showYear));
}

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
        // Third live entry clears the Season 1 gate (3 entries / 2 exhibitors).
        { id: "e3", class_id: "class-1", horse_id: "h3", owner_id: "o3", status: "placed" },
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
        expect(result).toEqual({
            issued: 2,
            skipped: 0,
            skippedGated: 0,
            cards: [
                { classId: "class-1", horseId: "h1", earnedPlace: 1, ownerId: "o1", classEntryCount: 3, classExhibitorCount: 3, isStakes: false, code: expect.any(String) },
                { classId: "class-1", horseId: "h2", earnedPlace: 2, ownerId: "o2", classEntryCount: 3, classExhibitorCount: 3, isStakes: false, code: expect.any(String) },
            ],
        });
        // The plan's codes ARE the inserted card ids (verify links work).
        const planned = (result as { cards: { code: string }[] }).cards;
        for (const c of planned) expect(isValidCardCode(c.code)).toBe(true);

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
                class_entry_count: 3,
                class_exhibitor_count: 3,
                is_stakes: false,
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
        expect(result).toEqual({ issued: 0, skipped: 0, skippedGated: 0, cards: [] });
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
        expect(result).toEqual({ issued: 0, skipped: 2, skippedGated: 0, cards: [] });
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
        expect(result).toEqual({ issued: 0, skipped: 2, skippedGated: 0, cards: [] });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledTimes(1);
    });

    it("surfaces read errors so the publish stays retryable", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: SHOW, error: null });
        queueImplicit({ data: null, error: { message: "divisions read denied" } });
        const result = await issueQualificationCardsForShow(supabase, "show-1");
        expect(result).toEqual({ error: "divisions read denied" });
    });
});
